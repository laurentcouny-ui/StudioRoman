# RAPPORT PARTIEL — LAYER 2 (SCALABILITÉ)

Date: 2026-04-20  
Références: `audit-00-core.md`, `audit-L2-scalabilite.md`

## Résumé
- 🔴 : 6 | 🟠 : 11 | 🟡 : 17 | 🟢 : 13
- Score robustesse : 64/100
- Score performance : 52/100
- Score observabilité : 46/100
- Risque coût : ÉLEVÉ
- Confiance : 7/10
- Risque régression L2 : 🟡

## Métriques L2
- Appels externes APIs tierces : 15 endpoints identifiés, dans 11 fichiers runtime.
- Dépendances total : 57 déclarées (npm + pom), 619 résolues côté `scriptor` (`npm audit`), CVE/GHSA critiques détectées : 4 (`protobufjs` via `onnxruntime-web`/`@xenova/transformers`).
- Fichiers de tests : 4 (2 JUnit backend + 2 scripts de self/stress tests).
- Ratio LOC tests / LOC app : ~1% (estimation, précision fine à confirmer par script dédié).
- Files queue/jobs : pool async Spring (`core=4`, `max=50`, `queue=1000`), `TaskQueueManager.js`, auto-upload intervalle 5 min.
- Cache layer : aucun cache Redis/Memcached/CDN; cache localStorage/in-memory uniquement.
- CDN : aucun.

---

## SECTION 6 — Architecture et dette technique

### Métriques architecture — listes explicites
- Fichiers > 500 lignes : 15
- Liste explicite :
  - `scriptor/src/App.css` (5955)
  - `scriptor/src/WritingTab.jsx` (2600)
  - `scriptor/src/PublisherTab.jsx` (1833)
  - `scriptor/src/App.jsx` (1574)
  - `scriptor/src/publishersData.js` (1344)
  - `scriptor/src/backupService.js` (1170)
  - `scriptor/src/WorldMapTab.jsx` (1112)
  - `scriptor/src/MediaKitTab.jsx` (1109)
  - `scriptor/src/ImportTab.jsx` (1003)
  - `scriptor/src/projectStore.js` (922)
  - `scriptor/src/BibleTab.jsx` (862)
  - `scriptor/src/UserGuideTab.jsx` (736)
  - `scriptor/src/storageAdapter.js` (703)
  - `scriptor/src/platform/DesktopBootstrap.tsx` (621)
  - `scriptor/src-tauri/src/storage_fs.rs` (2519)
- Fonctions > 100 lignes : 8 (notamment `App`, `WritingTab`, `PublisherTab`, `ImportTab`, `MediaKitTab`, `BibleTab`, `BackupTab`, `completeGoogleAuth`).
- Dépendances circulaires : 0 confirmée (vérification fine graphe recommandée via outil dédié).
- TODO/FIXME/HACK/XXX : 0 significatif dans code produit (occurrences surtout dans vendor/assets).
- Dead code suspect :
  - `scriptor/src/addonRequestUtils.js` (fonctionnalités non branchées mentionnées dans le code)
  - duplication probable de sous-arbres entre `frontend/` et `scriptor/`
  - double arborescence `gramalecte`/`grammalecte` dans `scriptor/public/`
- `any` (TS) top 20 : principalement dans `scriptor/src/ia/*.tsx` et `scriptor/src/platform/DesktopBootstrap.tsx`.

### Findings
- Séparation couches globale correcte backend (controller/service/repository), mais frontend avec composants monolithiques.
- Dette structurelle élevée sur gros composants UI (lisibilité, testabilité, coût de changement).
- Risque de duplication fonctionnelle entre deux fronts (`frontend/` et `scriptor/`) à clarifier.
- Typage TS présent mais `any` récurrent sur flux d’erreur/réponses.

### Score : 5.5/10 — Risque régression : 🟡

---

## SECTION 7 — Performance et scalabilité

### Métriques performance — listes explicites
- Requêtes DB identifiées : ~8 zones principales.
- Avec pagination : 0 explicite.
- Sans pagination/LIMIT (liste explicite) :
  - `backend/.../BibleReaderService.java` (`findByContenuContainingIgnoreCase`)
  - `backend/.../CharacterCatalogService.java` (`searchByKeyword`)
  - `backend/.../BiblePropositionService.java` (`findAll`)
  - `backend/.../NarrativeChallengeService.java` (`findAll`)
  - `backend/.../CharacterDetectionService.java` (`findAll`)
  - `backend/.../ForgottenCharacterService.java` (`findAll`)
- N+1 suspectes : 0 pattern JPA classique confirmé; risque principal = full table scan + filtrage mémoire.
- Cache :
  - applicatif local: oui (localStorage/in-memory)
  - HTTP API backend: non
  - CDN: non
- Endpoints GET sans cache HTTP explicite : 12+ (`/api/health`, `/api/v1/ia/health`, `/api/v1/ia/settings`, `/api/v1/ia/map/data`, etc.).
- Images :
  - assets modernes WebP/AVIF : 0
  - PNG/JPEG : 0 détectées dans app principale (majoritairement SVG)
- `useEffect` total : 79
- `useEffect` suspects (churn/side-effects fréquents) : `App.jsx`, `WritingTab.jsx`, `BibleTab.jsx`, `PublisherTab.jsx`.

### Findings
- Goulot DB principal : absence de pagination côté recherches/agrégations.
- Monolithes React + nombreux effets = risque de latence UI sous charge éditoriale.
- Politique cache API absente (latence et coût réseau évitables).
- Appels externes majoritairement sans stratégie commune timeout/retry/429.

### Score : 5.0/10 — Risque régression : 🟡

---

## SECTION 8 — Observabilité

### Métriques observabilité — listes explicites
- `console.*` détectés : nombreux (runtime + scripts); top runtime dans :
  - `scriptor/src/platform/web.ts`
  - `scriptor/src/platform/initDiagnostics.ts`
  - `scriptor/src/main.jsx`
  - `scriptor/src/ia/GlobalSettings.tsx`
  - `scriptor/src/PublisherTab.jsx`
  - `scriptor/src/ImportTab.jsx`
- Logger structuré backend : OUI (`@Slf4j`, log file + rotation dans `backend/src/main/resources/application.yml`).
- Logs PII potentiels : suspects faibles/modérés (logs de `keyword`, erreurs provider, contextes textuels).
- Error tracking (Sentry/Rollbar/Bugsnag) : NON détecté.
- Healthcheck : OUI (`/api/health`, `/api/v1/ia/health`, `/api/v1/ia/ollama/status`).
- Export Prometheus/StatsD : NON détecté.

### Findings
- Backend logging correct pour un mode local, mais observabilité produit incomplète.
- Pas de stack de monitoring/alerting externe.
- Risque de logs verbeux non corrélés (pas de request_id/trace_id généralisé).

### Score : 4.5/10 — Risque régression : 🟡

---

## SECTION 9 — Tests automatisés

### Métriques tests — listes explicites
- LOC app : élevé (front + backend) | LOC tests : faible | ratio ~1%.
- Fichiers de tests : 4
  - `backend/src/test/java/com/scriptor/api/ScriptorApplicationTests.java`
  - `backend/src/test/java/com/scriptor/api/ScriptorStressTests.java`
  - `scriptor/scripts/stress-test.mjs`
  - `scriptor/scripts/pdf-reconstruct-selftest.mjs`
- Unitaires dédiés front : 0.
- Intégration backend : 2.
- E2E Playwright/Cypress : 0.
- Tests skipped/todo : 0 détecté (`test.skip`, `@Disabled`, `todo(`).
- Zones à haut risque sans tests dédiés :
  - Auth token (`ApiTokenFilter`)
  - Upload cloud (`backupService.js`)
  - Endpoints IA critiques (`/api/v1/ia/*`)
  - Map verification/editor.
- CI repo : absente (hors dossiers vendor).

### Findings
- Couverture insuffisante pour les zones critiques prod.
- Aucune barrière CI visible pour bloquer merge si tests rouges.
- Forte dépendance aux tests manuels.

### Score : 3.5/10 — Risque régression : 🔴

---

## SECTION 10 — Rate limiting et anti-abus

### Métriques rate limiting — listes explicites
- Middleware global rate limit : NON.
- Endpoints sensibles sans limite (exemples explicites) :
  - `POST /api/v1/oauth/google/token`
  - `POST /api/v1/ia/settings/apikey`
  - `POST /api/v1/ia/settings/apikey/test`
  - `POST /api/v1/ia/challenges/generate`
  - `POST /api/v1/ia/analysis/narrative`
  - `POST /api/v1/ia/analysis/review`
  - `POST /api/v1/ia/page-blanche/diagnose`
  - `POST /api/v1/ia/summary/chapter`
  - `POST /api/v1/ia/resume/generate`
  - `POST /api/v1/ia/publisher/generate`
  - `POST /api/v1/ia/map/verify`
  - `POST /api/v1/ia/characters/detect`
- CAPTCHA sur formulaires sensibles : NON détecté.

### Findings
- Risque d’abus bruteforce/bot élevé sur endpoints IA/OAuth.
- Aucun palier progressif (global + strict par endpoint).

### Score : 2.5/10 — Risque régression : 🔴

---

## SECTION 11 — Webhooks et intégrations externes

### Métriques webhooks et appels externes — listes explicites
- Webhooks entrants : 0 endpoint détecté.
- Vérification HMAC : N/A (absence de webhook entrant).
- Appels externes sortants : 15 endpoints identifiés (Google, Dropbox, OpenAI, Anthropic, Gemini, Ollama, Pollinations, Leonardo, GitHub release check, LanguageTool local).
- Timeout configuré : partiel
  - OUI: `LLMSettingsController`, `OllamaLocalProvider`, `updateCheckCore.ts`
  - NON explicite: `OpenAIProvider`, `AnthropicProvider`, `GeminiProvider`, une partie de `backupService.js`, `GenerationEngines.js`
- Retry backoff :
  - OUI: upload backup cloud (`backupService.js`, retries bornés)
  - NON: majorité des autres appels externes
- Gestion 429 explicite : NON détectée.

### Findings
- Résilience externe inégale selon providers.
- Pas de stratégie unifiée timeout/retry/backoff/circuit-breaker.

### Score : 4.5/10 — Risque régression : 🟡

---

## SECTION 12 — Coûts cloud et LLM

### Métriques coûts — listes explicites
- Appels LLM dans le code : 5 zones principales
  - `OpenAIProvider.java` (`gpt-4o`)
  - `AnthropicProvider.java` (`claude-3-5-sonnet-20240620`)
  - `GeminiProvider.java` (`gemini-2.5-flash`)
  - `OllamaLocalProvider.java` (modèle configurable, défaut `qwen2.5:7b`)
  - `LLMSettingsController.java` (test API key, modèle ping)
- Cache sémantique : NON détecté.
- Boucles potentielles :
  - `setInterval` périodiques (backup/update checks)
  - 79 `useEffect` (churn sur gros composants)
- Quotas utilisateur IA : NON.
- Hard cap journalier/mensuel : NON.
- Tracking tokens par user : NON.
- Clés API LLM côté client :
  - usage de `VITE_AI_API_TOKEN` détecté dans `scriptor/src/ia/apiClient.ts` et `scriptor/src/backupService.js`.

### Estimation coût mensuel — 1000 users actifs
- Hypothèses : 20–100 requêtes IA/user/mois, 2k–8k tokens/requête, mix local/cloud variable.
- Bas : 20€–200€ (usage majoritairement local/Ollama + cloud ponctuel).
- Haut : 1 500€–8 000€+ (usage cloud intensif sans cache ni quota).
- Risque dominant : absence de quotas/rate-limit IA + endpoints exposés au spam local.

### Pire scénario réaliste (v3.2)
- Scénario catastrophe : token client réutilisé + script d’abus sur endpoints IA + providers cloud activés.
- Impact : >10 000€/mois possible avant réaction.
- Probabilité : MOYENNE.
- Détectabilité : SOUS 24H (si monitoring actif), sinon SOUS 1 SEMAINE.

### Top 5 patterns risque explosion coût
1. Absence rate limit IA → multiplicateur x20+
2. Pas de quotas/hard cap par user → x10+
3. Pas de cache sémantique sur prompts répétitifs → x3 à x8
4. Appels externes sans timeout/retry policy homogène → x2 à x5 (incidents + retries manuels)
5. Monolithes UI avec effets fréquents (sur-appels indirects) → x2+

### Score : 3.5/10 — Risque régression : 🔴

---

## Top 3 bottlenecks identifiés dans L2

### Bottleneck #1 — Render/UI
- Localisation : `scriptor/src/App.jsx`, `scriptor/src/WritingTab.jsx`
- Preuve : fonctions très longues + 79 `useEffect` au total + effets globaux déclenchés sur état projet.
- Impact estimé : jank UI / latence interaction en montée de charge éditeur.
- Sous quelle charge : sessions d’édition soutenues (updates fréquents / projets volumineux).
- Correction recommandée : découpage composants, mémoïsation sélective, debounce persistance.
- Gain attendu : -30% à -60% de latence p95 UI.

### Bottleneck #2 — DB/API
- Localisation : `backend/.../NarrativeChallengeService.java`, `CharacterDetectionService.java`, `ForgottenCharacterService.java`, `BiblePropositionService.java`
- Preuve : `findAll()` + filtrage en mémoire, absence pagination.
- Impact estimé : dégradation CPU/RAM et temps réponse avec croissance données.
- Sous quelle charge : base de données volumineuse (dizaines de milliers d’entrées).
- Correction recommandée : pagination serveur + index + requêtes ciblées.
- Gain attendu : -50% à -90% sur latence requêtes critiques.

### Bottleneck #3 — Network/LLM
- Localisation : `backend/src/main/java/com/scriptor/api/llm/providers/*`, `scriptor/src/media/GenerationEngines.js`, `scriptor/src/backupService.js`
- Preuve : timeouts/retry/429 incomplets et hétérogènes.
- Impact estimé : appels bloqués, saturation workers/threads, erreurs en cascade.
- Sous quelle charge : pics de requêtes IA + lenteur providers externes.
- Correction recommandée : politique HTTP unifiée (timeout borné, retry jitter, backoff 429, circuit breaker).
- Gain attendu : forte baisse des timeouts bloquants et de la latence queue.

### Diagnostic synthétique
Le maillon faible principal sous charge est le combo **monolithes UI + endpoints IA non limités + accès DB non paginés**.

---

## AUTO-VALIDATION L2

### 3 affirmations re-vérifiées
1. Les endpoints backend IA/OAuth critiques existent et sont majoritairement sans rate limiting explicite.
2. Des CVE critiques npm sont présentes dans l’arbre de dépendances (`npm audit`: 4 critiques).
3. La couverture de tests sur zones critiques est faible et non protégée par CI visible.

### Zones de faible confiance
- Quantification exhaustive dead code/ghost dependencies (outil de graphe requis pour certitude).
- Taille exacte des assets image (inventaire binaire détaillé non exécuté).
- Ratio LOC tests/app précis au pourcentage fin.

### Métriques L2
- Couverture estimée : ~1%
- 🔴 : 6 | 🟠 : 11 | 🟡 : 17 | 🟢 : 13
- Confiance : 7/10
- Risque régression L2 : 🟡

---

## Top 5 fichiers à risque L2
- `scriptor/src/App.jsx` (orchestration massive, effets globaux)
- `scriptor/src/WritingTab.jsx` (taille/complexité très élevée)
- `scriptor/src/backupService.js` (I/O externe, OAuth, retries partiels)
- `backend/src/main/java/com/scriptor/api/llm/providers/OpenAIProvider.java` (coût/résilience)
- `backend/src/main/java/com/scriptor/api/modules/challenges/NarrativeChallengeService.java` (requêtes non paginées)

## Ce qui est bien fait (NE PAS CASSER)
- Garde-fous L1 en place (loopback + token API optionnel + headers sécurité).
- Durcissement validation DTO backend (`@Valid`, contraintes Jakarta).
- Retry cloud upload déjà implémenté sur sauvegardes (base utile pour généraliser).
- Health endpoints présents et opérationnels.

## Prochaines étapes
- Prêt pour L3 dès validation humaine de ce rapport L2.
