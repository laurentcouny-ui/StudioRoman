/**
 * Journal des Silencieuses — FIFO 100, catégories, badge de session.
 */

const MAX = 100

/** @typedef {{ id: string, at: number, category: string, label: string, detail?: string }} SilentJournalEntry */

export class SilentJournal {
  constructor() {
    /** @type {SilentJournalEntry[]} */
    this.entries = []
    this.sessionSilentCount = 0
  }

  push(entry) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const full = { ...entry, id, at: Date.now() }
    this.entries.unshift(full)
    if (this.entries.length > MAX) this.entries.length = MAX
    this.sessionSilentCount += 1
    return full
  }

  clear() {
    this.entries = []
  }

  /** @param {Set<string>} categoriesToRemove */
  removeByCategories(categoriesToRemove) {
    this.entries = this.entries.filter((e) => !categoriesToRemove.has(e.category))
  }

  listFiltered(filter) {
    if (filter === 'critical') {
      return this.entries.filter((e) => e.category === 'critical')
    }
    return this.entries
  }
}
