# CDC — Brique 4 : Mise en page Print + Kit Média

**Scriptor Desktop V2** — Application Windows native (Tauri).  
**Repo de référence** : https://github.com/laurentcouny-ui/Scriptor  

**Objectif** : deux parties distinctes —  
**A)** Mise en page print : export manuscrit **PDF/X-4** (imprimeur) + **ePub 3.0** (liseuses).  
**B)** Kit Média : couverture pro + **police exclusive** dérivée du manuscrit.  

**Produit livré auteur** : `.exe` Windows (Desktop first). LittleCMS / veraPDF / Ghostscript en **binaires natifs** Tauri ; fallback **WASM** réservé au mode web (développement).

> **Note périmètre** : le **correcteur grammatical** est hors Brique 4 → **Brique 5** (voir fin de document).

**Prérequis briques** : 1, 2, 3 terminées.

---

## Instructions de travail (Cursor / implémentation)

La Brique 4 est divisée en **5 séquences**. Implémenter chaque séquence **jusqu’au bout** avant la suivante. Ne pas s’arrêter en milieu de séquence.

À la fin de chaque séquence, annoncer : **« SÉQUENCE [N] TERMINÉE — prêt pour la suivante. »**

Si contexte manquant : demander le fichier concerné à l’auteur du CDC — ne pas bloquer sans clarification.

| Séquence | Contenu |
|----------|---------|
| **1** | Infrastructure commune (TaskQueueManager, RenderingProfile, FailoverStrategy) |
| **2** | Partie A — Moteur print (TypographicEngine, PaginationOrchestrator, GeometryEngine, ColorBridge, Export PDF/X-4, ePub, ImagePreflight) |
| **3** | Partie A — UI print (profils, alertes, simulation imprimeur, Cost Engine) |
| **4** | Partie B — PromptArchitect + moteurs de génération d’image |
| **5** | Partie B — Post-traitement couverture (TypoLab, Saliency, Safe Zones, kit complet) |

---

## Séquence 1 — Infrastructure commune

### 1. TaskQueueManager — `src/print/TaskQueueManager.js`

- Priorité des tâches : **print > export > saliency > validation**
- **Cancellation** propre de toute tâche en cours
- **Debounce** : éviter les lancements multiples sur événements rapides
- **Pause intelligente** : perte de connexion → tâche en pause, prompt conservé, reprise auto au retour du signal
- Limite **Workers** : **4** Desktop (`isDesktop() === true`), **2** Web
- **Feedback progress** par tâche exposé à l’UI

### 2. RenderingProfile — `src/print/RenderingProfile.js`

Trois combinaisons valides **uniquement** :

```js
validProfiles = [
  { mode: "preview", precision: "fast",  color: "simulated", typography: "full"    },
  { mode: "print",   precision: "exact", color: "icc",       typography: "full"    },
  { mode: "ebook",   precision: "fast",  color: "simulated", typography: "reduced" },
]
```

Toute autre combinaison → **erreur explicite** (jamais silencieux).

Basculement automatique selon contexte :

- Écriture → `preview` / `fast` / `simulated`
- Validation finale → `print` / `exact` / `icc`
- Export ebook → `ebook` / `fast` / `simulated`

### 3. FailoverStrategy — `src/print/FailoverStrategy.js`

Modes dégradés (l’utilisateur **n’est jamais bloqué**) :

| Composant | Dégradé |
|-----------|---------|
| LittleCMS natif crash | WASM → simulation Canvas + label « Couleur non certifiée » |
| veraPDF / Ghostscript indisponible | Export sans validation + « Validation non effectuée » |
| TensorFlow.js Saliency divergence | Heuristique edge + variance + auteur informé |
| opentype.js GSUB/GPOS cassées | Glyphe de base non transformé |
| Font outlined échoue | Mode embedded standard |
| Pollinations.ai connexion perdue | Pause intelligente TaskQueueManager |

**Fin séquence 1** : annoncer *SÉQUENCE 1 TERMINÉE — prêt pour la séquence 2.*

---

## Séquence 2 — Moteur de mise en page print

**Prérequis** : Séquence 1 terminée.

### A. TypographicEngine — `src/print/TypographicEngine.js`

- Césure **Knuth-Liang**, dictionnaires **FR** et **EN** versionnés et identifiés
- Fallback si mot inconnu : coupure **conservatrice** (pas de crash)
- Ligatures FR/EN : fi, fl, ff, ffi
- Justification par **expansion glyphique**
- Ponctuation française : espace fine insécable avant `; : ! ? »`
- Kerning contrôlé
- Pipeline : token → word → line → justification

### B. PaginationOrchestrator + Layout AST — `src/print/PaginationOrchestrator.js`

Consomme TypographicEngine → **Layout AST figé déterministe**.

**Pagination** :

- Veuves/orphelines : **minimum 2 lignes**
- **Belle page** : chaque chapitre commence sur page **impaire** ; si le chapitre précédent finit sur impaire → **page blanche** auto
- Line height fixe et configurable

**GlyphRuns** (structure obligatoire) :

```json
{
  "glyphId": 42,
  "cluster": "fi",
  "x": 72.500,
  "y": 120.300,
  "advance": 8.200,
  "fontId": "EBGaramond-Regular",
  "fontSize": 11,
  "ascent": 10.5,
  "descent": 2.5
}
```

**layoutContext** versionné **obligatoire** dans chaque Layout AST :

```json
{
  "typographicEngineVersion": "1.0.0",
  "hyphenationDict": "fr-v1",
  "ruleset": "fr-classic-v1",
  "layoutQuantization": "device-aligned",
  "timestamp": 1710000000
}
```

**Layout quantization** :

- Preview → `"subpixel"`
- Print → `"device-aligned"` : snap glyphes grille **1/1000 pt**

**Renderer adapters** (aucun calcul mise en page dedans) :

- `pdfmakeAdapter` → Layout AST → preview **« Aperçu approximatif »**
- `pdfLibAdapter` → Layout AST → export exact device-aligned

**Archive-proof** : JSON complet du Layout AST dans le rapport final (réimport identique visé).

### C. GeometryEngine — `src/print/GeometryEngine.js`

- safe_zone, bleed au **pixel près**
- Conversions pouces → points → pixels sans erreur d’arrondi cumulée
- Dimensions couverture complète (recto + dos + verso)

**Spine depuis PDF final** — pas d’estimation :

- KDP papier blanc 60# : `pages × 0.0025"`
- IngramSpark 60# white : `pages × 0.002252"`
- IngramSpark 50# white : `pages × 0.002143"`
- Tolérance **± 0.002"** + snap incréments imprimeur

**Compensateur de chasse (creep)** :

```json
{
  "bindingType": "perfect | sewn",
  "paperThickness": 0.0025,
  "signatureSize": 16,
  "enabled": true
}
```

- Livres **> 200 pages** : proposer activation auto
- **Spine overflow** si titre dos **> 90 %** largeur calculée

**Gutter Safety Score** (livres **> 400 pages**) :

```json
{
  "userReadingAngle": 110,
  "coverStiffness": "soft | hard"
}
```

Simulation courbure au pli ; score ergonomique ; alerte si marge géométrique OK mais ergonomie faible ; **GutterSim** Canvas 3D pour preview pli.

### D. ColorBridge — `src/print/ColorBridge.js`

- **Desktop** : LittleCMS **natif** Tauri `invoke`
- **Web** : LittleCMS WASM via TaskQueueManager, cache hash → résultat, progress

Profils : **FOGRA39** (IngramSpark Europe), **GRACoL** (KDP USA) ; perceptive (photos), relative colorimétrique (texte / graphiques).

Noirs : **rich black** fonds (C60 M40 Y40 K100) ; **pure black** texte (K100) ; vérif post-conversion.

Preview : simulation CMJN approximative Canvas, label **« Simulation couleur — non conforme impression »**.

**Gamut warning** : soft < 15 % pixels hors-gamut ; critical > 15 % + surlignage + suggestion désaturation (ex. 12 %).

### E. ImagePreflightEngine — `src/print/ImagePreflightEngine.js`

Pour toutes les images du corps :

- DPI : alerte **bloquante** si < 300 DPI
- Colorspace : RGB → CMJN via ColorBridge
- Scaling : alerte si agrandissement > 100 %
- ICC : profil absent → conversion profil plateforme défaut
- Rapport : liste images OK / Warning / Bloquant

### F. Export PDF/X-4 + ePub

- PDF/X-4 : pdf-lib + LittleCMS ; polices incorporées selon `fontMode` ; OutputIntent ISO 15930-7 ; transparence native (pas flattening par défaut) ; option PDF/X-1a + flattening si explicite

**fontMode** : `embedded | outlined | hybrid-safe` (documentés honnêtement ; outlined = texte non sélectionnable).

Injection **XMP + ISBN** (auteur, titre, éditeur).

**Post-validation** : Desktop binaire natif (veraPDF / Ghostscript) ; Web WASM ; échec → message précis + log + mode dégradé.

**ePub 3.0** : nav.xhtml, spine, Dublin Core, fallback fonts, **Kindle safe CSS** + preview Kindle, validation **EPUBCheck** avant livraison.

**Versioning** : `exports/roman-v1-kdp.pdf`, etc. ; logs (warnings, ICC, layoutContext, fontMode, validation, hash).

**Fin séquence 2** : *SÉQUENCE 2 TERMINÉE — prêt pour la séquence 3.*

---

## Séquence 3 — UI print, profils et alertes

**Prérequis** : Séquences 1 et 2 terminées.

### A. Profils imprimeur — `src/print/profiles/kdp.json`, `ingram.json`

Specs **exclusivement** guides officiels KDP / IngramSpark ; JSON **versionnés** + **date de validité**.

- **KDP** : GRACoL ; formats (5×8", 5.06×7.81", …) ; marges selon nombre de pages ; bleed 0.125" ; zone sécurité 0.25"
- **IngramSpark** : FOGRA39 ; catalogue complet ; marges / bleed officiels

### B. CostEngine — `src/print/CostEngine.js`

Tables tarifaires versionnées + date validité ; fallback **« estimation approximative »** si tables > 6 mois (afficher la date).

Paramètres : plateforme, marché, type distribution, nombre de pages (depuis PDF final), format, type couverture.

### C. Pages de garde automatiques

Formulaire auteur → génération : page de titre, copyright / ours (ISBN, mentions), dédicace, remerciements, **table des matières** auto.

**Alinéas** : premier paragraphe chapitre **sans** retrait ; suivants avec retrait (défaut 0.5 cm, configurable).

### D. UI alertes — étendre onglet **Export** existant (ne pas réécrire)

- Réticule sécurité temps réel
- Alerte texte hors marges sécurité
- **Bloquant** si image couverture < 300 DPI
- Alerte hors-format + estimation pages + coût (CostEngine)
- Alerte creep si > 200 pages
- Gutter Safety Score + alerte si > 400 pages
- Spine overflow titre dos > 90 %
- Gamut warning + suggestion désaturation
- Avertissement `fontMode` outlined
- Sommaire relecture IA optionnel avant export final

### E. Mode simulation imprimeur

Tolérances coupe, décalage massicot, preview dos dimensions réelles, pli central GutterSim 3D, zones danger marquées.

**Fin séquence 3** : *SÉQUENCE 3 TERMINÉE — prêt pour la séquence 4.*

---

## Séquence 4 — PromptArchitect + moteurs de génération

**Prérequis** : Séquences 1–3 terminées.

### Philosophie Kit Média

Vendre le **prompt chirurgical** + **police exclusive**, pas l’image seule. Moteur d’image interchangeable. **Prix libre, minimum 1 €** ; zéro compte obligatoire pour le flux par défaut. **Prompt brut jamais visible** par l’auteur.

### A. PromptArchitect — `src/media/PromptArchitect.js`

Lire AST manuscrit ; extraire couches visuelles avec **confidence** (palette, composition, genre_visuel, etc.) :

- Champ lexical → palette
- Densité dialogues → composition (centrée personnages vs atmosphérique)
- Personnage principal (Bible)
- Éléments visuels récurrents (≥ 3 occurrences)
- Époque / ambiance
- Tension narrative → composition (thriller asymétrique, romance chaude centrée, etc.)
- Genre + patterns commerciaux

Prompt final (~400 mots) : style, palette ratios, personnage, composition, params moteur (`--ar`, `--style`, `--v6` Midjourney), instruction **obligatoire** : *NO text, NO title, NO lettering, NO typography*.

**Exposer** : axes (palette, ambiance, composition) — **pas** le prompt brut.

**Mode low inference** : extraction factuelle sans déduction stylistique. **Questionnaire 5 questions** avant génération.

### B. GenerationEngines — `src/media/GenerationEngines.js`

Moteur **swappable** (config une ligne).

| Niveau | Moteur |
|--------|--------|
| **1** | **Pollinations.ai** (défaut, sans clé) ; fetch ; pause TaskQueue si perte connexion |
| **2** | **Leonardo.ai** ; tuto 3 étapes intégré ; clé dans paramètres ; Desktop Keychain Windows / Web AES local |
| **3** | **Midjourney** ; bouton *Copier prompt Midjourney* + ouverture site ; import image pour post-traitement |

Image reçue : **sans texte / titre**.

**Fin séquence 4** : *SÉQUENCE 4 TERMINÉE — prêt pour la séquence 5.*

---

## Séquence 5 — Post-traitement + kit média final

**Prérequis** : Séquences 1–4 terminées.

### A. TypoLab — `src/media/TypoLab.js`

- Polices **SIL OFL** ; exclusion si clause **No Derivatives**
- Renommage **obligatoire** des polices modifiées
- Hinting supprimé ou recalculé après modif vecteurs
- **5 variations sémantiques** définies (fantasy organique, thriller, romance, SF, historique) — pas d’aléatoire
- **Path cleaning** : auto-intersections, simplification, **winding rules** (trous o, e, a, g), formes fermées ; sinon glyphe base
- **2 étapes** : aperçu **SVG** → validation auteur → compilation **.ttf** uniquement après validation ; vérifier glyphes critiques a, e, g, n, o

### B. SaliencyEngine — `src/media/SaliencyEngine.js`

TensorFlow.js **embarqué** (pas de téléchargement runtime).

`saliencyContext` versionné : `modelVersion`, `precision`, `seed` (ex. 42).

Détection : point focal, direction regard, lignes de fuite → règles placement narratif titre. Fallback heuristique si divergence (auteur informé).

Score combiné : espace_negatif × WCAG × saliency_cohérence × variance_locale.

### C. Pipeline espaces négatifs (9 étapes)

Downscale 256² → edges → heatmap densité → variance contraste locale → simulation blur thumbnail Amazon 150×240 → saliency (ou fallback) → segmentation zones faible densité → scoring → **2–3 zones** suggérées.

### D. ColorPicker + PrintSafetyFilter — `src/media/ColorPicker.js`

Palette dominante (5–7 couleurs), complémentaires, analogues ; **3 options** titre (complémentaire max, analogue chaude, neutre).

PrintSafetyFilter sur chaque option (saturation max CMJN, contraste extrême filtré, validation sur **CMJN**).

**WCAG AA 4.5:1** affiché ; zones < 4.5:1 exclues ou signalées ; forçage possible avec avertissement.

### E. Social Media Safe Zones

6 formats (Instagram post/story, TikTok, Facebook, Twitter/X, Pinterest) — masques UI réseaux ; repositionnement auto ; **overlay** toggleable.

### F. Post-traitement typo 100 % local

Canvas + opentype.js : titre avec .ttf validé, couleur via Smart Color filtrée, hiérarchie titre > auteur, ColorBridge print, gamut warning sur composition finale.

### G. Mockup 3D — Canvas 2.5D

Livre physique (couverture + tranche), perspective, ombre.

### H. Kit média livré

1. Couverture papier dimensions exactes (profil imprimeur)
2. Couverture ebook
3. .ttf exclusif (renommé, path cleaning, winding, hinting)
4. 6 déclinaisons réseaux (safe zones)
5. Mockup 3D
6. Layout AST JSON archive-proof
7. Rapport génération (axes + confidence, saliencyContext, WCAG, PrintSafety, moteur)

**Prix libre min 1 €** au téléchargement kit complet.

**Fin séquence 5** : enchaîner validation globale ci-dessous.

---

## Architecture des fichiers (référence)

| Composant | Fichier |
|-----------|---------|
| TaskQueueManager | `src/print/TaskQueueManager.js` |
| RenderingProfile | `src/print/RenderingProfile.js` |
| FailoverStrategy | `src/print/FailoverStrategy.js` |
| TypographicEngine | `src/print/TypographicEngine.js` |
| PaginationOrchestrator | `src/print/PaginationOrchestrator.js` |
| GeometryEngine | `src/print/GeometryEngine.js` |
| ColorBridge | `src/print/ColorBridge.js` |
| ImagePreflightEngine | `src/print/ImagePreflightEngine.js` |
| PromptArchitect | `src/media/PromptArchitect.js` |
| GenerationEngines | `src/media/GenerationEngines.js` |
| TypoLab | `src/media/TypoLab.js` |
| SaliencyEngine | `src/media/SaliencyEngine.js` |
| ColorPicker | `src/media/ColorPicker.js` |

---

## Hors périmètre Brique 4

- **Correcteur grammatical** → **Brique 5** — document d’accueil : [`CDC-BRIQUE-5.md`](./CDC-BRIQUE-5.md) (CDC définitif à fournir)
- Import → Brique 3
- Support multilingue → V3
- Génération fonte from scratch + hinting complet → version future
- Serveur colorimétrique dédié → version future

---

## Critères de validation finaux (synthèse)

Valider l’ensemble des points couverts par ce document et par [`CDC-BRIQUE-4-CHECKLIST.md`](./CDC-BRIQUE-4-CHECKLIST.md) (infrastructure, moteur print, géométrie, couleur, export, UI print, kit média, TypoLab, post-traitement, `vite build`, etc.). Le produit auteur **Windows** sort du pipeline **`npm run tauri:build`**.

*(La mention d’une grille « 95 critères » était une erreur — ne plus l’utiliser comme référence.)*

---

## État dans le dépôt — **clôture périmètre CDC (repo)**

| Séquence | Statut | Notes |
|----------|--------|-------|
| 1 | ☑ Terminé | `TaskQueueManager`, `RenderingProfile`, `FailoverStrategy` — conforme checklist. |
| 2 | ☑ Terminé | Moteurs print, `PrintExportEngine`, ColorBridge, préflight images, Layout AST versionné, quantization 1/1000 pt. |
| 3 | ☑ Terminé | `PublisherTab` Print pro : profils, coûts, alertes, réticule + zones danger, creep, audit JSON, validation PDF. |
| 4 | ☑ Terminé | `PromptArchitect`, `GenerationEngines`, consignes anti-texte / OCR-friendly dans le prompt. |
| 5 | ☑ Terminé | Kit média : TypoLab, saliency, pipeline zones (grilles fusionnées), safe zones, exports planche/ebook, manifeste, mockup 2.5D. |

**Hors périmètre du CDC Brique 4 dans ce dépôt** : hinting / correcteur vectoriel **complets**, mockup moteur **3D** — voir **versions futures** ou **[`CDC-BRIQUE-4A.md`](./CDC-BRIQUE-4A.md)** pour la suite logique (release, durcissement, raffinements). **Brique 5** (correcteur, etc.) : CDC séparé à venir.

*Dernière mise à jour : clôture périmètre Brique 4 — voir checklist et Brique 4a.*

---

## Brique 4a — suite (backlog)

La **Brique 4** du dépôt couvre l’implémentation décrite dans ce CDC. **Brique 4a** regroupe ce qui reste souvent à faire **après** : ce n’est pas une deuxième grille de scores, mais un **file d’attente** réaliste.

| Thème | Exemples de travaux restants |
|--------|------------------------------|
| **Release** | Installateur signé, canaux de mise à jour, build CI reproductible |
| **Validation terrain** | Épreuves PDF chez imprimeur réel, ajustements profils ICC au retour |
| **Raffinement moteur** | Kerning OpenType complet, heatmap haute densité, mockup 3D si produit l’exige |
| **Qualité** | Tests E2E exports, perfs sur gros manuscrits, accessibilité UI print |

Détail et priorités : **[`CDC-BRIQUE-4A.md`](./CDC-BRIQUE-4A.md)**.
