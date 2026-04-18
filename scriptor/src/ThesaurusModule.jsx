import { useState, useRef, useEffect } from 'react'
import { routeIntent, searchInFamille, FAMILLES_DISPONIBLES } from './intentRouter.js'

const FAMILLE_COLORS = {
  emotions: '#7c6fcd',
  etatsPhysiques: '#5b9bd5',
  traitsDeCaractere: '#e8a838',
  conflits: '#d95f5f',
  blessuresEmotionnelles: '#c0697a',
  dynamiquesRelationnelles: '#5ca87f',
  motivations: '#e07840',
  lieux: '#6fa5a5',
  atmospheres: '#8a7ea8',
  meteo: '#6baec6',
  elementsSensoriels: '#5b9b6b',
  objetsNarratifs: '#b07840',
  professions: '#7a8ca0',
}

function getEntrySnippet(entry) {
  const list =
    entry.signesPhysiques ||
    entry.comportements ||
    entry.formesConscientes ||
    entry.formesVisibles ||
    entry.elements ||
    []
  return list.slice(0, 3)
}

function renderList(items, title) {
  if (!Array.isArray(items) || items.length === 0) return null
  return (
    <div className="tm-detail-section">
      <h4>{title}</h4>
      <ul>
        {items.map((item, i) => (
          <li key={i}>{typeof item === 'object' ? JSON.stringify(item) : item}</li>
        ))}
      </ul>
    </div>
  )
}

function EntryDetail({ entry }) {
  return (
    <div className="tm-detail">
      {renderList(entry.signesPhysiques, 'Signes physiques')}
      {renderList(entry.sensationsInternes, 'Sensations internes')}
      {renderList(entry.pensees, 'Pensées')}
      {renderList(entry.effetsVoixLangage, 'Voix et langage')}
      {renderList(entry.comportements, 'Comportements')}
      {renderList(entry.masquesPossibles, 'Masques possibles')}
      {renderList(entry.evolutionsPossibles, 'Évolutions possibles')}
      {renderList(entry.formesConscientes, 'Formes conscientes')}
      {renderList(entry.formesInconscientes, 'Formes inconscientes')}
      {renderList(entry.signesComportementaux, 'Signes comportementaux')}
      {renderList(entry.enjeux, 'Enjeux')}
      {renderList(entry.risques, 'Risques')}
      {renderList(entry.elements, 'Éléments sensoriels')}
      {renderList(entry.emotionsTypiques, 'Émotions typiques')}
      {renderList(entry.forcesEnPresence, 'Forces en présence')}
      {renderList(entry.declencheursFrequents, 'Déclencheurs fréquents')}
      {renderList(entry.voiesDeResolution, 'Voies de résolution')}
      {renderList(entry.croyancesNegativesInduites, 'Croyances induites')}
      {renderList(entry.comportementsDefensifs, 'Comportements défensifs')}
      {renderList(entry.cheminsVersResolution, 'Chemins vers résolution')}
      {renderList(entry.manifestationsPositives, 'Manifestations positives')}
      {renderList(entry.manifestationsNegatives, 'Manifestations négatives')}
      {renderList(entry.associationsNarratives, 'Associations narratives')}
      {renderList(entry.usagesTypiques, 'Usages typiques')}
      {renderList(entry.notesEditoriales, 'Notes éditoriales')}
    </div>
  )
}

function EntryCard({ entry }) {
  const [open, setOpen] = useState(false)
  const snippet = getEntrySnippet(entry)
  const cardRef = useRef(null)

  useEffect(() => {
    if (!open || !cardRef.current) return
    const id = requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    })
    return () => cancelAnimationFrame(id)
  }, [open])

  const toggleOpen = () => {
    setOpen((v) => !v)
  }

  return (
    <div className="tm-entry-card" ref={cardRef}>
      <div
        className="tm-entry-header"
        onClick={toggleOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggleOpen()
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className="tm-entry-left">
          <span className="tm-entry-label">{entry.label || entry.id}</span>
          {(entry.famille || entry.groupe) && (
            <span className="tm-entry-sous-famille">{entry.famille || entry.groupe}</span>
          )}
        </div>
        <span className="tm-entry-toggle">{open ? '▲' : '▼'}</span>
      </div>
      {entry.definitionCourte && <p className="tm-entry-definition">{entry.definitionCourte}</p>}
      {snippet.length > 0 && !open && (
        <ul className="tm-entry-snippet">
          {snippet.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
      {open && <EntryDetail entry={entry} />}
    </div>
  )
}

function PisteBlock({ piste }) {
  const color = FAMILLE_COLORS[piste.famille] || '#888'
  return (
    <div className="tm-piste-block">
      <div className="tm-piste-header" style={{ borderLeftColor: color }}>
        <span className="tm-piste-label" style={{ color }}>
          {piste.label}
        </span>
      </div>
      {piste.entries.length === 0 ? (
        <p className="tm-piste-empty">Aucune entrée trouvée.</p>
      ) : (
        <div className="tm-piste-entries">
          {piste.entries.map((entry, idx) => (
            <EntryCard key={entry.id ?? entry.label ?? idx} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function ThesaurusModule({ onClose }) {
  const [inputValue, setInputValue] = useState('')
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [recalageOpen, setRecalageOpen] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = inputValue.trim()
    if (!trimmed) return
    setQuery(trimmed)
    setResult(routeIntent(trimmed))
    setRecalageOpen(false)
  }

  function handleRecalage(familleId) {
    if (!query) return
    const entries = searchInFamille(familleId, query, 8)
    const label = FAMILLES_DISPONIBLES.find((f) => f.id === familleId)?.label || familleId
    setResult({
      type: 'intent',
      reformulation: `Résultats dans « ${label} » :`,
      pistes: [{ famille: familleId, label, score: 1, entries }],
      rawQuery: query,
    })
    setRecalageOpen(false)
  }

  function handleReset() {
    setInputValue('')
    setQuery('')
    setResult(null)
    setRecalageOpen(false)
  }

  return (
    <div className="tm-module">
      <div className="tm-header">
        <h2 className="tm-title">Thésaurus narratif</h2>
        {onClose && (
          <button type="button" className="tm-close-btn" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      <form className="tm-search-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="tm-search-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ex. : mon personnage explose, scène trop plate, personnage sans profondeur…"
          autoComplete="off"
        />
        <button type="submit" className="tm-search-btn">
          Chercher
        </button>
        {result && (
          <button type="button" className="tm-reset-btn" onClick={handleReset}>
            Effacer
          </button>
        )}
      </form>

      {result && (
        <div className="tm-results">
          {result.reformulation && <p className="tm-reformulation">{result.reformulation}</p>}
          {result.type !== 'empty' && (
            <button
              type="button"
              className="tm-recalage-toggle"
              onClick={() => setRecalageOpen((v) => !v)}
            >
              {recalageOpen ? '▲ Fermer' : 'Pas la bonne famille ? Corriger →'}
            </button>
          )}
          {recalageOpen && (
            <div className="tm-recalage">
              <span className="tm-recalage-label">Plutôt :</span>
              {FAMILLES_DISPONIBLES.map((f) => (
                <button key={f.id} type="button" className="tm-recalage-btn" onClick={() => handleRecalage(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
          {result.pistes.map((piste, i) => (
            <PisteBlock key={`${piste.famille}-${i}`} piste={piste} />
          ))}
        </div>
      )}
    </div>
  )
}
