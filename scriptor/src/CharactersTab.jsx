import { useRef, useState } from 'react'

const SIDEBAR_PAGE_SIZE = 80

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function CharactersTab({
  characters,
  onAddCharacter,
  onUpdateCharacterField,
  onDeleteCharacter,
  selectedId,
  onSelectCharacter,
}) {
  const [templateMode, setTemplateMode] = useState('standard')
  const [listPage, setListPage] = useState(0)
  const imageInputRef = useRef(null)
  const selected = characters.find((c) => c.id === selectedId) ?? characters[0]
  const effectiveSelectedId = selected?.id ?? null
  const totalPages = Math.max(1, Math.ceil(characters.length / SIDEBAR_PAGE_SIZE))
  const safePage = Math.min(listPage, totalPages - 1)
  const pageStart = safePage * SIDEBAR_PAGE_SIZE
  const pagedCharacters = characters.slice(pageStart, pageStart + SIDEBAR_PAGE_SIZE)

  const handleImageSelect = async (e, characterId) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    try {
      const dataUrl = await readFileAsDataUrl(file)
      onUpdateCharacterField(characterId, 'image', dataUrl)
    } catch {
      // lecture image abandonnée/invalidée
    }
    e.target.value = ''
  }

  const handleRemoveImage = (characterId) => {
    onUpdateCharacterField(characterId, 'image', null)
  }

  return (
    <div className="characters-tab">
      <header className="characters-header">
        <h1 className="characters-title">Personnages</h1>
        <p className="characters-subtitle">
          Fiches des personnages de votre saga. Vous pourrez les associer aux scènes dans l&apos;onglet Écriture.
        </p>
      </header>

      <div className="characters-layout-bible">
        <aside className="characters-sidebar">
          <div className="characters-entries-list">
            {pagedCharacters.map((char) => (
              <button
                key={char.id}
                type="button"
                className={`characters-entry-btn ${char.id === effectiveSelectedId ? 'is-active' : ''}`}
                onClick={() => onSelectCharacter?.(char.id)}
              >
                {char.image ? (
                  <img src={char.image} alt="" className="characters-entry-thumb" />
                ) : (
                  <span className="characters-entry-thumb-placeholder">?</span>
                )}
                <span className="characters-entry-name">{char.name || 'Sans nom'}</span>
              </button>
            ))}
          </div>
          {characters.length > SIDEBAR_PAGE_SIZE && (
            <div className="sidebar-pager">
              <button
                type="button"
                className="sidebar-pager-btn"
                disabled={safePage === 0}
                onClick={() => setListPage((p) => Math.max(0, p - 1))}
              >
                Prec.
              </button>
              <span className="sidebar-pager-label">
                {safePage + 1}/{totalPages}
              </span>
              <button
                type="button"
                className="sidebar-pager-btn"
                disabled={safePage >= totalPages - 1}
                onClick={() => setListPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                Suiv.
              </button>
            </div>
          )}
          <div style={{ marginTop: '0.6rem' }}>
            <select
              className="characters-select"
              value={templateMode}
              onChange={(e) => setTemplateMode(e.target.value)}
              aria-label="Modèle de création"
            >
              <option value="standard">Modèle standard</option>
              <option value="empty">Fiche vide</option>
            </select>
          </div>
          <button
            type="button"
            className="characters-add-btn"
            onClick={() => onAddCharacter({ templateMode }, (newId) => onSelectCharacter?.(newId))}
          >
            + Nouveau personnage
          </button>
        </aside>

        <main className="characters-main">
          {characters.length === 0 ? (
            <div className="characters-empty-state">
              <p>Aucun personnage. Cliquez sur « + Nouveau personnage » pour commencer.</p>
            </div>
          ) : selected ? (
            <div className="characters-editor">
              <div className="characters-editor-header">
                <input
                  type="text"
                  className="characters-name-input"
                  value={selected.name ?? ''}
                  onChange={(e) => onUpdateCharacterField(selected.id, 'name', e.target.value)}
                  placeholder="Nom du personnage"
                />
                <button
                  type="button"
                  className="characters-delete-btn"
                  onClick={() => {
                    const index = characters.findIndex((c) => c.id === selected.id)
                    const next = characters[index + 1] ?? characters[index - 1]
                      if (next) onSelectCharacter?.(next.id)
                      else onSelectCharacter?.(null)
                    onDeleteCharacter(selected.id)
                  }}
                  title="Supprimer ce personnage"
                >
                  Supprimer
                </button>
              </div>

              <div className="characters-image-block">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="characters-image-input"
                  onChange={(e) => handleImageSelect(e, selected.id)}
                  aria-label="Charger une image"
                />
                {selected.image ? (
                  <div className="characters-image-preview-wrap">
                    <img src={selected.image} alt="" className="characters-image-preview" />
                    <button
                      type="button"
                      className="characters-image-remove"
                      onClick={() => handleRemoveImage(selected.id)}
                      title="Supprimer l'image"
                    >
                      Supprimer l&apos;image
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="characters-image-upload-btn"
                    onClick={() => imageInputRef.current?.click()}
                  >
                    Charger une image
                  </button>
                )}
              </div>

              <label className="characters-field">
                <span className="characters-field-label">Rôle / fonction</span>
                <input
                  type="text"
                  className="characters-role-input"
                  value={selected.role ?? ''}
                  onChange={(e) => onUpdateCharacterField(selected.id, 'role', e.target.value)}
                  placeholder="Protagoniste, antagoniste, secondaire..."
                />
              </label>

              <label className="characters-field">
                <span className="characters-field-label">Apparence</span>
                <textarea
                  className="summary-input"
                  rows={6}
                  value={selected.appearance ?? ''}
                  onChange={(e) => onUpdateCharacterField(selected.id, 'appearance', e.target.value)}
                  placeholder="Cheveux, tenue, signes distinctifs…"
                />
              </label>

              <label className="characters-field">
                <span className="characters-field-label">Biographie / passé</span>
                <textarea
                  className="summary-input"
                  rows={6}
                  value={selected.biography ?? ''}
                  onChange={(e) => onUpdateCharacterField(selected.id, 'biography', e.target.value)}
                  placeholder="Naissance, événements marquants, parcours…"
                />
              </label>

              <label className="characters-field">
                <span className="characters-field-label">Objectifs / motivations</span>
                <textarea
                  className="summary-input"
                  rows={5}
                  value={selected.goals ?? ''}
                  onChange={(e) => onUpdateCharacterField(selected.id, 'goals', e.target.value)}
                  placeholder="Ce qu’il veut, ce qui l’empêche…"
                />
              </label>

              <label className="characters-field">
                <span className="characters-field-label">Traits de personnalité</span>
                <textarea
                  className="summary-input"
                  rows={5}
                  value={selected.traits ?? ''}
                  onChange={(e) => onUpdateCharacterField(selected.id, 'traits', e.target.value)}
                  placeholder="Forces, faiblesses, manies…"
                />
              </label>

              <label className="characters-field">
                <span className="characters-field-label">Relations / liens</span>
                <textarea
                  className="summary-input"
                  rows={5}
                  value={selected.relationships ?? ''}
                  onChange={(e) => onUpdateCharacterField(selected.id, 'relationships', e.target.value)}
                  placeholder="Liens avec les autres personnages…"
                />
              </label>

              <label className="characters-field">
                <span className="characters-field-label">Notes</span>
                <textarea
                  className="summary-input"
                  rows={4}
                  value={selected.notes ?? ''}
                  onChange={(e) => onUpdateCharacterField(selected.id, 'notes', e.target.value)}
                  placeholder="Idées libres, rappels, éléments à réutiliser…"
                />
              </label>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  )
}

export default CharactersTab
