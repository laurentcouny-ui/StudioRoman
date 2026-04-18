import { isDesktop } from '../platform'

const PRIORITY_WEIGHT = {
  print: 400,
  export: 300,
  saliency: 200,
  validation: 100,
}

function priorityValue(priority) {
  return PRIORITY_WEIGHT[priority] ?? 0
}

/**
 * Queue de taches orientee rendu/export avec:
 * - priorites metier
 * - annulation propre
 * - debounce
 * - pause/reprise sur connectivite
 * - limite de concurrence desktop/web
 * - feedback de progression observable
 */
export class TaskQueueManager {
  constructor(opts = {}) {
    this.maxWorkers = opts.maxWorkers ?? (isDesktop() ? 4 : 2)
    this.defaultDebounceMs = opts.defaultDebounceMs ?? 220
    this.autoPauseOffline = opts.autoPauseOffline ?? true

    this._nextSeq = 1
    this._active = new Map()
    this._pending = []
    this._debounceByKey = new Map()
    this._progressById = new Map()
    this._listeners = new Set()
    this._paused = false

    this._onlineHandler = () => this.resume('network-online')
    this._offlineHandler = () => {
      if (this.autoPauseOffline) this.pause('network-offline')
    }
    if (typeof window !== 'undefined' && this.autoPauseOffline) {
      window.addEventListener('online', this._onlineHandler)
      window.addEventListener('offline', this._offlineHandler)
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this._paused = true
      }
    }
  }

  destroy() {
    if (typeof window !== 'undefined' && this.autoPauseOffline) {
      window.removeEventListener('online', this._onlineHandler)
      window.removeEventListener('offline', this._offlineHandler)
    }
    this.cancelAll('destroy')
    this._listeners.clear()
    this._debounceByKey.clear()
    this._progressById.clear()
  }

  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('TaskQueueManager.subscribe: listener must be a function')
    }
    this._listeners.add(listener)
    listener(this.getSnapshot())
    return () => this._listeners.delete(listener)
  }

  getSnapshot() {
    return {
      paused: this._paused,
      activeCount: this._active.size,
      pendingCount: this._pending.length,
      maxWorkers: this.maxWorkers,
      tasks: [...this._progressById.values()].map((x) => ({ ...x })),
    }
  }

  enqueue(taskDef) {
    const def = this._normalizeTask(taskDef)
    const debounceMs =
      typeof def.debounceMs === 'number' ? Math.max(0, def.debounceMs) : this.defaultDebounceMs
    if (def.debounceKey && debounceMs > 0) {
      const prevTimer = this._debounceByKey.get(def.debounceKey)
      if (prevTimer) clearTimeout(prevTimer)
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this._debounceByKey.delete(def.debounceKey)
          this._enqueueNow(def, resolve, reject)
        }, debounceMs)
        this._debounceByKey.set(def.debounceKey, timer)
      })
    }
    return new Promise((resolve, reject) => this._enqueueNow(def, resolve, reject))
  }

  pause(reason = 'manual') {
    this._paused = true
    for (const task of this._active.values()) {
      task.status = 'paused'
      task.reason = reason
      task.promptMemory = task.promptMemory ?? task.prompt ?? null
      try {
        task.controller.abort(`paused:${reason}`)
      } catch {
        // noop
      }
      this._progressById.set(task.id, this._toProgress(task))
    }
    this._emit()
  }

  resume(reason = 'manual') {
    this._paused = false
    // Les taches actives sont requeuees en pause() via abort, la reprise relance simplement le scheduler.
    for (const p of this._pending) {
      if (p.status === 'paused') p.status = 'queued'
    }
    this._emit()
    this._schedule()
    return reason
  }

  cancelTask(taskId, reason = 'cancelled') {
    if (!taskId) return false
    const active = this._active.get(taskId)
    if (active) {
      active.status = 'cancelled'
      active.reason = reason
      try {
        active.controller.abort(reason)
      } catch {
        // noop
      }
      this._active.delete(taskId)
      this._progressById.set(active.id, this._toProgress(active))
      this._emit()
      this._schedule()
      return true
    }
    const idx = this._pending.findIndex((t) => t.id === taskId)
    if (idx >= 0) {
      const [task] = this._pending.splice(idx, 1)
      task.status = 'cancelled'
      task.reason = reason
      this._progressById.set(task.id, this._toProgress(task))
      task.reject(new Error(`Task cancelled: ${reason}`))
      this._emit()
      return true
    }
    return false
  }

  cancelAll(reason = 'cancelled-all') {
    const pending = [...this._pending]
    this._pending = []
    for (const task of pending) {
      task.status = 'cancelled'
      task.reason = reason
      this._progressById.set(task.id, this._toProgress(task))
      task.reject(new Error(`Task cancelled: ${reason}`))
    }
    for (const task of this._active.values()) {
      task.status = 'cancelled'
      task.reason = reason
      try {
        task.controller.abort(reason)
      } catch {
        // noop
      }
      this._progressById.set(task.id, this._toProgress(task))
    }
    this._active.clear()
    this._emit()
  }

  _normalizeTask(taskDef) {
    if (!taskDef || typeof taskDef.run !== 'function') {
      throw new Error('TaskQueueManager.enqueue: task.run is required')
    }
    const priority = taskDef.priority ?? 'validation'
    if (!Object.prototype.hasOwnProperty.call(PRIORITY_WEIGHT, priority)) {
      throw new Error(
        `TaskQueueManager.enqueue: invalid priority "${priority}" (allowed: print|export|saliency|validation)`,
      )
    }
    return {
      id: taskDef.id || `task-${Date.now()}-${this._nextSeq++}`,
      label: taskDef.label || taskDef.id || 'task',
      prompt: taskDef.prompt ?? null,
      promptMemory: taskDef.prompt ?? null,
      priority,
      run: taskDef.run,
      debounceKey: taskDef.debounceKey || null,
      debounceMs: taskDef.debounceMs,
      meta: taskDef.meta ?? {},
    }
  }

  _enqueueNow(def, resolve, reject) {
    const controller = new AbortController()
    const task = {
      ...def,
      controller,
      resolve,
      reject,
      queuedAt: Date.now(),
      status: this._paused ? 'paused' : 'queued',
      progress: 0,
      reason: '',
    }
    this._pending.push(task)
    this._pending.sort((a, b) => {
      const pr = priorityValue(b.priority) - priorityValue(a.priority)
      if (pr !== 0) return pr
      return a.queuedAt - b.queuedAt
    })
    this._progressById.set(task.id, this._toProgress(task))
    this._emit()
    this._schedule()
  }

  _schedule() {
    if (this._paused) return
    while (this._active.size < this.maxWorkers) {
      const nextIdx = this._pending.findIndex((t) => t.status === 'queued')
      if (nextIdx < 0) break
      const [task] = this._pending.splice(nextIdx, 1)
      this._runTask(task)
    }
  }

  async _runTask(task) {
    // Après pause réseau / abort, le contrôleur est mort : en recréer un pour la reprise auto.
    if (!task.controller || task.controller.signal.aborted) {
      task.controller = new AbortController()
    }
    task.status = 'running'
    task.startedAt = Date.now()
    this._active.set(task.id, task)
    this._progressById.set(task.id, this._toProgress(task))
    this._emit()

    const updateProgress = (value, message) => {
      const pct = Math.max(0, Math.min(100, Number(value) || 0))
      task.progress = pct
      if (typeof message === 'string') task.message = message
      this._progressById.set(task.id, this._toProgress(task))
      this._emit()
    }

    try {
      const out = await task.run({
        signal: task.controller.signal,
        updateProgress,
        taskId: task.id,
        promptMemory: task.promptMemory,
      })
      if (task.controller.signal.aborted && this._paused) {
        task.status = 'paused'
        task.reason = 'network-offline'
        task.progress = Math.max(1, task.progress)
        this._active.delete(task.id)
        this._pending.push(task)
        this._progressById.set(task.id, this._toProgress(task))
        this._emit()
        return
      }
      task.status = 'done'
      task.progress = 100
      this._active.delete(task.id)
      this._progressById.set(task.id, this._toProgress(task))
      task.resolve(out)
    } catch (error) {
      this._active.delete(task.id)
      if (this._paused || String(error?.message || '').startsWith('paused:')) {
        task.status = 'paused'
        task.reason = 'network-offline'
        this._pending.push(task)
      } else if (task.controller.signal.aborted) {
        task.status = 'cancelled'
        task.reason = task.reason || 'aborted'
        task.reject(error)
      } else {
        task.status = 'failed'
        task.reason = String(error?.message || error || 'unknown-error')
        task.reject(error)
      }
      this._progressById.set(task.id, this._toProgress(task))
    } finally {
      this._emit()
      this._schedule()
    }
  }

  _toProgress(task) {
    return {
      id: task.id,
      label: task.label,
      priority: task.priority,
      status: task.status,
      progress: task.progress ?? 0,
      reason: task.reason || '',
      message: task.message || '',
      queuedAt: task.queuedAt,
      startedAt: task.startedAt ?? null,
      promptMemory: task.promptMemory ?? null,
      meta: task.meta ?? {},
    }
  }

  _emit() {
    const snap = this.getSnapshot()
    for (const l of this._listeners) {
      try {
        l(snap)
      } catch {
        // noop
      }
    }
  }
}

export const taskQueueManager = new TaskQueueManager()
