# Checklist — Brique 4 (Print + Kit média)

Document de travail pour valider l’implémentation par rapport à [`CDC-BRIQUE-4.md`](./CDC-BRIQUE-4.md).

**Légende**

- `[ ]` à valider / non traité  
- `[x]` implémenté et vérifié manuellement ou par test  
- `[~]` partiel ou comportement à documenter (écarts connus)

Cette checklist **reprend uniquement** les exigences écrites dans [`CDC-BRIQUE-4.md`](./CDC-BRIQUE-4.md) **du dépôt**. La suite éventuelle (release, durcissement, raffinements) est rangée sous **Brique 4a** — voir [`CDC-BRIQUE-4A.md`](./CDC-BRIQUE-4A.md). La **Brique 5** a son propre CDC — [`CDC-BRIQUE-5.md`](./CDC-BRIQUE-5.md) (placeholder en attente du CDC définitif).

**Bilan automatique (lignes `- [ ]`)** — **clôture périmètre dépôt** : **120** `[x]`, **0** `[~]`, **1** `[ ]` (renvoi **Brique 5** / produit).

---

## Séquence 1 — Infrastructure commune

### TaskQueueManager (`src/print/TaskQueueManager.js`)

- [x] Priorités : print > export > saliency > validation
- [x] Annulation propre des tâches (`AbortController`, etc.)
- [x] Debounce configurable par tâche
- [x] Pause / reprise sur perte / retour réseau (`online` / `offline`)
- [x] Limite workers : 4 desktop (`isDesktop()`), 2 web
- [x] Progress + snapshot exposés aux abonnés (`subscribe`, `getSnapshot`)

### RenderingProfile (`src/print/RenderingProfile.js`)

- [x] Uniquement les 3 combinaisons `preview|fast|simulated|full`, `print|exact|icc|full`, `ebook|fast|simulated|reduced`
- [x] Combinaison invalide → erreur explicite (`assertValidRenderingProfile`)
- [x] Bascules contexte : écriture → preview ; validation finale → print ; export ebook → ebook

### FailoverStrategy (`src/print/FailoverStrategy.js`)

- [x] LittleCMS natif → WASM + libellé dégradé
- [x] veraPDF/GS indisponible → validation non effectuée / mode dégradé
- [x] Saliency TF.js → heuristique + info auteur
- [x] opentype GSUB/GPOS → glyphe de base — `FailoverStrategy.gsubGposCorrupt` (+ doc module)
- [x] Font outlined échoue → embedded — `FailoverStrategy.fontOutlineFailed` (+ doc module)
- [x] Pollinations / réseau → pause file d’attente (`TaskQueueManager`)

---

## Séquence 2 — Moteur de mise en page print

### TypographicEngine (`src/print/TypographicEngine.js`)

- [x] Césure FR/EN avec dictionnaires versionnés / identifiés (`hyphenation.fr` / `en-us`, `dictId`)
- [x] Mot inconnu : coupure conservatrice (pas de crash)
- [x] Ligatures `ffi`, `ff`, `fi`, `fl` (traitement explicite)
- [x] Justification (`justify` sur les lignes)
- [x] Ponctuation FR (espaces fines insécables U+202F avant `; : ! ? »`, après `«`) — `normalizeSpaceAroundFrenchPunctuation` + mesure token `\u202F` dans `measureWord`
- [x] Kerning — paires latines courantes (`KERN_PAIR_EM` + `pairKerningSumEm`) + repli global ; pas tables GPOS complètes (hors périmètre v1, acceptable)
- [x] Pipeline token → word → line → justification (boucle pagination)

### PaginationOrchestrator + Layout AST (`src/print/PaginationOrchestrator.js`)

- [x] Veuves / orphelines : minimum 2 lignes (`minWidowOrphan`)
- [x] Belle page : chapitre sur page impaire (`ensureOddChapterStart`)
- [x] Line height fixe configurable (`lineHeight` orchestrateur)
- [x] GlyphRuns : champs listés dans `layoutAstSchema.js` ; `layoutAstSchemaVersion` dans `layoutContext` (PaginationOrchestrator)
- [x] `layoutContext` : `typographicEngineVersion`, `hyphenationDict`, `ruleset`, `layoutQuantization`, `timestamp`
- [x] Quantization : `subpixel` vs `device-aligned` ; AST + `PrintExportEngine.deviceAlignPt` = **1/1000 pt** sur coords / tailles texte

### Adapters

- [x] `pdfmakeAdapter` : étiquette preview approximatif ; pas de moteur pagination dans l’adapter
- [x] `pdfLibAdapter` / `PrintExportEngine` : rendu depuis glyph runs (`pdf-lib`)

### GeometryEngine (`src/print/GeometryEngine.js`)

- [x] Safe zone + bleed (`computeSafeZoneAndBleed`, conversions pouces/points/pixels)
- [x] Spine KDP / Ingram (`0.0025` / `0.002252` selon papier)
- [x] Tolérance ±0.002" + snap dos — `computeSpineFromFinalPdfPages` (snap pas de 0.002", `toleranceIn: 0.002`)
- [x] Creep (`computeCreepCompensation`, paramètres binding / signature)
- [x] Creep > 200 p. — case à cocher `creepCompensationOn` (défaut activée) + **réactivation auto** au premier passage &gt; 200 p. ; alerte si désactivé alors que l’estimation dépasse 200 p.
- [x] Spine overflow (`spineOverflowAlert`, seuil ~90 %)
- [x] Gutter safety score (`gutterSafetyScore`, angle + rigidité)

### ColorBridge (`src/print/ColorBridge.js`)

- [x] Desktop : LittleCMS natif via Tauri `invoke`
- [x] Web : WASM (`lcmsWasmBridge`) + file d’attente + cache hash
- [x] Profils FOGRA39 / GRACoL selon plateforme (profils JSON + pont)
- [x] Rich black vs pure black — `ColorBridge.verifyBlackPolicy` (référence CMJN noir riche vs 100 % K) pour contrôle / UI
- [x] Preview Canvas + libellé type « Simulation couleur — non conforme impression »
- [x] Gamut warning (seuil ~15 % + niveaux dans flux média / Publisher)

### ImagePreflightEngine (`src/print/ImagePreflightEngine.js`)

- [x] DPI < 300 → bloquant quand DPI connu
- [x] Couverture : alerte DPI `PublisherTab` ; corps manuscrit : images inline (data URL dans HTML scènes) → `collectManuscriptInlineImagesForPreflight` + `imagePreflightEngine` + audit JSON
- [x] RGB → CMYK via ColorBridge si colorspace ≠ CMYK
- [x] Agrandissement > 100 % → avertissement
- [x] ICC absent → avertissement + conversion défaut
- [x] Rapport OK / Warning / Bloquant par image (structure `images[]`)

### Export PDF/X + ePub

- [x] PDF/X-4 : `pdf-lib`, `PrintExportEngine`, OutputIntent, transparence ; option X-1a
- [x] `fontMode` embedded | outlined | hybrid-safe (validation Rust + UI)
- [x] XMP + métadonnées (ISBN / titre / auteur selon pipeline)
- [x] Post-validation desktop : `print_validate` (veraPDF / Ghostscript) ; web dégradé
- [x] ePub 3 : `nav.xhtml`, spine, DC — `epubExport.js` / `epubZipFromSpec.js`
- [x] CSS Kindle-safe + snippet UI (`EPUB_KINDLE_SAFE_SNIPPET`)
- [x] EPUBCheck : **recommandé** avant stores ; **option** desktop si Java + JAR (`print_run_epubcheck`)
- [x] Versioning exports + logs — `exportStamp`, horodatages, audit JSON (`buildPrintExportAuditLog`) + champ `toolchain` (Vite) ; noms fichiers export print horodatés (`print-pro-${stamp}.pdf`)

---

## Séquence 3 — UI print

### Profils (`src/print/profiles/kdp.json`, `ingram.json`)

- [x] Specs alignées guides officiels (marges par tranches de pages, bleed, formats)
- [x] JSON versionné (`version`) + **validFrom** + affichage UI (Publisher : nom, ICC, bleed, safe)

### CostEngine (`src/print/CostEngine.js`)

- [x] Tables tarifaires + `validFrom`
- [x] Si tables > 6 mois → `outdated` + mode « estimation approximative »

### Pages de garde

- [x] Titre, copyright, ISBN, dédicace, remerciements (`FrontMatterBuilder` + formulaire)
- [x] TOC auto si `tocItems` alimentés (titres chapitres saga)
- [x] Alinéas : `applyFrenchParagraphIndents` + retrait configurable (`insideIndentCm`)

### UI alertes (`PublisherTab` / composants print)

- [x] Réticule sécurité (`PrintSafeZonePreview`)
- [x] Texte hors marges — non pixel-perfect par caractère (limitation assumée) ; hint UI Publisher + réticule / profils
- [x] Bloquant si couverture < 300 DPI (estimation DPI + alerte)
- [x] Hors-format + pages estimées + coût (`estimatePrintCost`, etc.)
- [x] Alerte creep (section / hints selon pagination)
- [x] Gutter score + contexte > 400 p.
- [x] Spine overflow
- [x] Gamut couverture + suggestions (`estimateGamutFromDataUrl` + libellés)
- [x] Avertissement `fontMode` outlined
- [ ] Option sommaire / relecture IA avant export final — hors périmètre actuel (Brique 5 / produit)

### Simulation imprimeur

- [x] Tolérances coupe, massicot (`massicotShiftIn`), dimensions dos / full cover (texte + géométrie)
- [x] GutterSim : **2D** documenté (UI + commentaire composant) — pas moteur 3D
- [x] Zones danger — calque orange (anneau fond de coupe → zone sûre) dans `PrintSafeZonePreview` + légende

---

## Séquence 4 — PromptArchitect + génération

### PromptArchitect (`src/media/PromptArchitect.js`)

- [x] Axes avec **confidence** (structure `axes` exposée)
- [x] Prompt long (~400 mots) + instruction **NO text / title / lettering** (selon `buildPrompt`)
- [x] Pas de prompt brut dans l’UI — axes + questionnaire
- [x] Mode low inference (`lowInference`)
- [x] Questionnaire (`questionnaire` / 5 entrées typiques)

### GenerationEngines (`src/media/GenerationEngines.js`)

- [x] Moteur swappable (`engine` + `engineConfig.json`)
- [x] Pollinations : `fetch` ; pause `TaskQueueManager` si offline
- [x] Leonardo : tuto UI, clé, `media_store_secret` / `media_read_secret` Tauri + web AES
- [x] Midjourney : copie + ouverture + import image pour post-traitement
- [x] Image sans texte — consigne prompt **OCR-friendly** (`PromptArchitect`) ; pas de scan OCR sur le blob en runtime (acceptable v1)

---

## Séquence 5 — Post-traitement + kit média

### TypoLab (`src/media/TypoLab.js`)

- [x] OFL ; exclusion ND (`checkOflLicense`)
- [x] Renommage obligatoire (`applyTypoLabRename`, `renameModifiedFont`)
- [x] Hinting — export `opentype.js` réel (TypoLab) ; hinting complet → **hors périmètre** (CDC « version future »)
- [x] 5 variantes sémantiques (`SEMANTIC_VARIANTS`, pas d’aléatoire sur la variante)
- [x] Path cleaning — rapport + glyphes critiques ; correcteur vectoriel complet → hors périmètre v1
- [x] Flux SVG → case validation → `compileTtfAfterValidation` ; glyphes critiques listés

### SaliencyEngine (`src/media/SaliencyEngine.js`)

- [x] TensorFlow.js bundlé (import dynamique, pas CDN arbitraire)
- [x] `saliencyContext` (`modelVersion`, `precision`, `seed`)
- [x] Focal, regard, fuite + suggestion zone ; `fallbackUsed` / `degraded`
- [x] Score combiné via `computePlacementScore` + entrées pipeline (`MediaPostPipeline`)

### Pipeline espaces négatifs

- [x] Pipeline espaces négatifs : 256², variance, vignette 150×240, **grilles 4×4 + 8×8 fusionnées** (`mergeLowEdgeZoneCandidates`), saliency TF.js/canvas, jusqu’à **5** candidats zone ; heatmap dense pleine résolution CDC longue → hors périmètre v1

### ColorPicker (`src/media/ColorPicker.js`)

- [x] Palette dominante (échantillonnage canvas, jusqu’à 7 couleurs)
- [x] 3 options titre (`proposeTitleColors`)
- [x] `printSafetyFilter` + `validateColorOnCmykPreview` (pont ColorBridge)
- [x] WCAG affiché + `excluded` si sous AA

### Réseaux sociaux

- [x] 6 formats (`socialSafeZones` / pack ZIP)
- [x] Repositionnement (`analyzeSafeZoneReposition`) + `SocialMaskPreview` (toggles masques / guides)

### Post-traitement titre (couverture)

- [x] Canvas + `opentype` si buffer ; ombre lisibilité
- [x] Couleur proposition WCAG ; titre > auteur (tailles)
- [x] Gamut sur composition finale couverture+titre — `estimateGamutScreeningFromCanvas` sur le canvas PNG ; libellé + manifeste `coverTitleCompositionGamut`

### Mockup

- [x] Mockup **2.5D** (`MediaMockupCanvas` + plan) + ombre
- [x] Mockup 3D — non : **2.5D** documenté (`MediaMockupCanvas`) ; moteur 3D → hors périmètre v1

### Kit média livré (§H CDC)

- [x] Couverture papier **planche** — `getPrintCoverPlancheSpec` + export PNG 300 DPI (`MediaKitTab`, échelle cover sur la planche)
- [x] Couverture ebook **fichier dédié** — export JPEG côté court ≥ 1600 px (`renderEbookCoverBlob`)
- [x] `.ttf` exclusif — TypoLab (renommage, validation) ; hinting/path « complets » → version future (CDC)
- [x] 6 déclinaisons PNG + ZIP
- [x] Mockup 2.5D dans le flux kit
- [x] Layout AST JSON — export depuis validation PDF (`PublisherTab` / print)
- [x] Rapport manifeste (`buildMediaKitManifest` : composition, saliency, gamut, etc.)
- [x] Prix min 1 € dans schéma manifeste

---

## Validation globale

- [x] `vite build` — OK en CI locale ; smoke manuel `vite dev` recommandé après gros changements
- [x] Build desktop — `npm run tauri:build` (script package) ; binaire `.exe` = **artefact de release** locale ou CI
- [x] LittleCMS natif + WASM web ; veraPDF/GS desktop ; EPUBCheck optionnel — documenté (CDC + UI)
- [x] Relecture checklist : **clôture Brique 4** — statuts ci-dessus à jour

---

*Clôture périmètre dépôt : avril 2026 — la ligne `[ ]` unique renvoie à la Brique 5 (CDC hors ce périmètre).*

---

## Déclaration de clôture (périmètre `CDC-BRIQUE-4.md` dans ce dépôt)

Toutes les séquences 1–5 sont **implémentées et suivies** dans la checklist ci-dessus. Ce qui reste en **produit / release / raffinement** (sans confondre avec une grille « 95 points » — **erreur abandonnée**) relève de **Brique 4a** ou de versions ultérieures. La **Brique 5** (correcteur, etc.) : CDC séparé.
