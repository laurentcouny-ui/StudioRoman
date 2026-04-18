import { useState, useEffect, useCallback } from 'react'
import { getDashboardStats } from './projectStore.js'

const GOAL_STORAGE_KEY = 'scriptor-dashboard-goal'

function getTodayKey() {
  const d = new Date()
  return `scriptor-writing-minutes-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function loadTodayMinutes() {
  if (typeof window === 'undefined') return 0
  const raw = window.localStorage.getItem(getTodayKey())
  const n = parseInt(raw, 10)
  return Number.isFinite(n) ? n : 0
}

function saveTodayMinutes(minutes) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(getTodayKey(), String(Math.round(minutes)))
}

function loadGoal() {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(GOAL_STORAGE_KEY)
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function saveGoal(value) {
  if (typeof window === 'undefined') return
  const n = parseInt(value, 10)
  if (Number.isFinite(n) && n > 0) {
    window.localStorage.setItem(GOAL_STORAGE_KEY, String(n))
  } else {
    window.localStorage.removeItem(GOAL_STORAGE_KEY)
  }
}

function formatMinutes(min) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m ? `${h} h ${m} min` : `${h} h`
}

function DashboardTab({ project, currentSaga }) {
  const stats = getDashboardStats(project)
  const [goalInput, setGoalInput] = useState(() => {
    const g = loadGoal()
    return g != null ? String(g) : ''
  })
  const [goal, setGoal] = useState(() => loadGoal())
  const [todayMinutes, setTodayMinutes] = useState(loadTodayMinutes)
  const [sessionStart, setSessionStart] = useState(null)
  const [sessionDisplay, setSessionDisplay] = useState(0)

  useEffect(() => {
    if (!sessionStart) return
    const tick = () => {
      setSessionDisplay((Date.now() - sessionStart) / 60000)
    }
    tick()
    const id = setInterval(tick, 5000)
    return () => clearInterval(id)
  }, [sessionStart])

  const handleSetGoal = useCallback(() => {
    const n = parseInt(goalInput, 10)
    if (Number.isFinite(n) && n > 0) {
      saveGoal(n)
      setGoal(n)
    } else {
      saveGoal(null)
      setGoal(null)
      setGoalInput('')
    }
  }, [goalInput])

  const startSession = useCallback(() => {
    setSessionStart(Date.now())
  }, [])

  const stopSession = useCallback(() => {
    if (sessionStart) {
      const elapsed = (Date.now() - sessionStart) / 60000
      const newTotal = loadTodayMinutes() + elapsed
      saveTodayMinutes(newTotal)
      setTodayMinutes(newTotal)
      setSessionStart(null)
      setSessionDisplay(0)
    }
  }, [sessionStart])

  const maxWords = Math.max(1, ...stats.volumes.map((v) => v.wordsCount), stats.totalWords)

  return (
    <div className="dashboard-tab">
      <header className="dashboard-header">
        <h1 className="dashboard-title">{currentSaga?.title || 'Ma saga'}</h1>
        <p className="dashboard-subtitle">Tableau de bord</p>
      </header>

      <section className="dashboard-stats">
        <div className="dashboard-stat dashboard-stat-hero">
          <span className="dashboard-stat-value">{stats.totalWords.toLocaleString('fr-FR')}</span>
          <span className="dashboard-stat-label">Mots au total</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-stat-value">{stats.totalVolumes}</span>
          <span className="dashboard-stat-label">Tome{stats.totalVolumes > 1 ? 's' : ''}</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-stat-value">{stats.totalChapters}</span>
          <span className="dashboard-stat-label">Chapitre{stats.totalChapters > 1 ? 's' : ''}</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-stat-value">{stats.totalScenes}</span>
          <span className="dashboard-stat-label">Scène{stats.totalScenes > 1 ? 's' : ''}</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-stat-value">{stats.totalCharacters}</span>
          <span className="dashboard-stat-label">Personnage{stats.totalCharacters > 1 ? 's' : ''}</span>
        </div>
      </section>

      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Progression par tome</h2>
        {stats.volumes.length === 0 ? (
          <p className="dashboard-empty">Aucun tome pour l&apos;instant.</p>
        ) : (
          <ul className="dashboard-volumes">
            {stats.volumes.map((vol) => (
              <li key={vol.id} className="dashboard-volume-item">
                <div className="dashboard-volume-header">
                  <span className="dashboard-volume-title">{vol.title}</span>
                  <span className="dashboard-volume-meta">
                    {vol.chaptersCount} chap. · {vol.scenesCount} sc. · {vol.wordsCount.toLocaleString('fr-FR')} mots
                  </span>
                </div>
                <div className="dashboard-volume-bar-wrap">
                  <div
                    className="dashboard-volume-bar"
                    style={{ width: `${(vol.wordsCount / maxWords) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Objectif de mots</h2>
        <div className="dashboard-goal">
          <div className="dashboard-goal-set">
            <label className="dashboard-goal-label">Objectif total (mots) pour la saga</label>
            <div className="dashboard-goal-input-row">
              <input
                type="number"
                min="1"
                className="dashboard-goal-input"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                onBlur={handleSetGoal}
                onKeyDown={(e) => e.key === 'Enter' && handleSetGoal()}
                placeholder="Ex. 80000"
              />
              <button type="button" className="dashboard-goal-btn" onClick={handleSetGoal}>
                Définir
              </button>
            </div>
          </div>
          {goal != null && (
            <div className="dashboard-goal-progress">
              <div className="dashboard-goal-bar-wrap">
                <div
                  className="dashboard-goal-bar"
                  style={{ width: `${Math.min(100, (stats.totalWords / goal) * 100)}%` }}
                />
              </div>
              <span className="dashboard-goal-text">
                {stats.totalWords.toLocaleString('fr-FR')} / {goal.toLocaleString('fr-FR')} mots
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Temps d&apos;écriture</h2>
        <div className="dashboard-time">
          <div className="dashboard-time-today">
            <span className="dashboard-time-value">{formatMinutes(Math.round(todayMinutes + (sessionStart ? sessionDisplay : 0)))}</span>
            <span className="dashboard-time-label">Aujourd&apos;hui</span>
          </div>
          {sessionStart ? (
            <button type="button" className="dashboard-time-btn dashboard-time-btn-stop" onClick={stopSession}>
              Arrêter la session
            </button>
          ) : (
            <button type="button" className="dashboard-time-btn dashboard-time-btn-start" onClick={startSession}>
              Démarrer une session
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

export default DashboardTab
