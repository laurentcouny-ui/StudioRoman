import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  createEmptyBibleCategory,
  createEmptyBibleEntry,
  createEmptyBibleSubcategory,
} from './projectStore.js'

const CATEGORIES_PAGE_SIZE = 60
const SUBCATEGORIES_PAGE_SIZE = 60
const ENTRIES_PAGE_SIZE = 100

function textPreview(raw, max = 96) {
  if (raw == null || typeof raw !== 'string') return ''
  const t = raw.replace(/\s+/g, ' ').trim()
  if (!t.length) return ''
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

/** Libellé liste (gauche) : titre si présent, sinon extrait du corps ; jamais le vieux « Sans titre ». */
function entrySidebarPrimaryLabel(entry, maxBody = 72) {
  let t = (entry.title ?? '').trim()
  if (t === 'Sans titre') t = ''
  if (t) return t
  const prev = textPreview(entry.content ?? '', maxBody)
  if (prev) return prev
  return '—'
}

function entryHasRealTitle(entry) {
  let t = (entry.title ?? '').trim()
  if (t === 'Sans titre') t = ''
  return Boolean(t)
}

function categorySidebarTitle(cat) {
  const t = (cat.title ?? '').trim()
  return t || '—'
}

function subcategorySidebarTitle(sub, entriesInCategory) {
  const t = (sub.title ?? '').trim()
  if (t) return t
  const inSub = entriesInCategory.filter((e) => e.subcategoryId === sub.id)
  for (const e of inSub) {
    const lab = entrySidebarPrimaryLabel(e, 56)
    if (lab !== '—') return lab
  }
  return '—'
}

function entryMatchesQuery(entry, q) {
  if (!q) return true
  const n = q.toLowerCase()
  return (
    (entry.title ?? '').toLowerCase().includes(n) || (entry.content ?? '').toLowerCase().includes(n)
  )
}

/** Aperçu pour le menu : nb fiches + titres ou extrait du texte */
function subfolderMenuHint(subId, entriesInCategory) {
  const list = entriesInCategory.filter((e) => e.subcategoryId === subId)
  const n = list.length
  if (n === 0) return 'Aucune fiche'
  const labels = list
    .map((e) => entrySidebarPrimaryLabel(e, 48))
    .filter((l) => l !== '—')
    .slice(0, 2)
  const hintSample = labels.join(' · ')
  const bits = [`${n} fiche${n > 1 ? 's' : ''}`]
  if (hintSample) bits.push(hintSample)
  return bits.join(' · ')
}

function rootFolderMenuHint(entriesInCategory) {
  const list = entriesInCategory.filter((e) => !e.subcategoryId)
  const n = list.length
  if (n === 0) return 'Aucune fiche ici'
  const labels = list
    .map((e) => entrySidebarPrimaryLabel(e, 48))
    .filter((l) => l !== '—')
    .slice(0, 2)
  const hintSample = labels.join(' · ')
  const bits = [`${n} fiche${n > 1 ? 's' : ''}`]
  if (hintSample) bits.push(hintSample)
  return bits.join(' · ')
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function BibleTab({ currentSaga, onUpdateBible }) {
  const bible = currentSaga?.bible ?? {}
  const categories = useMemo(() => bible.categories ?? [], [bible.categories])
  const entries = useMemo(() => bible.entries ?? [], [bible.entries])

  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id ?? null)
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [categoriesPage, setCategoriesPage] = useState(0)
  const [subcategoriesPage, setSubcategoriesPage] = useState(0)
  const [entriesPage, setEntriesPage] = useState(0)
  const [categoryPendingDelete, setCategoryPendingDelete] = useState(null)
  const [bibleSidebarQuery, setBibleSidebarQuery] = useState('')

  const imageInputRef = useRef(null)
  /** Évite que l’effet « liste vide » efface la sélection avant que le parent ait reçu la nouvelle entrée (add cat / sous-cat / entrée). */
  const pendingSelectEntryIdRef = useRef(null)
  /** Création auto d’une fiche vide (ensureBucketEntry) en cours — même problème de timing que pending. */
  const ensureInFlightRef = useRef(false)

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? categories[0] ?? null,
    [categories, selectedCategoryId],
  )

  const selectedSubcategories = useMemo(
    () => selectedCategory?.subcategories ?? [],
    [selectedCategory?.subcategories],
  )

  const selectedSubcategory = useMemo(
    () =>
      selectedSubcategoryId
        ? selectedSubcategories.find((s) => s.id === selectedSubcategoryId) ?? null
        : null,
    [selectedSubcategories, selectedSubcategoryId],
  )

  // Ordre des id seulement : stable tant qu’on ne rajoute / retire / réordonne pas (pas à chaque frappe de titre)
  const categoryOrderKey = categories.map((c) => c.id).join('|')
  const categoryPageForSelected = useMemo(() => {
    if (!selectedCategoryId || !categoryOrderKey) return null
    const idx = categoryOrderKey.split('|').indexOf(selectedCategoryId)
    if (idx < 0) return null
    return Math.floor(idx / CATEGORIES_PAGE_SIZE)
  }, [selectedCategoryId, categoryOrderKey])

  useLayoutEffect(() => {
    if (categoryPageForSelected === null) return
    queueMicrotask(() => setCategoriesPage(categoryPageForSelected))
  }, [categoryPageForSelected])

  // Garde les sélections cohérentes si les catégories changent
  useEffect(() => {
    if (!categories.length) {
      queueMicrotask(() => {
        setSelectedCategoryId(null)
        setSelectedSubcategoryId(null)
        setSelectedId(null)
      })
      return
    }
    if (!selectedCategoryId || !categories.some((c) => c.id === selectedCategoryId)) {
      queueMicrotask(() => {
        setSelectedCategoryId(categories[0].id)
        setSelectedSubcategoryId(null)
        setSubcategoriesPage(0)
        setSelectedId(null)
      })
    }
  }, [categories, selectedCategoryId])

  // Si on a une sous-catégorie, vérifie qu’elle existe encore
  useEffect(() => {
    if (!selectedSubcategoryId) return
    const exists = selectedSubcategories.some((s) => s.id === selectedSubcategoryId)
    if (!exists) queueMicrotask(() => setSelectedSubcategoryId(null))
  }, [selectedSubcategories, selectedSubcategoryId])

  const visibleEntries = useMemo(() => {
    if (!selectedCategoryId) return []
    return entries.filter((e) => {
      if (e.categoryId !== selectedCategoryId) return false
      if (!selectedSubcategoryId) return !e.subcategoryId
      return e.subcategoryId === selectedSubcategoryId
    })
  }, [entries, selectedCategoryId, selectedSubcategoryId])

  const entriesInCurrentCategory = useMemo(
    () => entries.filter((e) => e.categoryId === selectedCategoryId),
    [entries, selectedCategoryId],
  )

  const filteredSubcategories = useMemo(() => {
    const q = bibleSidebarQuery.trim().toLowerCase()
    if (!q) return selectedSubcategories
    const matched = selectedSubcategories.filter((sub) => {
      if ((sub.title ?? '').toLowerCase().includes(q)) return true
      return entriesInCurrentCategory.some(
        (e) => e.subcategoryId === sub.id && entryMatchesQuery(e, q),
      )
    })
    if (selectedSubcategoryId) {
      const sel = selectedSubcategories.find((s) => s.id === selectedSubcategoryId)
      if (sel && !matched.some((s) => s.id === sel.id)) {
        return [sel, ...matched.filter((s) => s.id !== sel.id)]
      }
    }
    return matched
  }, [selectedSubcategories, entriesInCurrentCategory, bibleSidebarQuery, selectedSubcategoryId])

  const filteredVisibleEntriesForList = useMemo(() => {
    const q = bibleSidebarQuery.trim().toLowerCase()
    if (!q) return visibleEntries
    const matched = visibleEntries.filter((e) => entryMatchesQuery(e, q))
    if (selectedId && !matched.some((e) => e.id === selectedId)) {
      const sel = visibleEntries.find((e) => e.id === selectedId)
      if (sel) return [sel, ...matched.filter((e) => e.id !== sel.id)]
    }
    return matched
  }, [visibleEntries, bibleSidebarQuery, selectedId])

  const showRootSubRow = useMemo(() => {
    const q = bibleSidebarQuery.trim().toLowerCase()
    if (!q) return true
    if (!selectedSubcategoryId) return true
    const rootEntries = entriesInCurrentCategory.filter((e) => !e.subcategoryId)
    return rootEntries.some((e) => entryMatchesQuery(e, q))
  }, [entriesInCurrentCategory, bibleSidebarQuery, selectedSubcategoryId])

  const subOrderKey = filteredSubcategories.map((s) => s.id).join('|')
  const subPageForSelected = useMemo(() => {
    if (!selectedSubcategoryId) return null
    if (!subOrderKey) return null
    const idx = subOrderKey.split('|').indexOf(selectedSubcategoryId)
    if (idx < 0) return null
    return Math.floor(idx / SUBCATEGORIES_PAGE_SIZE)
  }, [selectedSubcategoryId, subOrderKey])

  useLayoutEffect(() => {
    if (subPageForSelected === null) return
    queueMicrotask(() => setSubcategoriesPage(subPageForSelected))
  }, [subPageForSelected])

  const bucketKey = `${selectedCategoryId ?? ''}\0${selectedSubcategoryId ?? ''}`
  const prevBucketKeyRef = useRef('')
  // Toujours au moins une fiche éditable sous le titre (sinon la zone de texte n’apparaît pas)
  useLayoutEffect(() => {
    if (!selectedCategoryId) {
      ensureInFlightRef.current = false
      prevBucketKeyRef.current = bucketKey
      return
    }
    if (prevBucketKeyRef.current !== bucketKey) {
      ensureInFlightRef.current = false
      prevBucketKeyRef.current = bucketKey
    }
    if (visibleEntries.length > 0) {
      ensureInFlightRef.current = false
      return
    }
    ensureInFlightRef.current = true
    const entry = createEmptyBibleEntry()
    entry.categoryId = selectedCategoryId
    entry.subcategoryId = selectedSubcategoryId
    onUpdateBible?.('ensureBucketEntry', { entry })
  }, [bucketKey, selectedCategoryId, selectedSubcategoryId, visibleEntries.length, onUpdateBible])

  const categoriesTotalPages = Math.max(1, Math.ceil(categories.length / CATEGORIES_PAGE_SIZE))
  const categoriesSafePage = Math.min(categoriesPage, categoriesTotalPages - 1)
  const pagedCategories = categories.slice(
    categoriesSafePage * CATEGORIES_PAGE_SIZE,
    categoriesSafePage * CATEGORIES_PAGE_SIZE + CATEGORIES_PAGE_SIZE,
  )

  const subcategoriesTotalPages = Math.max(
    1,
    Math.ceil(filteredSubcategories.length / SUBCATEGORIES_PAGE_SIZE),
  )
  const subcategoriesSafePage = Math.min(subcategoriesPage, subcategoriesTotalPages - 1)
  const pagedSubcategories = filteredSubcategories.slice(
    subcategoriesSafePage * SUBCATEGORIES_PAGE_SIZE,
    subcategoriesSafePage * SUBCATEGORIES_PAGE_SIZE + SUBCATEGORIES_PAGE_SIZE,
  )

  const entriesTotalPages = Math.max(
    1,
    Math.ceil(filteredVisibleEntriesForList.length / ENTRIES_PAGE_SIZE),
  )
  const entriesSafePage = Math.min(entriesPage, entriesTotalPages - 1)
  const pagedVisibleEntries = filteredVisibleEntriesForList.slice(
    entriesSafePage * ENTRIES_PAGE_SIZE,
    entriesSafePage * ENTRIES_PAGE_SIZE + ENTRIES_PAGE_SIZE,
  )

  const visibleEntryOrderKey = filteredVisibleEntriesForList.map((e) => e.id).join('|')
  const entryPageForSelected = useMemo(() => {
    if (!selectedId || !visibleEntryOrderKey) return null
    const idx = visibleEntryOrderKey.split('|').indexOf(selectedId)
    if (idx < 0) return null
    return Math.floor(idx / ENTRIES_PAGE_SIZE)
  }, [selectedId, visibleEntryOrderKey])

  useLayoutEffect(() => {
    if (entryPageForSelected === null) return
    queueMicrotask(() => setEntriesPage(entryPageForSelected))
  }, [entryPageForSelected])

  useEffect(() => {
    const pending = pendingSelectEntryIdRef.current
    if (pending && entries.some((e) => e.id === pending)) {
      pendingSelectEntryIdRef.current = null
    }
  }, [entries])

  useEffect(() => {
    if (!visibleEntries.length) {
      if (ensureInFlightRef.current) return
      const pending = pendingSelectEntryIdRef.current
      if (pending != null && selectedId === pending) {
        return
      }
      queueMicrotask(() => setSelectedId(null))
      return
    }
    ensureInFlightRef.current = false
    if (selectedId && visibleEntries.some((e) => e.id === selectedId)) return
    queueMicrotask(() => setSelectedId(visibleEntries[0].id))
  }, [visibleEntries, selectedId])

  useEffect(() => {
    if (categoriesPage > categoriesTotalPages - 1) {
      queueMicrotask(() => setCategoriesPage(categoriesTotalPages - 1))
    }
  }, [categoriesPage, categoriesTotalPages])

  useEffect(() => {
    if (subcategoriesPage > subcategoriesTotalPages - 1) {
      queueMicrotask(() => setSubcategoriesPage(subcategoriesTotalPages - 1))
    }
  }, [subcategoriesPage, subcategoriesTotalPages])

  useEffect(() => {
    if (entriesPage > entriesTotalPages - 1) {
      queueMicrotask(() => setEntriesPage(entriesTotalPages - 1))
    }
  }, [entriesPage, entriesTotalPages])

  useEffect(() => {
    queueMicrotask(() => setEntriesPage(0))
  }, [selectedCategoryId, selectedSubcategoryId])

  useEffect(() => {
    queueMicrotask(() => {
      setSubcategoriesPage(0)
      setEntriesPage(0)
    })
  }, [bibleSidebarQuery])

  useEffect(() => {
    queueMicrotask(() => setBibleSidebarQuery(''))
  }, [selectedCategoryId])

  const selected = useMemo(() => {
    if (!selectedId || !selectedCategoryId) return null
    return (
      entries.find(
        (e) =>
          e.id === selectedId &&
          e.categoryId === selectedCategoryId &&
          (selectedSubcategoryId ? e.subcategoryId === selectedSubcategoryId : !e.subcategoryId),
      ) ?? null
    )
  }, [entries, selectedId, selectedCategoryId, selectedSubcategoryId])

  const handleAddEntry = () => {
    if (!selectedCategoryId) return
    const newEntry = createEmptyBibleEntry()
    newEntry.categoryId = selectedCategoryId
    newEntry.subcategoryId = selectedSubcategoryId
    pendingSelectEntryIdRef.current = newEntry.id
    onUpdateBible?.('add', newEntry)
    setSelectedId(newEntry.id)
  }

  const handleDeleteEntry = (id) => {
    const index = visibleEntries.findIndex((e) => e.id === id)
    if (index === -1) return
    const next = visibleEntries[index + 1] ?? visibleEntries[index - 1]
    onUpdateBible?.('delete', id)
    setSelectedId(next?.id ?? null)
  }

  const handleUpdateEntry = (id, field, value) => {
    onUpdateBible?.('update', { id, field, value })
  }

  const handleImageSelect = async (e, entryId) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    try {
      const dataUrl = await readFileAsDataUrl(file)
      handleUpdateEntry(entryId, 'image', dataUrl)
    } catch {
      // lecture image abandonnée/invalidée
    }
    e.target.value = ''
  }

  const handleRemoveImage = (entryId) => {
    handleUpdateEntry(entryId, 'image', null)
  }

  const confirmDeleteCategory = () => {
    if (!categoryPendingDelete) return
    pendingSelectEntryIdRef.current = null
    ensureInFlightRef.current = false
    onUpdateBible?.('deleteCategory', categoryPendingDelete)
    setCategoryPendingDelete(null)
    setSelectedSubcategoryId(null)
    setSelectedId(null)
  }

  const handleAddCategory = () => {
    const cat = createEmptyBibleCategory()
    const entry = createEmptyBibleEntry()
    entry.categoryId = cat.id
    entry.subcategoryId = null
    pendingSelectEntryIdRef.current = entry.id
    onUpdateBible?.('addCategoryAndEntry', { category: cat, entry })
    setSelectedCategoryId(cat.id)
    setSelectedSubcategoryId(null)
    setSubcategoriesPage(0)
    setSelectedId(entry.id)
  }

  const handleAddSubcategory = () => {
    if (!selectedCategoryId) return
    const sub = createEmptyBibleSubcategory()
    const entry = createEmptyBibleEntry()
    entry.categoryId = selectedCategoryId
    entry.subcategoryId = sub.id
    pendingSelectEntryIdRef.current = entry.id
    onUpdateBible?.('addSubcategoryAndEntry', {
      categoryId: selectedCategoryId,
      subcategory: sub,
      entry,
    })
    setSelectedSubcategoryId(sub.id)
    setSelectedId(entry.id)
  }

  if (!currentSaga) {
    return (
      <div className="bible-tab empty">
        <p>Sélectionnez une saga dans le panneau de gauche.</p>
      </div>
    )
  }

  return (
    <div className="bible-tab">
      <header className="bible-header">
        <h1 className="bible-title">Bible de la saga</h1>
        <p className="bible-subtitle">
          Règles du monde, notes de cadrage, éléments réutilisables pour « {currentSaga.title || 'cette saga'} ».
        </p>
      </header>

      <div className="bible-layout">
        <aside className="bible-sidebar">
          {categories.length === 0 ? (
            <>
              <p className="bible-sidebar-empty-msg">Ajoutez une catégorie pour commencer.</p>
              <button type="button" className="bible-add-btn" onClick={handleAddCategory}>
                + Catégorie
              </button>
            </>
          ) : (
            <>
              <div className="bible-sidebar-block">
                <div className="bible-sidebar-label">Catégories</div>
                <div className="bible-entries-list" style={{ gap: '0.3rem' }}>
                  {pagedCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`bible-entry-btn ${cat.id === selectedCategoryId ? 'is-active' : ''}`}
                      onClick={() => {
                        setSelectedCategoryId(cat.id)
                        setSelectedSubcategoryId(null)
                        setSelectedId(null)
                        setSubcategoriesPage(0)
                      }}
                    >
                      {categorySidebarTitle(cat)}
                    </button>
                  ))}
                </div>
                {categories.length > CATEGORIES_PAGE_SIZE && (
                  <div className="sidebar-pager">
                    <button
                      type="button"
                      className="sidebar-pager-btn"
                      disabled={categoriesSafePage === 0}
                      onClick={() => setCategoriesPage((p) => Math.max(0, p - 1))}
                    >
                      Préc.
                    </button>
                    <span className="sidebar-pager-label">
                      {categoriesSafePage + 1}/{categoriesTotalPages}
                    </span>
                    <button
                      type="button"
                      className="sidebar-pager-btn"
                      disabled={categoriesSafePage >= categoriesTotalPages - 1}
                      onClick={() =>
                        setCategoriesPage((p) => Math.min(categoriesTotalPages - 1, p + 1))
                      }
                    >
                      Suiv.
                    </button>
                  </div>
                )}
                <button type="button" className="bible-add-btn" onClick={handleAddCategory}>
                  + Catégorie
                </button>
              </div>

              <div className="bible-sidebar-block">
                <label className="bible-sidebar-label" htmlFor="bible-sidebar-search">
                  Recherche (cette catégorie)
                </label>
                <input
                  id="bible-sidebar-search"
                  type="search"
                  className="bible-sidebar-search-input"
                  placeholder="Mot dans titre ou texte des fiches…"
                  value={bibleSidebarQuery}
                  onChange={(e) => setBibleSidebarQuery(e.target.value)}
                  autoComplete="off"
                />
              </div>

              {selectedCategory && (
                <div className="bible-sidebar-block bible-sidebar-nested">
                  <div className="bible-sidebar-label">Sous-dossiers &amp; aperçu des fiches</div>
                  <div className="bible-entries-list" style={{ gap: '0.3rem' }}>
                    {showRootSubRow ? (
                      <button
                        type="button"
                        className={`bible-entry-btn bible-entry-btn-stack ${!selectedSubcategoryId ? 'is-active' : ''}`}
                        onClick={() => {
                          setSelectedSubcategoryId(null)
                          setSelectedId(null)
                        }}
                      >
                        <span className="bible-entry-btn-title">Toute la catégorie</span>
                        <span className="bible-entry-btn-preview">{rootFolderMenuHint(entriesInCurrentCategory)}</span>
                      </button>
                    ) : null}
                    {pagedSubcategories.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        className={`bible-entry-btn bible-entry-btn-stack ${sub.id === selectedSubcategoryId ? 'is-active' : ''}`}
                        onClick={() => {
                          setSelectedSubcategoryId(sub.id)
                          setSelectedId(null)
                        }}
                      >
                        <span className="bible-entry-btn-title">
                          {subcategorySidebarTitle(sub, entriesInCurrentCategory)}
                        </span>
                        <span className="bible-entry-btn-preview">
                          {subfolderMenuHint(sub.id, entriesInCurrentCategory)}
                        </span>
                      </button>
                    ))}
                  </div>
                  {filteredSubcategories.length > SUBCATEGORIES_PAGE_SIZE && (
                    <div className="sidebar-pager">
                      <button
                        type="button"
                        className="sidebar-pager-btn"
                        disabled={subcategoriesSafePage === 0}
                        onClick={() => setSubcategoriesPage((p) => Math.max(0, p - 1))}
                      >
                        Préc.
                      </button>
                      <span className="sidebar-pager-label">
                        {subcategoriesSafePage + 1}/{subcategoriesTotalPages}
                      </span>
                      <button
                        type="button"
                        className="sidebar-pager-btn"
                        disabled={subcategoriesSafePage >= subcategoriesTotalPages - 1}
                        onClick={() =>
                          setSubcategoriesPage((p) => Math.min(subcategoriesTotalPages - 1, p + 1))
                        }
                      >
                        Suiv.
                      </button>
                    </div>
                  )}
                  <button type="button" className="bible-add-btn" onClick={handleAddSubcategory}>
                    + Sous-catégorie
                  </button>
                  {selectedSubcategoryId ? (
                    <input
                      type="text"
                      className="bible-entry-title-input"
                      value={selectedSubcategory?.title ?? ''}
                      onChange={(e) =>
                        onUpdateBible?.('updateSubcategory', {
                          categoryId: selectedCategory.id,
                          subcategoryId: selectedSubcategoryId,
                          field: 'title',
                          value: e.target.value,
                        })
                      }
                      placeholder="Nom de la sous-catégorie"
                      style={{ marginTop: '0.35rem' }}
                    />
                  ) : null}
                </div>
              )}

              <div className="bible-sidebar-block">
                <div className="bible-sidebar-label">Fiches dans ce dossier</div>
                <div className="bible-entries-list">
                  {pagedVisibleEntries.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className={`bible-entry-btn bible-entry-btn-stack ${entry.id === selectedId ? 'is-active' : ''}`}
                      onClick={() => setSelectedId(entry.id)}
                    >
                      <span className="bible-entry-btn-title">{entrySidebarPrimaryLabel(entry, 72)}</span>
                      {entryHasRealTitle(entry) && (entry.content ?? '').trim() ? (
                        <span className="bible-entry-btn-preview">{textPreview(entry.content, 100)}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
                {filteredVisibleEntriesForList.length > ENTRIES_PAGE_SIZE && (
                  <div className="sidebar-pager">
                    <button
                      type="button"
                      className="sidebar-pager-btn"
                      disabled={entriesSafePage === 0}
                      onClick={() => setEntriesPage((p) => Math.max(0, p - 1))}
                    >
                      Préc.
                    </button>
                    <span className="sidebar-pager-label">
                      {entriesSafePage + 1}/{entriesTotalPages}
                    </span>
                    <button
                      type="button"
                      className="sidebar-pager-btn"
                      disabled={entriesSafePage >= entriesTotalPages - 1}
                      onClick={() => setEntriesPage((p) => Math.min(entriesTotalPages - 1, p + 1))}
                    >
                      Suiv.
                    </button>
                  </div>
                )}
                <button type="button" className="bible-add-btn" onClick={handleAddEntry}>
                  + Nouvelle entrée
                </button>
              </div>
            </>
          )}
        </aside>

        <main className="bible-main">
          {categories.length === 0 ? (
            <div className="bible-empty-state">
              <p>Créez une catégorie dans la colonne de gauche pour éditer des fiches ici.</p>
            </div>
          ) : (
            <>
              {selectedCategory ? (
                <div className="bible-main-context">
                  <div className="bible-main-context-cat-row">
                    <div className="bible-main-context-cat-fields">
                      <label htmlFor="bible-category-title" className="bible-context-label">
                        Catégorie (grand dossier)
                      </label>
                      <input
                        id="bible-category-title"
                        type="text"
                        className="bible-entry-title-input"
                        value={selectedCategory.title ?? ''}
                        onChange={(e) =>
                          onUpdateBible?.('updateCategory', {
                            id: selectedCategory.id,
                            field: 'title',
                            value: e.target.value,
                          })
                        }
                        placeholder="Nom affiché dans la liste de gauche"
                      />
                    </div>
                    <button
                      type="button"
                      className="bible-delete-category-btn"
                      onClick={() => setCategoryPendingDelete(selectedCategory.id)}
                    >
                      Supprimer la catégorie…
                    </button>
                  </div>
                  {selectedSubcategory ? (
                    <>
                      <div className="bible-main-context-sub">
                        <label htmlFor="bible-subcategory-title" className="bible-context-label">
                          Sous-catégorie (liste de gauche)
                        </label>
                        <input
                          id="bible-subcategory-title"
                          type="text"
                          className="bible-entry-title-input"
                          value={selectedSubcategory.title ?? ''}
                          onChange={(e) =>
                            onUpdateBible?.('updateSubcategory', {
                              categoryId: selectedCategory.id,
                              subcategoryId: selectedSubcategory.id,
                              field: 'title',
                              value: e.target.value,
                            })
                          }
                          placeholder="Même libellé que le bouton sous-catégorie à gauche"
                        />
                      </div>
                      <div className="bible-main-path" aria-live="polite">
                        <span className="bible-main-path-label">Emplacement de la fiche :</span>{' '}
                        <span className="bible-main-path-seg">{selectedCategory.title || 'Catégorie'}</span>
                        <span className="bible-main-path-sep" aria-hidden>
                          {' › '}
                        </span>
                        <span className="bible-main-path-seg">
                          {selectedSubcategory.title || 'Sous-catégorie'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="bible-main-path bible-main-path-root" aria-live="polite">
                      <span className="bible-main-path-label">Emplacement :</span>{' '}
                      <span className="bible-main-path-seg">{selectedCategory.title || 'Catégorie'}</span>
                      <span className="bible-main-path-rest"> — hors sous-catégorie</span>
                    </div>
                  )}
                </div>
              ) : null}

              {selected ? (
                <div className="bible-editor">
                  <div className="bible-editor-header">
                    <input
                      type="text"
                      className="bible-entry-title-input"
                      value={selected.title ?? ''}
                      onChange={(e) => handleUpdateEntry(selected.id, 'title', e.target.value)}
                      placeholder="Titre de l'entrée"
                    />
                    <button
                      type="button"
                      className="bible-delete-btn"
                      onClick={() => handleDeleteEntry(selected.id)}
                      title="Supprimer cette entrée"
                    >
                      Supprimer
                    </button>
                  </div>

                  <div className="bible-image-block">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      className="bible-image-input"
                      onChange={(e) => handleImageSelect(e, selected.id)}
                      aria-label="Charger une image"
                    />
                    {selected.image ? (
                      <div className="bible-image-preview-wrap">
                        <img src={selected.image} alt="" className="bible-image-preview" />
                        <button
                          type="button"
                          className="bible-image-remove"
                          onClick={() => handleRemoveImage(selected.id)}
                          title="Supprimer l'image"
                        >
                          Supprimer l&apos;image
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="bible-image-upload-btn"
                        onClick={() => imageInputRef.current?.click()}
                      >
                        Charger une image
                      </button>
                    )}
                  </div>

                  <textarea
                    className="bible-entry-content"
                    value={selected.content ?? ''}
                    onChange={(e) => handleUpdateEntry(selected.id, 'content', e.target.value)}
                    placeholder="Contenu de l'entrée (règles, notes, idées…)"
                    rows={16}
                  />
                </div>
              ) : (
                <div className="bible-empty-state">
                  <p>Aucune entrée ici. Utilisez « + Nouvelle entrée » à gauche.</p>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {categoryPendingDelete ? (
        <div
          className="confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bible-del-cat-title"
        >
          <div className="confirm-box">
            <p id="bible-del-cat-title" className="confirm-title">
              Êtes-vous sûr ?
            </p>
            <p className="confirm-message">
              Supprimer cette catégorie supprimera aussi toutes ses sous-catégories et toutes les entrées
              qu’elle contient. Cette action ne peut pas être annulée.
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-btn confirm-btn-cancel"
                onClick={() => setCategoryPendingDelete(null)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="confirm-btn confirm-btn-danger"
                onClick={confirmDeleteCategory}
              >
                Supprimer la catégorie
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default BibleTab
