import { useState, useRef } from 'react'
import { createEmptyPlace } from './projectStore.js'

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function WorldMapTab({ currentSaga, onUpdateWorldMap }) {
  const mapImage = currentSaga?.worldMap?.mapImage ?? null
  const places = currentSaga?.worldMap?.places ?? []
  const [selectedId, setSelectedId] = useState(places[0]?.id ?? null)
  const imageInputRef = useRef(null)
  const mapImageInputRef = useRef(null)

  const effectiveSelectedId = places.some((p) => p.id === selectedId)
    ? selectedId
    : (places[0]?.id ?? null)
  const selected = places.find((p) => p.id === effectiveSelectedId) ?? places[0]

  const handleAddPlace = () => {
    const newPlace = createEmptyPlace()
    onUpdateWorldMap?.('add', newPlace)
    setSelectedId(newPlace.id)
  }

  const handleDeletePlace = (id) => {
    const index = places.findIndex((p) => p.id === id)
    if (index === -1) return
    const next = places[index + 1] ?? places[index - 1]
    onUpdateWorldMap?.('delete', id)
    setSelectedId(next?.id ?? null)
  }

  const handleUpdatePlace = (id, field, value) => {
    onUpdateWorldMap?.('update', { id, field, value })
  }

  const handleImageSelect = async (e, placeId) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    try {
      const dataUrl = await readFileAsDataUrl(file)
      handleUpdatePlace(placeId, 'image', dataUrl)
    } catch {
      // lecture image du lieu abandonnée/invalidée
    }
    e.target.value = ''
  }

  const handleRemoveImage = (placeId) => {
    handleUpdatePlace(placeId, 'image', null)
  }

  const handleMapImageSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    try {
      const dataUrl = await readFileAsDataUrl(file)
      onUpdateWorldMap?.('setMapImage', dataUrl)
    } catch {
      // lecture carte abandonnée/invalidée
    }
    e.target.value = ''
  }

  const handleRemoveMapImage = () => {
    onUpdateWorldMap?.('setMapImage', null)
  }

  if (!currentSaga) {
    return (
      <div className="worldmap-tab empty">
        <p>Sélectionnez une saga dans le panneau de gauche.</p>
      </div>
    )
  }

  return (
    <div className="worldmap-tab">
      <header className="worldmap-header">
        <h1 className="worldmap-title">Carte du monde</h1>
        <p className="worldmap-subtitle">
          Chargez la carte globale de votre univers en haut, puis ajoutez les lieux en dessous.
        </p>
      </header>

      <section className="worldmap-main-map">
        <input
          ref={mapImageInputRef}
          type="file"
          accept="image/*"
          className="worldmap-main-map-input"
          onChange={handleMapImageSelect}
          aria-label="Charger la carte du monde"
        />
        {mapImage ? (
          <div className="worldmap-main-map-wrap">
            <img src={mapImage} alt="Carte du monde" className="worldmap-main-map-img" />
            <div className="worldmap-main-map-actions">
              <button
                type="button"
                className="worldmap-main-map-btn worldmap-main-map-btn-change"
                onClick={() => mapImageInputRef.current?.click()}
              >
                Changer la carte
              </button>
              <button
                type="button"
                className="worldmap-main-map-btn worldmap-main-map-btn-remove"
                onClick={handleRemoveMapImage}
              >
                Supprimer la carte
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="worldmap-main-map-upload"
            onClick={() => mapImageInputRef.current?.click()}
          >
            Charger la carte du monde
          </button>
        )}
      </section>

      <h2 className="worldmap-places-title">Lieux</h2>
      <p className="worldmap-places-subtitle">
        Ajoutez des lieux (nom, description, image optionnelle) pour repérer les endroits de votre saga.
      </p>

      <div className="worldmap-layout">
        <aside className="worldmap-sidebar">
          <div className="worldmap-entries-list">
            {places.map((place) => (
              <button
                key={place.id}
                type="button"
                className={`worldmap-entry-btn ${place.id === effectiveSelectedId ? 'is-active' : ''}`}
                onClick={() => setSelectedId(place.id)}
              >
                {place.image ? (
                  <img src={place.image} alt="" className="worldmap-entry-thumb" />
                ) : (
                  <span className="worldmap-entry-thumb-placeholder">⌖</span>
                )}
                <span className="worldmap-entry-name">{place.title || 'Sans titre'}</span>
              </button>
            ))}
          </div>
          <button type="button" className="worldmap-add-btn" onClick={handleAddPlace}>
            + Nouveau lieu
          </button>
        </aside>

        <main className="worldmap-main">
          {selected ? (
            <div className="worldmap-editor">
              <div className="worldmap-editor-header">
                <input
                  type="text"
                  className="worldmap-title-input"
                  value={selected.title ?? ''}
                  onChange={(e) => handleUpdatePlace(selected.id, 'title', e.target.value)}
                  placeholder="Nom du lieu"
                />
                <button
                  type="button"
                  className="worldmap-delete-btn"
                  onClick={() => handleDeletePlace(selected.id)}
                  title="Supprimer ce lieu"
                >
                  Supprimer
                </button>
              </div>

              <div className="worldmap-image-block">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="worldmap-image-input"
                  onChange={(e) => handleImageSelect(e, selected.id)}
                  aria-label="Charger une image"
                />
                {selected.image ? (
                  <div className="worldmap-image-preview-wrap">
                    <img src={selected.image} alt="" className="worldmap-image-preview" />
                    <button
                      type="button"
                      className="worldmap-image-remove"
                      onClick={() => handleRemoveImage(selected.id)}
                      title="Supprimer l'image"
                    >
                      Supprimer l&apos;image
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="worldmap-image-upload-btn"
                    onClick={() => imageInputRef.current?.click()}
                  >
                    Charger une image (carte, croquis...)
                  </button>
                )}
              </div>

              <label className="worldmap-field">
                <span className="worldmap-field-label">Description</span>
                <textarea
                  className="worldmap-description-input"
                  value={selected.description ?? ''}
                  onChange={(e) => handleUpdatePlace(selected.id, 'description', e.target.value)}
                  placeholder="Description du lieu, rôle dans l'histoire..."
                  rows={8}
                />
              </label>
            </div>
          ) : (
            <div className="worldmap-empty-state">
              <p>Aucun lieu. Cliquez sur « + Nouveau lieu » pour commencer.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default WorldMapTab
