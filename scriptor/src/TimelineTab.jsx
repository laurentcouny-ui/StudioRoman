import { useState } from 'react'
import { createEmptyTimelineEvent } from './projectStore.js'

function TimelineTab({ currentSaga, onUpdateTimeline }) {
  const events = currentSaga?.timeline?.events ?? []
  const [selectedId, setSelectedId] = useState(events[0]?.id ?? null)

  const effectiveSelectedId = events.some((e) => e.id === selectedId)
    ? selectedId
    : (events[0]?.id ?? null)
  const selected = events.find((e) => e.id === effectiveSelectedId) ?? events[0]

  const handleAddEvent = () => {
    const newEvent = createEmptyTimelineEvent()
    onUpdateTimeline?.('add', newEvent)
    setSelectedId(newEvent.id)
  }

  const handleDeleteEvent = (id) => {
    const index = events.findIndex((e) => e.id === id)
    if (index === -1) return
    const next = events[index + 1] ?? events[index - 1]
    onUpdateTimeline?.('delete', id)
    setSelectedId(next?.id ?? null)
  }

  const handleUpdateEvent = (id, field, value) => {
    onUpdateTimeline?.('update', { id, field, value })
  }

  if (!currentSaga) {
    return (
      <div className="timeline-tab empty">
        <p>Sélectionnez une saga dans le panneau de gauche.</p>
      </div>
    )
  }

  return (
    <div className="timeline-tab">
      <header className="timeline-header">
        <h1 className="timeline-title">Chronologie</h1>
        <p className="timeline-subtitle">
          Événements et repères temporels pour « {currentSaga.title || 'cette saga'} ». Ordre affiché = ordre dans la liste.
        </p>
      </header>

      <div className="timeline-layout">
        <aside className="timeline-sidebar">
          <div className="timeline-entries-list">
            {events.map((ev) => (
              <button
                key={ev.id}
                type="button"
                className={`timeline-entry-btn ${ev.id === effectiveSelectedId ? 'is-active' : ''}`}
                onClick={() => setSelectedId(ev.id)}
              >
                <span className="timeline-entry-date">{ev.date || '—'}</span>
                <span className="timeline-entry-name">{ev.title || 'Sans titre'}</span>
              </button>
            ))}
          </div>
          <button type="button" className="timeline-add-btn" onClick={handleAddEvent}>
            + Nouvel événement
          </button>
        </aside>

        <main className="timeline-main">
          {selected ? (
            <div className="timeline-editor">
              <div className="timeline-editor-header">
                <input
                  type="text"
                  className="timeline-title-input"
                  value={selected.title ?? ''}
                  onChange={(e) => handleUpdateEvent(selected.id, 'title', e.target.value)}
                  placeholder="Titre de l'événement"
                />
                <button
                  type="button"
                  className="timeline-delete-btn"
                  onClick={() => handleDeleteEvent(selected.id)}
                  title="Supprimer cet événement"
                >
                  Supprimer
                </button>
              </div>
              <label className="timeline-field">
                <span className="timeline-field-label">Date / période</span>
                <input
                  type="text"
                  className="timeline-date-input"
                  value={selected.date ?? ''}
                  onChange={(e) => handleUpdateEvent(selected.id, 'date', e.target.value)}
                  placeholder="Ex. An 12, Chapitre 3, 15 mars 1847..."
                />
              </label>
              <label className="timeline-field">
                <span className="timeline-field-label">Description</span>
                <textarea
                  className="timeline-description-input"
                  value={selected.description ?? ''}
                  onChange={(e) => handleUpdateEvent(selected.id, 'description', e.target.value)}
                  placeholder="Détails de l'événement..."
                  rows={10}
                />
              </label>
            </div>
          ) : (
            <div className="timeline-empty-state">
              <p>Aucun événement. Cliquez sur « + Nouvel événement » pour commencer.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default TimelineTab
