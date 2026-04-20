# RAPPORT PARTIEL — LAYER 3 (QUALITÉ)

Date: 2026-04-20  
Références: `audit-00-core.md`, `audit-L3-qualite.md`

## Résumé
- 🔴 : 2 | 🟠 : 5 | 🟡 : 4 | 🟢 : 1
- Score accessibilité : 65/100
- Score conformité RGPD : 40/100
- Score SEO : 30/100
- Score cohérence : 55/100
- Score dette de prompt : 6/10
- Confiance : 7/10
- Risque régression L3 : 🟡

## Phase -1 — Métriques L3
- Pages publiques : 3 (`scriptor/index.html`, `scriptor/public/privacy.html`, `scriptor/public/splashscreen.html`)
- Pages authentifiées : 0 (pas de flux login/session web détecté; app desktop local-first)
- Chaînes hardcodées estimées : ~800–1200 UI (heuristique)
- Fichiers traduction : non (pas de dossier i18n/locales)
- README/docs/CONTRIBUTING : README présents, docs techniques présents, `CONTRIBUTING.md` absent
- LICENSE présent : non (hors licences vendor)

---

## SECTION 13 — Accessibilité (WCAG 2.2 AA)

## Métriques accessibilité — listes explicites
- `<div onClick>` / `<span onClick>` : 0
- Images `<img>` total : 13
- Avec `alt` : 13
- Sans `alt` : 0
- `alt=""` (à valider décoratif) : 6
  - `scriptor/src/WorldMapTab.jsx`
  - `scriptor/src/CharactersTab.jsx`
  - `scriptor/src/BibleTab.jsx`
  - `scriptor/public/splashscreen.html`
- Inputs total (input/textarea/select) : ~164
- Sans label explicite probable : ~40 (estimation haute)
  - `scriptor/src/PublisherTab.jsx` (file inputs)
  - `scriptor/src/MediaKitTab.jsx` (file input)
  - `scriptor/src/BackupTab.jsx` (file inputs cachés)
- `<html lang>` : OUI (`lang="fr"` sur pages html)
- `outline: none` / `focus:outline-none` : nombreuses occurrences
  - `scriptor/src/App.css` (plusieurs)
  - `scriptor/src/index.css`
  - multiples composants `scriptor/src/ia/*Tool.tsx`

### Findings
- Base sémantique globalement correcte, mais focus visuel fragilisé par suppressions d’outline.
- Plusieurs contrôles formulaire à vérifier pour association label stricte.
- Signaux clavier à reprendre sur éléments `role="button"` + gestion focus.

### Score : 6.5/10 — Risque régression : 🟡

---

## SECTION 14 — Maintenabilité et documentation

## Métriques documentation — état des lieux
- `README.md` : OUI (23 lignes racine, 192 lignes dans `scriptor/README.md`)
- Documentation API : NON (pas d’OpenAPI/Swagger/Postman versionné)
- `CONTRIBUTING.md` : NON
- ADR/docs architecture : partiel (CDC briques + docs projet)
- CHANGELOG : NON (hors vendor)
- LICENSE : NON au niveau racine
- Fonctions publiques sans doc : élevé (top exposé sur `scriptor/src/backupService.js` et `scriptor/src/projectStore.js`)

### Findings
- Onboarding existant mais gouvernance open-source/équipe incomplète (contrib/changelog/license).
- Documentation API formelle absente.

### Score : 5/10 — Risque régression : 🟠

---

## SECTION 15 — Sauvegardes et plan de reprise

## Métriques backups
- Scripts backup :
  - `scriptor/src/backupService.js`
  - `scriptor/src/BackupTab.jsx`
  - `scriptor/scripts/stress-backup.mjs`
- Config backup cloud détecté : OUI (Google Drive + Dropbox)
- Tables total : 2 (`characters`, `bible_entries`)
- Avec soft delete (`deleted_at`) : 0
- Sans soft delete : 2 (tables critiques)
- Runbook restauration : NON formalisé
- Envs séparés : OUI (variables `SCR_*`, `.env`, `.env.example`, `.env.diagnostic`)

### Findings
- Sauvegarde cloud implémentée côté app.
- DRP partiellement implicite, mais pas de runbook RTO/RPO/recovery testé formellement.
- Soft delete absent sur tables métier.

### Score : 6.5/10 — Risque régression : 🟡

---

## SECTION 16 — RGPD / conformité légale

## Métriques RGPD — listes explicites
- Politique confidentialité : OUI (`scriptor/public/privacy.html`)
- Mentions légales : NON
- CGU/CGV : NON
- Bannière cookies : NON
- Cookies/trackers non essentiels avant consentement : non détectés explicitement (à confirmer runtime)
- Endpoint supprimer compte : NON détecté
- Endpoint exporter données : NON détecté
- Tiers identifiés : Google Drive, Dropbox, OpenAI, Anthropic, Gemini, Ollama

### Findings
- Base légale documentaire incomplète pour conformité complète.
- Droits d’effacement/portabilité non implémentés via API.

### Score : 4/10 — Risque régression : 🟠

---

## SECTION 17 — SEO

## Métriques SEO — listes explicites
- Pages publiques : 4 html (incluant `frontend/index.html`)
- Avec `<title>` : 4
- Sans `<title>` : 0
- Meta description : 0/4
- `sitemap.xml` : NON
- `robots.txt` : NON
- JSON-LD : 0

### Findings
- SEO quasi non instrumenté (normal pour app desktop, mais faible si cible web).
- Pas de balises description/robots/sitemap/structured data.

### Score : 3/10 — Risque régression : 🔴

---

## SECTION 18 — Internationalisation

## Métriques i18n — listes explicites
- Librairie i18n : aucune
- Fichiers traduction : aucun
- Chaînes hardcodées : élevé (fortement concentré dans `scriptor/src/WorldMapTab.jsx`, `CorrectorOnboarding.jsx`)
- Dates hardcodées/locales :
  - `scriptor/src/BackupTab.jsx` (`fr-FR`)
  - `scriptor/src/WorldMapTab.jsx` (`fr-FR`)
  - `scriptor/src/App.jsx` (`fr-FR`)
  - `scriptor/src/ia/GlobalSettings.tsx` (`fr-FR`)

### Findings
- Application orientée mono-langue FR; i18n non préparée.
- Formatage localisé FR présent mais non abstrait.

### Score : 4/10 — Risque régression : 🟠

---

## SECTION 19 — Responsive et cross-device

## Métriques responsive
- Meta viewport : OUI
- Media queries : 9
- Breakpoints : 640px, 700px, 760px, 960px
- Framework responsive : Tailwind + CSS custom
- PWA manifest : OUI (`scriptor/public/manifest.webmanifest`)
- Service worker : OUI (`scriptor/public/sw.js`, enregistré dans `scriptor/src/main.jsx`)
- `maximum-scale=1` : NON détecté

### Findings
- Socle responsive/PWA présent et cohérent.
- Vérification ergonomie tactile fine encore à faire en test manuel UI.

### Score : 7/10 — Risque régression : 🟢

---

## SECTION 20 — Dépendances et chaîne d'approvisionnement

## Métriques dépendances — listes explicites
- Manifests :
  - `package.json` (racine)
  - `scriptor/package.json`
  - `frontend/package.json`
  - `backend/pom.xml`
- Lockfiles commitées : OUI (`package-lock.json` racine/scriptor/frontend)
- Dépendances directes : ~46 JS (scriptor+frontend) + backend Maven
- Dépendances transitives (npm) : 619 (`scriptor`)
- `npm audit` connu : 4 critiques (chaîne `protobufjs` / `onnxruntime-web` / `@xenova/transformers`)
- Ghost dependencies structurelles :
  - `frontend/` marqué fusionné mais toujours présent (`frontend/MERGED-INTO-SCRIPTOR.md`)
- Packages importés non listés : non établi de manière certaine (vérification exhaustive outillage dédiée requise)

### Findings
- Risque supply-chain modéré/élevé via CVEs critiques existantes.
- Dette de rationalisation monorepo (front legacy + front actif).

### Score : 5.5/10 — Risque régression : 🟠

---

## SECTION 21 — Migrations et évolution DB

## Métriques migrations
- Système migrations : aucun (Flyway/Liquibase/Prisma absents)
- Migrations versionnées : 0
- Avec `down` : 0
- Sans `down` : 0 (N/A)
- Usage `db push` : non détecté
- Tables total : 2
- Avec foreign keys : 0
- Sans foreign keys : 2
- Tables avec soft delete : 0
- Mode actuel : `ddl-auto: update` dans `backend/src/main/resources/application.yml`

### Findings
- Plus gros risque L3 côté évolution DB (pas de versionning migration).
- `ddl-auto: update` convient au dev mais risqué pour trajectoire prod stricte.

### Score : 3.5/10 — Risque régression : 🔴

---

## SECTION 22 — Hallucination de code (transversal)

## Métriques hallucination — listes explicites
- Imports non résolus : 0 détecté (diagnostics IDE)
- Méthodes obsolètes classiques : 0 détecté
- Incohérences signatures externes : faibles signaux uniquement (à monitorer sur stack IA)
- Ghost dependencies : oui (doublon `frontend`/`scriptor`)

### Findings
- Pas d’indice fort d’hallucination technique active dans le code compilable.
- Risque principal = dette structurelle, pas APIs inventées.

### Score : 7/10 — Risque régression : 🟡

---

## SECTION 23 — Cohérence globale (transversal)

## Métriques cohérence globale — listes explicites
- Formats d’erreur API détectés :
  - JSON standard (`GlobalExceptionHandler`)
  - texte brut via `sendError(...)` (filtres sécurité)
  - réponses text/plain (`/api/health`, `characters/detect`)
- Codes HTTP : globalement corrects mais hétérogènes sur payload format
- Nommage DB : mix léger (`characters`, `bible_entries`)
- Formats réponse :
  - DTO (plusieurs endpoints IA)
  - `Map.of` ad hoc
  - `String` brut

### Findings
- Cohérence API moyenne: comportements corrects, format de réponse non uniforme.
- Harmonisation possible mais potentiellement cassante sans version API.

### Score : 5/10 — Risque régression : 🟠

---

## SECTION 24 — Cohérence mentale — cadavres exquis

## Bibliothèques concurrentes — listes explicites
- HTTP :
  - `fetch`: oui (nombreux fichiers `scriptor/src/*`)
  - `axios`: non détecté
  - `got/node-fetch`: non détecté
  - Verdict: OK
- Dates :
  - `moment/date-fns/dayjs/luxon`: non détectés en usage actif app
  - `Date` natif + `toLocale*`: oui
- State management :
  - Context + useState (pas de Redux/Zustand/Jotai)
- Forms :
  - manuel (`useState`)
- Validation :
  - Jakarta Bean Validation backend + validations front manuelles
- CSS :
  - Tailwind + CSS custom + styles inline (redondance)
- UI kit :
  - maison

## Signes objectifs de dette de prompt — listes explicites
- `hack/fix/workaround/temp/todo refactor/do not touch` hors vendor : faible
- Fonctions/fichiers versionnés :
  - `scriptor/src/ThesaurusData/conflits_old.js`
- Fichiers/dossiers orphelins probables :
  - `frontend/` (marqué fusionné)
  - duplication `grammalecte-fr` et `gramalecte-fr`
- Patterns auth/API :
  - loopback-only + API token optionnel + endpoint OAuth dédié

## Score dette de prompt /10
- Pénalités:
  - state management redondant: -1
  - validation (double paradigme): -1
  - CSS (3 modes): -2
  - commentaires dette: 0
  - fonctions versionnées: 0
- **Score final: 6/10**

## Matrice de redondance (extrait)
| Fonctionnalité | Implémentation #1 | #2 | #3 |
|---|---|---|---|
| Appel HTTP | `fetch` (`scriptor/src/ia/apiClient.ts`) | `fetch` direct (`scriptor/src/backupService.js`) | - |
| Validation | Jakarta Bean Validation (`backend/...Request.java`) | checks manuels front (`scriptor/src/ia/*.tsx`) | - |
| Styling UI | Tailwind classes (`scriptor/src/ia/*`) | CSS global (`scriptor/src/App.css`) | inline styles (plusieurs composants) |

### Score : 6/10 — Risque régression : 🟡

---

## Scoreboard L3
- S13 Accessibilité: 6.5/10 🟡
- S14 Documentation: 5/10 🟠
- S15 Backups/DRP: 6.5/10 🟡
- S16 RGPD: 4/10 🟠
- S17 SEO: 3/10 🔴
- S18 i18n: 4/10 🟠
- S19 Responsive: 7/10 🟢
- S20 Dépendances: 5.5/10 🟠
- S21 Migrations DB: 3.5/10 🔴
- S22 Hallucination: 7/10 🟡
- S23 Cohérence globale: 5/10 🟠
- S24 Cohérence mentale: 6/10 🟡

## Top 5 fichiers à risque L3
- `backend/oauth-local.properties`
- `backend/src/main/resources/application.yml`
- `scriptor/src/backupService.js`
- `scriptor/src/App.css`
- `scriptor/src/WorldMapTab.jsx`

## ✅ Ce qui est bien fait (NE PAS CASSER)
- Garde-fous L1 toujours actifs (loopback/token/headers).
- PWA déjà en place (manifest + service worker).
- Sauvegarde cloud app existante (Google Drive/Dropbox).
- Validation backend structurée (Jakarta).

---

## AUTO-VALIDATION L3

### 3 affirmations re-vérifiées
1. Les sections les plus faibles sont SEO et migrations DB, avec preuves de fichiers manquants et `ddl-auto: update`.
2. L’app reste principalement mono-stack HTTP (`fetch`) et ne présente pas de chaos de libs concurrentes majeur.
3. La conformité légale est partielle (privacy seule, pas de mentions/CGU/export/suppression compte).

### Zones de faible confiance
- Décompte exact des inputs sans label (analyse statique sans rendu DOM).
- Estimation fine des chaînes hardcodées (heuristique).
- État CVE temps réel (basé sur dernier audit disponible).

### Métriques L3
- Couverture sections évaluées : 12/12
- 🔴 : 2 | 🟠 : 5 | 🟡 : 4 | 🟢 : 1
- Confiance : 7/10
- Risque régression L3 : 🟡

## Prochaines étapes
Prêt pour L4 (Maintenabilité & Évolution) dès validation humaine.
