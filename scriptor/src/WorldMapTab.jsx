import { useEffect, useMemo, useRef, useState } from 'react'
import { createEmptyPlace } from './projectStore.js'

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const MAP_SITES = [
  {
    id: 'midjourney',
    name: 'Midjourney',
    url: 'https://www.midjourney.com/',
    docs: 'https://docs.midjourney.com/hc/en-us/articles/32023408776205-Prompt-Basics',
    strength:
      'Très bon pour explorer rapidement des directions visuelles et un style cartographique “epic fantasy”.',
    tutorial: [
      'Ouvrez Midjourney puis créez une image avec votre superprompt.',
      'Ajoutez des variantes en conservant le même seed pour tester plusieurs compositions.',
      'Affinez avec des paramètres de style et ratio (ex. 3:2 ou 16:9 selon votre usage).',
    ],
    extra: '--ar 3:2 --stylize 200 --v 7',
  },
  {
    id: 'leonardo',
    name: 'Leonardo AI',
    url: 'https://app.leonardo.ai/',
    docs: 'https://intercom.help/leonardo-ai/en/articles/8067671-prompting-tips-tricks',
    strength:
      'Très utile pour itérer précisément (inpainting/outpainting) et produire des variantes cohérentes.',
    tutorial: [
      'Créez une génération “Image” avec votre superprompt.',
      'Activez un mode de guidance élevé puis itérez par petites modifications.',
      'Utilisez l’édition locale pour corriger une zone (fleuve, frontière, légende).',
    ],
    extra: 'Guidance 7-10, puis variation légère entre chaque itération.',
  },
  {
    id: 'ideogram',
    name: 'Ideogram',
    url: 'https://ideogram.ai/',
    docs: 'https://docs.ideogram.ai/using-ideogram/prompting-guide',
    strength:
      'Particulièrement intéressant si vous voulez du texte lisible dans l’image (titre, légende, labels).',
    tutorial: [
      'Placez les libellés prioritaires entre guillemets dans le superprompt.',
      'Générez d’abord une version lisible (labels), puis une version plus artistique.',
      'Combinez les deux versions en post-traitement si nécessaire.',
    ],
    extra: 'Gardez les textes courts (2-6 mots) pour améliorer la lisibilité.',
  },
]

const WIZARD_DEFAULTS = {
  targetSiteId: 'midjourney',
  mapScope: 'continent unique',
  narrativeGenre: 'fantasy épique',
  eraLevel: 'médiéval',
  visualStyle: 'parchemin illustré à la main',
  colorMood: 'sépia, encres brunes, accents bleu nuit',
  orientation: 'horizontal',
  geographyShape:
    'grande masse continentale à l’ouest, archipel à l’est, mer intérieure centrale',
  relief: 'chaînes montagneuses marquées, hauts plateaux au nord, plaines fertiles au sud',
  climateBiomes:
    'toundra au nord, forêts tempérées au centre, steppe au sud-est, marais côtiers au sud-ouest',
  hydrology:
    'deux fleuves majeurs partant des montagnes vers la mer intérieure, deltas dans les plaines',
  civilizations:
    '3 royaumes, 2 cités marchandes, 1 zone frontalière disputée, routes commerciales principales',
  landmarks:
    'ruines antiques, forteresse sur pic rocheux, forêt sacrée, île volcanique',
  scaleDistance:
    'échelle 1 cm = 80 km, distances crédibles entre capitales (3-8 jours à cheval)',
  worldScalePreset: 'continent',
  travelReferenceMode: 'cheval',
  travelDaysBetweenCapitals: '6',
  promptTuning: 'équilibré',
  labelsLanguage:
    'noms francophones évocateurs, toponymes cohérents par région, hiérarchie de labels claire',
  cartographyElements:
    'rose des vents, cartouche titre, grille discrète, légende des biomes, frontières politiques fines',
  negativeConstraints:
    'pas de perspective 3D, pas de photo réaliste, pas de texte illisible, pas de symboles modernes',
}

const SCALE_PRESETS = [
  { id: 'petit-royaume', label: 'Petit royaume', mapWidthKm: 450 },
  { id: 'grand-royaume', label: 'Grand royaume', mapWidthKm: 900 },
  { id: 'continent', label: 'Continent', mapWidthKm: 2600 },
  { id: 'supercontinent', label: 'Supercontinent', mapWidthKm: 5200 },
  { id: 'monde-entier', label: 'Monde entier', mapWidthKm: 12000 },
]

const TRAVEL_SPEEDS = {
  pied: 28,
  cheval: 55,
  navire: 145,
}

const WIZARD_STEPS = [
  { id: 'vision', title: '1) Vision globale' },
  { id: 'terrain', title: '2) Géographie & climat' },
  { id: 'civilization', title: '3) Civilisations & repères' },
  { id: 'scale', title: '4) Échelle simplifiée' },
  { id: 'final', title: '5) Finalisation & export' },
]

const WORLD_PRESETS = [
  {
    id: 'classic-fantasy',
    label: 'Fantasy classique',
    summary: 'Royaumes médiévaux, relief varié, style parchemin lisible.',
    values: {
      narrativeGenre: 'fantasy épique classique',
      eraLevel: 'médiéval',
      visualStyle: 'parchemin illustré à la main',
      colorMood: 'sépia, encres brunes, accents bleu nuit',
      worldScalePreset: 'continent',
      travelReferenceMode: 'cheval',
      travelDaysBetweenCapitals: '6',
    },
  },
  {
    id: 'dark-fantasy',
    label: 'Dark fantasy',
    summary: 'Ambiance sombre, frontières hostiles, terrains durs et ruinés.',
    values: {
      narrativeGenre: 'dark fantasy',
      eraLevel: 'médiéval brutal',
      visualStyle: 'carte ancienne sombre, encre usée',
      colorMood: 'gris anthracite, brun brûlé, rouge sombre',
      climateBiomes: 'forêts noires, marais froids, landes, montagnes hostiles',
      worldScalePreset: 'grand-royaume',
      travelReferenceMode: 'cheval',
      travelDaysBetweenCapitals: '4',
    },
  },
  {
    id: 'historical-low-fantasy',
    label: 'Low fantasy historique',
    summary: 'Monde proche du réel, distances crédibles, cartographie sobre.',
    values: {
      narrativeGenre: 'low fantasy historique',
      eraLevel: 'proto-renaissance',
      visualStyle: 'carte topographique ancienne, style atlas',
      colorMood: 'parchemin clair, encre noire, rehauts ocres',
      cartographyElements: 'échelle lisible, rose des vents discrète, frontières, routes, relief',
      worldScalePreset: 'grand-royaume',
      travelReferenceMode: 'pied',
      travelDaysBetweenCapitals: '8',
    },
  },
  {
    id: 'planetary-scifi',
    label: 'Planétaire SF',
    summary: 'Grandes masses, zones climatiques larges, infrastructures majeures.',
    values: {
      narrativeGenre: 'science-fiction planétaire',
      eraLevel: 'futur avancé',
      visualStyle: 'atlas planétaire mixte scientifique/artistique',
      colorMood: 'bleu acier, sable froid, turquoise atmosphérique',
      mapScope: 'monde entier',
      worldScalePreset: 'monde-entier',
      travelReferenceMode: 'navire',
      travelDaysBetweenCapitals: '10',
    },
  },
]

const COMPLETION_KEYS = [
  'mapScope',
  'narrativeGenre',
  'eraLevel',
  'visualStyle',
  'geographyShape',
  'relief',
  'climateBiomes',
  'hydrology',
  'civilizations',
  'landmarks',
  'scaleDistance',
  'labelsLanguage',
  'cartographyElements',
  'negativeConstraints',
]

const CRITICAL_KEYS = [
  'mapScope',
  'narrativeGenre',
  'visualStyle',
  'geographyShape',
  'relief',
  'hydrology',
  'civilizations',
  'scaleDistance',
]

function normalizeWizard(raw) {
  if (!raw || typeof raw !== 'object') return { ...WIZARD_DEFAULTS }
  const out = { ...WIZARD_DEFAULTS }
  for (const key of Object.keys(WIZARD_DEFAULTS)) {
    const v = raw[key]
    out[key] = typeof v === 'string' ? v : WIZARD_DEFAULTS[key]
  }
  return out
}

function WorldMapTab({ currentSaga, onUpdateWorldMap }) {
  const mapImage = currentSaga?.worldMap?.mapImage ?? null
  const places = currentSaga?.worldMap?.places ?? []
  const persistedWizard = currentSaga?.worldMap?.promptWizard ?? null
  const [selectedId, setSelectedId] = useState(places[0]?.id ?? null)
  const imageInputRef = useRef(null)
  const mapImageInputRef = useRef(null)
  const [wizard, setWizard] = useState(() => normalizeWizard(persistedWizard))
  const [copyStatus, setCopyStatus] = useState('')
  const [wizardStep, setWizardStep] = useState(0)
  const [selectedPresetId, setSelectedPresetId] = useState(WORLD_PRESETS[0].id)

  const effectiveSelectedId = places.some((p) => p.id === selectedId)
    ? selectedId
    : (places[0]?.id ?? null)
  const selected = places.find((p) => p.id === effectiveSelectedId) ?? places[0]
  const selectedSite = MAP_SITES.find((s) => s.id === wizard.targetSiteId) ?? MAP_SITES[0]
  const scalePreset =
    SCALE_PRESETS.find((p) => p.id === wizard.worldScalePreset) ?? SCALE_PRESETS[2]
  const travelModeLabel =
    wizard.travelReferenceMode === 'pied'
      ? 'à pied'
      : wizard.travelReferenceMode === 'navire'
        ? 'en navire'
        : 'à cheval'
  const travelDays = Number.parseFloat(wizard.travelDaysBetweenCapitals)
  const travelSpeed = TRAVEL_SPEEDS[wizard.travelReferenceMode] || TRAVEL_SPEEDS.cheval
  const estimatedCapitalDistanceKm =
    Number.isFinite(travelDays) && travelDays > 0 ? Math.round(travelDays * travelSpeed) : null

  const scaleHint = useMemo(() => {
    const lines = [
      `Taille suggérée du monde cartographié : ~${scalePreset.mapWidthKm.toLocaleString('fr-FR')} km de large (${scalePreset.label.toLowerCase()}).`,
    ]
    if (estimatedCapitalDistanceKm) {
      lines.push(
        `Repère voyage : ${travelDays} jour(s) ${travelModeLabel} entre deux capitales ≈ ${estimatedCapitalDistanceKm.toLocaleString('fr-FR')} km.`,
      )
    } else {
      lines.push("Repère voyage : renseignez un nombre de jours pour obtenir une distance estimée.")
    }
    lines.push(
      "Astuce simple : si vos villes paraissent trop proches dans l'histoire, augmentez la taille du monde ou les jours de trajet.",
    )
    return lines.join(' ')
  }, [estimatedCapitalDistanceKm, scalePreset, travelDays, travelModeLabel])

  const completion = useMemo(() => {
    const filled = COMPLETION_KEYS.filter((key) => String(wizard[key] || '').trim().length > 0).length
    const percent = Math.round((filled / COMPLETION_KEYS.length) * 100)
    return { filled, total: COMPLETION_KEYS.length, percent }
  }, [wizard])

  const missingCriticalLabels = useMemo(() => {
    const labels = {
      mapScope: 'Portée de carte',
      narrativeGenre: 'Genre narratif',
      visualStyle: 'Style visuel',
      geographyShape: 'Forme globale',
      relief: 'Relief',
      hydrology: 'Hydrographie',
      civilizations: 'Civilisations',
      scaleDistance: 'Échelle/distances',
    }
    return CRITICAL_KEYS.filter((key) => String(wizard[key] || '').trim().length === 0).map((key) => labels[key] || key)
  }, [wizard])

  useEffect(() => {
    setWizard(normalizeWizard(persistedWizard))
  }, [persistedWizard, currentSaga?.id])

  const superPrompt = useMemo(() => {
    return [
      'Create a high-detail fantasy world map for a novel writing project.',
      '',
      `Primary output target: ${selectedSite.name}.`,
      `Scope: ${wizard.mapScope}.`,
      `Genre and narrative tone: ${wizard.narrativeGenre}.`,
      `Era / tech level: ${wizard.eraLevel}.`,
      `Visual style: ${wizard.visualStyle}.`,
      `Color mood: ${wizard.colorMood}.`,
      `Canvas orientation: ${wizard.orientation}.`,
      '',
      'Geography and terrain:',
      `- Macro shape: ${wizard.geographyShape}`,
      `- Relief: ${wizard.relief}`,
      `- Climate and biomes: ${wizard.climateBiomes}`,
      `- Hydrology and coasts: ${wizard.hydrology}`,
      '',
      'Civilization and storytelling anchors:',
      `- Political/cultural layout: ${wizard.civilizations}`,
      `- Landmarks and unique places: ${wizard.landmarks}`,
      `- Distances and travel logic: ${wizard.scaleDistance}`,
      `- Beginner scale guidance: ${scaleHint}`,
      `- Prompt tuning preference: ${wizard.promptTuning}`,
      '',
      'Cartography and labeling:',
      `- Label strategy: ${wizard.labelsLanguage}`,
      `- Mandatory cartographic elements: ${wizard.cartographyElements}`,
      '',
      'Hard constraints:',
      `- ${wizard.negativeConstraints}`,
      '- Keep geographic logic coherent (rivers start high, flow to lower basins).',
      '- Preserve clean readability and hierarchy between landforms, borders, roads, and labels.',
      '',
      'Deliverable:',
      '- One polished map render, suitable for novel worldbuilding reference.',
      '- Prioritize clarity and composition over excessive ornamentation.',
      selectedSite.extra ? `- Recommended platform suffix: ${selectedSite.extra}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }, [scaleHint, selectedSite, wizard])

  const updateWizard = (field, value) => {
    setWizard((prev) => {
      const next = { ...prev, [field]: value }
      onUpdateWorldMap?.('setPromptWizard', next)
      return next
    })
  }

  const updateWizardBulk = (patch) => {
    setWizard((prev) => {
      const next = { ...prev, ...patch }
      onUpdateWorldMap?.('setPromptWizard', next)
      return next
    })
  }

  const goToStep = (delta) => {
    setWizardStep((prev) => {
      const max = WIZARD_STEPS.length - 1
      const next = prev + delta
      if (next < 0) return 0
      if (next > max) return max
      return next
    })
  }

  const applyScaleHintToPrompt = () => {
    updateWizard('scaleDistance', scaleHint)
  }

  const applyPreset = () => {
    const preset = WORLD_PRESETS.find((p) => p.id === selectedPresetId)
    if (!preset) return
    updateWizardBulk(preset.values)
    setCopyStatus(`Préconfiguration appliquée : ${preset.label}.`)
    setTimeout(() => setCopyStatus(''), 2000)
  }

  const resetWizard = () => {
    const next = { ...WIZARD_DEFAULTS }
    setWizard(next)
    onUpdateWorldMap?.('setPromptWizard', next)
    setWizardStep(0)
    setCopyStatus('Questionnaire réinitialisé.')
    setTimeout(() => setCopyStatus(''), 1800)
  }

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(superPrompt)
      setCopyStatus('Superprompt copié dans le presse-papiers.')
      setTimeout(() => setCopyStatus(''), 2200)
    } catch {
      setCopyStatus("Copie impossible automatiquement. Sélectionnez puis copiez le texte manuellement.")
    }
  }

  const openGeneratorSite = () => {
    if (typeof window === 'undefined') return
    window.open(selectedSite.url, '_blank', 'noopener,noreferrer')
  }

  const copyAndOpenSite = async () => {
    await copyPrompt()
    openGeneratorSite()
  }

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

      <section className="worldmap-generator" aria-labelledby="worldmap-generator-title">
        <h2 id="worldmap-generator-title" className="worldmap-places-title">
          Générateur de carte IA (questionnaire + superprompt)
        </h2>
        <p className="worldmap-places-subtitle">
          Complétez le questionnaire ci-dessous. Scriptor fabrique ensuite un superprompt prêt à coller
          dans un générateur d&apos;images puissant.
        </p>

        <div className="worldmap-quick-tools">
          <label className="worldmap-field worldmap-field-preset">
            <span className="worldmap-field-label">Préconfiguration rapide</span>
            <select
              className="worldmap-select"
              value={selectedPresetId}
              onChange={(e) => setSelectedPresetId(e.target.value)}
            >
              {WORLD_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="worldmap-main-map-btn worldmap-main-map-btn-change" onClick={applyPreset}>
            Appliquer le preset
          </button>
          <button type="button" className="worldmap-main-map-btn worldmap-main-map-btn-remove" onClick={resetWizard}>
            Réinitialiser
          </button>
        </div>

        <div className="worldmap-preset-help">
          {WORLD_PRESETS.find((p) => p.id === selectedPresetId)?.summary}
        </div>

        <div className="worldmap-completion" role="status" aria-live="polite">
          <div className="worldmap-completion-bar">
            <span style={{ width: `${completion.percent}%` }} />
          </div>
          <p className="worldmap-completion-text">
            Questionnaire rempli à {completion.percent}% ({completion.filled}/{completion.total}).
          </p>
          {missingCriticalLabels.length ? (
            <p className="worldmap-completion-missing">
              À compléter en priorité : {missingCriticalLabels.join(', ')}.
            </p>
          ) : (
            <p className="worldmap-completion-missing is-ready">
              Les champs essentiels sont remplis. Vous pouvez générer des variantes de qualité.
            </p>
          )}
        </div>

        <div className="worldmap-wizard-steps" role="tablist" aria-label="Étapes du questionnaire carte">
          {WIZARD_STEPS.map((step, idx) => (
            <button
              key={step.id}
              type="button"
              className={`worldmap-wizard-step ${idx === wizardStep ? 'is-active' : ''}`}
              onClick={() => setWizardStep(idx)}
            >
              {step.title}
            </button>
          ))}
        </div>

        <div className="worldmap-wizard-card">
          {wizardStep === 0 ? (
            <div className="worldmap-prompt-grid">
              <label className="worldmap-field">
                <span className="worldmap-field-label">Site cible</span>
                <select
                  className="worldmap-select"
                  value={wizard.targetSiteId}
                  onChange={(e) => updateWizard('targetSiteId', e.target.value)}
                >
                  {MAP_SITES.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="worldmap-field">
                <span className="worldmap-field-label">Portée de carte</span>
                <input
                  type="text"
                  className="worldmap-title-input"
                  value={wizard.mapScope}
                  onChange={(e) => updateWizard('mapScope', e.target.value)}
                />
              </label>
              <label className="worldmap-field">
                <span className="worldmap-field-label">Genre narratif</span>
                <input
                  type="text"
                  className="worldmap-title-input"
                  value={wizard.narrativeGenre}
                  onChange={(e) => updateWizard('narrativeGenre', e.target.value)}
                />
              </label>
              <label className="worldmap-field">
                <span className="worldmap-field-label">Époque</span>
                <input
                  type="text"
                  className="worldmap-title-input"
                  value={wizard.eraLevel}
                  onChange={(e) => updateWizard('eraLevel', e.target.value)}
                />
              </label>
              <label className="worldmap-field">
                <span className="worldmap-field-label">Style visuel</span>
                <input
                  type="text"
                  className="worldmap-title-input"
                  value={wizard.visualStyle}
                  onChange={(e) => updateWizard('visualStyle', e.target.value)}
                />
              </label>
              <label className="worldmap-field">
                <span className="worldmap-field-label">Palette</span>
                <input
                  type="text"
                  className="worldmap-title-input"
                  value={wizard.colorMood}
                  onChange={(e) => updateWizard('colorMood', e.target.value)}
                />
              </label>
            </div>
          ) : null}

          {wizardStep === 1 ? (
            <div className="worldmap-prompt-grid">
              <label className="worldmap-field worldmap-field-full">
                <span className="worldmap-field-label">Forme globale</span>
                <textarea className="worldmap-description-input" rows={4} value={wizard.geographyShape} onChange={(e) => updateWizard('geographyShape', e.target.value)} />
              </label>
              <label className="worldmap-field worldmap-field-full">
                <span className="worldmap-field-label">Relief</span>
                <textarea className="worldmap-description-input" rows={4} value={wizard.relief} onChange={(e) => updateWizard('relief', e.target.value)} />
              </label>
              <label className="worldmap-field worldmap-field-full">
                <span className="worldmap-field-label">Climats & biomes</span>
                <textarea className="worldmap-description-input" rows={4} value={wizard.climateBiomes} onChange={(e) => updateWizard('climateBiomes', e.target.value)} />
              </label>
              <label className="worldmap-field worldmap-field-full">
                <span className="worldmap-field-label">Hydrographie</span>
                <textarea className="worldmap-description-input" rows={4} value={wizard.hydrology} onChange={(e) => updateWizard('hydrology', e.target.value)} />
              </label>
            </div>
          ) : null}

          {wizardStep === 2 ? (
            <div className="worldmap-prompt-grid">
              <label className="worldmap-field worldmap-field-full">
                <span className="worldmap-field-label">Civilisations & frontières</span>
                <textarea className="worldmap-description-input" rows={4} value={wizard.civilizations} onChange={(e) => updateWizard('civilizations', e.target.value)} />
              </label>
              <label className="worldmap-field worldmap-field-full">
                <span className="worldmap-field-label">Landmarks</span>
                <textarea className="worldmap-description-input" rows={4} value={wizard.landmarks} onChange={(e) => updateWizard('landmarks', e.target.value)} />
              </label>
              <label className="worldmap-field worldmap-field-full">
                <span className="worldmap-field-label">Langue des labels</span>
                <textarea className="worldmap-description-input" rows={3} value={wizard.labelsLanguage} onChange={(e) => updateWizard('labelsLanguage', e.target.value)} />
              </label>
              <label className="worldmap-field worldmap-field-full">
                <span className="worldmap-field-label">Éléments cartographiques</span>
                <textarea className="worldmap-description-input" rows={3} value={wizard.cartographyElements} onChange={(e) => updateWizard('cartographyElements', e.target.value)} />
              </label>
            </div>
          ) : null}

          {wizardStep === 3 ? (
            <div className="worldmap-prompt-grid">
              <label className="worldmap-field">
                <span className="worldmap-field-label">Taille du monde (simple)</span>
                <select
                  className="worldmap-select"
                  value={wizard.worldScalePreset}
                  onChange={(e) => updateWizard('worldScalePreset', e.target.value)}
                >
                  {SCALE_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="worldmap-field">
                <span className="worldmap-field-label">Mode de voyage de référence</span>
                <select
                  className="worldmap-select"
                  value={wizard.travelReferenceMode}
                  onChange={(e) => updateWizard('travelReferenceMode', e.target.value)}
                >
                  <option value="pied">À pied</option>
                  <option value="cheval">À cheval</option>
                  <option value="navire">En navire</option>
                </select>
              </label>
              <label className="worldmap-field">
                <span className="worldmap-field-label">Jours entre 2 capitales (ordre d’idée)</span>
                <input
                  type="number"
                  min="1"
                  max="40"
                  className="worldmap-title-input"
                  value={wizard.travelDaysBetweenCapitals}
                  onChange={(e) => updateWizard('travelDaysBetweenCapitals', e.target.value)}
                />
              </label>
              <div className="worldmap-scale-hint worldmap-field-full" role="note">
                {scaleHint}
              </div>
              <label className="worldmap-field worldmap-field-full">
                <span className="worldmap-field-label">Texte échelle/distances utilisé dans le prompt</span>
                <textarea
                  className="worldmap-description-input"
                  rows={4}
                  value={wizard.scaleDistance}
                  onChange={(e) => updateWizard('scaleDistance', e.target.value)}
                />
              </label>
              <div className="worldmap-superprompt-actions worldmap-field-full">
                <button type="button" className="worldmap-add-btn" onClick={applyScaleHintToPrompt}>
                  Utiliser automatiquement l&apos;estimation ci-dessus
                </button>
              </div>
            </div>
          ) : null}

          {wizardStep === 4 ? (
            <div className="worldmap-prompt-grid">
              <label className="worldmap-field">
                <span className="worldmap-field-label">Réglage du prompt</span>
                <select
                  className="worldmap-select"
                  value={wizard.promptTuning}
                  onChange={(e) => updateWizard('promptTuning', e.target.value)}
                >
                  <option value="équilibré">Équilibré (recommandé)</option>
                  <option value="lisibilité maximale">Lisibilité maximale</option>
                  <option value="artistique cinématique">Artistique cinématique</option>
                  <option value="atlas technique">Atlas technique</option>
                </select>
              </label>
              <label className="worldmap-field worldmap-field-full">
                <span className="worldmap-field-label">Contraintes négatives (à exclure)</span>
                <textarea
                  className="worldmap-description-input"
                  rows={4}
                  value={wizard.negativeConstraints}
                  onChange={(e) => updateWizard('negativeConstraints', e.target.value)}
                />
              </label>
              <div className="worldmap-scale-hint worldmap-field-full">
                Vérification rapide : copiez le superprompt puis générez 2 à 4 variantes, gardez la
                meilleure composition, et itérez ensuite sur les détails (frontières, légendes, routes).
              </div>
            </div>
          ) : null}

          <div className="worldmap-wizard-nav">
            <button type="button" className="worldmap-main-map-btn worldmap-main-map-btn-change" onClick={() => goToStep(-1)} disabled={wizardStep === 0}>
              Précédent
            </button>
            <span className="worldmap-copy-status">
              Étape {wizardStep + 1} / {WIZARD_STEPS.length}
            </span>
            <button type="button" className="worldmap-main-map-btn worldmap-main-map-btn-change" onClick={() => goToStep(1)} disabled={wizardStep === WIZARD_STEPS.length - 1}>
              Suivant
            </button>
          </div>
        </div>

        <details className="worldmap-advanced-details">
          <summary>Afficher le questionnaire complet (mode avancé)</summary>

        <div className="worldmap-prompt-grid">
          <label className="worldmap-field">
            <span className="worldmap-field-label">Site cible</span>
            <select
              className="worldmap-select"
              value={wizard.targetSiteId}
              onChange={(e) => updateWizard('targetSiteId', e.target.value)}
            >
              {MAP_SITES.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>

          <label className="worldmap-field">
            <span className="worldmap-field-label">Portée de carte</span>
            <input
              type="text"
              className="worldmap-title-input"
              value={wizard.mapScope}
              onChange={(e) => updateWizard('mapScope', e.target.value)}
              placeholder="continent, archipel, royaume, zone frontalière..."
            />
          </label>

          <label className="worldmap-field">
            <span className="worldmap-field-label">Genre narratif</span>
            <input
              type="text"
              className="worldmap-title-input"
              value={wizard.narrativeGenre}
              onChange={(e) => updateWizard('narrativeGenre', e.target.value)}
            />
          </label>

          <label className="worldmap-field">
            <span className="worldmap-field-label">Époque / niveau technologique</span>
            <input
              type="text"
              className="worldmap-title-input"
              value={wizard.eraLevel}
              onChange={(e) => updateWizard('eraLevel', e.target.value)}
            />
          </label>

          <label className="worldmap-field">
            <span className="worldmap-field-label">Style visuel</span>
            <input
              type="text"
              className="worldmap-title-input"
              value={wizard.visualStyle}
              onChange={(e) => updateWizard('visualStyle', e.target.value)}
            />
          </label>

          <label className="worldmap-field">
            <span className="worldmap-field-label">Palette / ambiance</span>
            <input
              type="text"
              className="worldmap-title-input"
              value={wizard.colorMood}
              onChange={(e) => updateWizard('colorMood', e.target.value)}
            />
          </label>

          <label className="worldmap-field">
            <span className="worldmap-field-label">Orientation de sortie</span>
            <input
              type="text"
              className="worldmap-title-input"
              value={wizard.orientation}
              onChange={(e) => updateWizard('orientation', e.target.value)}
              placeholder="horizontal, vertical, carré..."
            />
          </label>

          <label className="worldmap-field worldmap-field-full">
            <span className="worldmap-field-label">Forme géographique globale</span>
            <textarea
              className="worldmap-description-input"
              rows={3}
              value={wizard.geographyShape}
              onChange={(e) => updateWizard('geographyShape', e.target.value)}
            />
          </label>

          <label className="worldmap-field worldmap-field-full">
            <span className="worldmap-field-label">Relief et géomorphologie</span>
            <textarea
              className="worldmap-description-input"
              rows={3}
              value={wizard.relief}
              onChange={(e) => updateWizard('relief', e.target.value)}
            />
          </label>

          <label className="worldmap-field worldmap-field-full">
            <span className="worldmap-field-label">Climats et biomes</span>
            <textarea
              className="worldmap-description-input"
              rows={3}
              value={wizard.climateBiomes}
              onChange={(e) => updateWizard('climateBiomes', e.target.value)}
            />
          </label>

          <label className="worldmap-field worldmap-field-full">
            <span className="worldmap-field-label">Hydrographie et littoraux</span>
            <textarea
              className="worldmap-description-input"
              rows={3}
              value={wizard.hydrology}
              onChange={(e) => updateWizard('hydrology', e.target.value)}
            />
          </label>

          <label className="worldmap-field worldmap-field-full">
            <span className="worldmap-field-label">Civilisations et frontières</span>
            <textarea
              className="worldmap-description-input"
              rows={3}
              value={wizard.civilizations}
              onChange={(e) => updateWizard('civilizations', e.target.value)}
            />
          </label>

          <label className="worldmap-field worldmap-field-full">
            <span className="worldmap-field-label">Lieux majeurs (landmarks)</span>
            <textarea
              className="worldmap-description-input"
              rows={3}
              value={wizard.landmarks}
              onChange={(e) => updateWizard('landmarks', e.target.value)}
            />
          </label>

          <label className="worldmap-field worldmap-field-full">
            <span className="worldmap-field-label">Échelle et logique des distances</span>
            <textarea
              className="worldmap-description-input"
              rows={3}
              value={wizard.scaleDistance}
              onChange={(e) => updateWizard('scaleDistance', e.target.value)}
            />
          </label>

          <label className="worldmap-field worldmap-field-full">
            <span className="worldmap-field-label">Langue et stratégie des labels</span>
            <textarea
              className="worldmap-description-input"
              rows={3}
              value={wizard.labelsLanguage}
              onChange={(e) => updateWizard('labelsLanguage', e.target.value)}
            />
          </label>

          <label className="worldmap-field worldmap-field-full">
            <span className="worldmap-field-label">Éléments cartographiques obligatoires</span>
            <textarea
              className="worldmap-description-input"
              rows={3}
              value={wizard.cartographyElements}
              onChange={(e) => updateWizard('cartographyElements', e.target.value)}
            />
          </label>

          <label className="worldmap-field worldmap-field-full">
            <span className="worldmap-field-label">Contraintes négatives (à exclure)</span>
            <textarea
              className="worldmap-description-input"
              rows={3}
              value={wizard.negativeConstraints}
              onChange={(e) => updateWizard('negativeConstraints', e.target.value)}
            />
          </label>
        </div>
        </details>

        <div className="worldmap-site-card">
          <h3>{selectedSite.name} — pourquoi ce choix ?</h3>
          <p>{selectedSite.strength}</p>
          <p>
            Site :{' '}
            <a href={selectedSite.url} target="_blank" rel="noreferrer">
              {selectedSite.url}
            </a>
            {' · '}
            Guide officiel :{' '}
            <a href={selectedSite.docs} target="_blank" rel="noreferrer">
              {selectedSite.docs}
            </a>
          </p>
          <ol>
            {selectedSite.tutorial.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <label className="worldmap-field worldmap-field-full">
          <span className="worldmap-field-label">Superprompt généré</span>
          <textarea
            className="worldmap-superprompt"
            rows={18}
            value={superPrompt}
            readOnly
          />
        </label>
        <div className="worldmap-superprompt-actions">
          <button type="button" className="worldmap-add-btn" onClick={copyPrompt}>
            Copier le superprompt
          </button>
          <button type="button" className="worldmap-add-btn" onClick={copyAndOpenSite}>
            Copier + ouvrir {selectedSite.name}
          </button>
          <button type="button" className="worldmap-add-btn" onClick={openGeneratorSite}>
            Ouvrir {selectedSite.name}
          </button>
          <a href={selectedSite.docs} target="_blank" rel="noreferrer" className="worldmap-doc-link">
            Documentation officielle
          </a>
          {copyStatus ? <span className="worldmap-copy-status">{copyStatus}</span> : null}
        </div>
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
