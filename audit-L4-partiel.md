# RAPPORT PARTIEL — LAYER 4 (PÉRENNITÉ)

Date: 2026-04-20  
Références: `audit-00-core.md`, `audit-L4-perennite.md`

## Résumé
- 🔴 : 2 | 🟠 : 4 | 🟡 : 6 | 🟢 : 3
- Score maintenabilité: 61/100
- Score évolutivité: 66/100
- Bus factor estimé: 1
- Risque pérennité à 12 mois: 🟡
- Confiance: 7/10

## Phase -1 — Métriques L4
- Dernier commit: `54186f0` (2026-04-18, auteur `Lolodev`)
- Fréquence commits (12 mois observés): 1
- Répartition auteurs (`git shortlog --all`): 1 auteur unique
- Dépendances npm (scriptor): 619 (316 prod / 290 dev / 77 optional)
- Vulnérabilités npm: 4 critiques (`@xenova/transformers` -> `onnxruntime-web` / `onnx-proto` / `protobufjs`)
- Automatisation updates (Renovate/Dependabot projet): absente (hors dossier vendor)
- CI projet (hors vendor): absente

---

## SECTION 25 — Stratégie de mises à jour

## État des lieux des mises à jour — listes explicites
- Total dépendances npm auditées (`scriptor`): 619
- Vulnérabilités critiques: 4
- Dépendances avec version `latest` supérieure (`npm outdated`): 12 (échantillon significatif)
- Mécanisme automatique de PR de mise à jour:
  - Total attendu: 2 (Renovate + Dependabot)
  - Conformes: 0
  - Non conformes: 2
  - Liste explicite des non conformes:
    - `renovate.json` absent
    - `.github/dependabot.yml` absent (hors `scriptor/src-tauri/vendor/softbuffer/.github/dependabot.yml`)
- CI bloquante upgrades:
  - Total workflows projet attendus: >=1
  - Conformes: 0
  - Non conformes: 1
  - Liste explicite des non conformes:
    - `.github/workflows/*` absent au niveau projet (hors vendor)

### Findings
- `🔴` Pas de pipeline CI projet pour bloquer une upgrade cassante.
- `🟠` Pas d’automatisation de mises à jour (ni Renovate ni Dependabot projet).
- `🟠` 4 vulnérabilités critiques non traitées côté chaîne IA (`npm audit`).
- `🟢` Runtime Node/Rust/JDK bien borné (`scriptor/.nvmrc`, `scriptor/rust-toolchain.toml`, `backend/pom.xml`, `Dockerfile`).

### Score: 4.5/10 — Risque régression: 🔴

---

## SECTION 26 — Évolutivité architecturale

## Signaux évolutivité — listes explicites
- Providers IA abstraits:
  - Total providers détectés: 4
  - Conformes (implémentent interface commune): 4
  - Non conformes: 0
  - Liste des conformes:
    - `backend/src/main/java/com/scriptor/api/llm/providers/OllamaLocalProvider.java`
    - `backend/src/main/java/com/scriptor/api/llm/providers/OpenAIProvider.java`
    - `backend/src/main/java/com/scriptor/api/llm/providers/GeminiProvider.java`
    - `backend/src/main/java/com/scriptor/api/llm/providers/AnthropicProvider.java`
- Feature flags:
  - Total flags applicatives détectées: 2
  - Conformes: 2
  - Non conformes: 0
  - Liste: `VITE_ENABLE_AI_PANEL`, `VITE_ENABLE_THESAURUS` dans `scriptor/src/featureFlags.js`
- ADR architecture:
  - Total attendu: >=1
  - Conformes: 0
  - Non conformes: 1
  - Liste explicite des non conformes:
    - aucun fichier ADR détecté (`ADR*.md` absent)

### Findings
- `🟢` Bonne base modulaire côté orchestration LLM (`LLMProvider` + `LLMOrchestrator`).
- `🟡` Feature flags présents mais limités au scope UI IA/thésaurus.
- `🟠` Absence d’ADR formalisées: risque de perte de contexte architectural.

### Score: 7/10 — Risque régression: 🟡

---

## SECTION 27 — Stabilité des contrats

## Contrats détectés — listes explicites
- Endpoints API versionnés:
  - Total endpoints détectés (`@RequestMapping("/api...")`): 19
  - Conformes (préfixe `/api/v1`): 19
  - Non conformes: 0
- Endpoints API hors versioning:
  - Total endpoints hors `/api/v1` détectés: 1
  - Liste explicite:
    - `backend/src/main/java/com/scriptor/api/ApiPingController.java` (`/api/health`)
- Schéma OpenAPI/Swagger:
  - Total attendu: >=1
  - Conformes: 0
  - Non conformes: 1
  - Liste explicite des non conformes:
    - aucun fichier/config OpenAPI détecté
- Migrations DB versionnées:
  - Total systèmes détectés: 0
  - Non conformes: 1
  - Liste explicite des non conformes:
    - aucun dossier de migration (`migrations/`, Flyway, Liquibase)

### Findings
- `🟡` Versioning API globalement propre (v1), sauf endpoint santé volontairement hors version.
- `🟠` Absence de contrat machine-readable (OpenAPI).
- `🔴` Absence de migration versionnée/reversible (cf. `ddl-auto: update`).

### Score: 5.5/10 — Risque régression: 🟡

---

## SECTION 28 — Documentation vivante

## Documentation présente — listes explicites
- Documentation existante:
  - `README.md` (racine)
  - `scriptor/README.md`
- Documentation manquante:
  - `CHANGELOG.md` (projet)
  - `CONTRIBUTING.md`
  - `LICENSE` (projet)
  - ADR (`ADR*.md`)
- Dette commentaires TODO/FIXME/HACK dans code source applicatif:
  - Total: 0 (sur `backend/src/main/java` + `scriptor/src` fichiers `js/jsx/ts/tsx/java`)

### Findings
- `🟡` README riches et exploitables pour onboarding.
- `🟠` Gouvernance documentaire incomplète (changelog/contributing/license/ADR absents).
- `🟢` Faible dette de commentaires temporaires dans le code applicatif.

### Score: 6/10 — Risque régression: 🟢

---

## SECTION 29 — Reversibilité et rollback

## Mécanismes rollback — listes explicites
- Rollback applicatif détecté:
  - `scriptor/src/storageAdapter.js` (`restoreLatestSnapshot`)
  - `scriptor/src/import/importSessionClient.js` (`importRestoreFromPreImportBackup`)
  - `scriptor/src/ImportTab.jsx` (UI de restauration + annulation import)
- Rollback DB via migration `down`:
  - Total attendu: >=1
  - Conformes: 0
  - Non conformes: 1
  - Liste explicite des non conformes:
    - aucun mécanisme `down` détecté (absence de framework de migration)
- Procédure rollback/runbook:
  - Total attendu: >=1 document opératoire dédié
  - Conformes: 0
  - Non conformes: 1
  - Liste explicite des non conformes:
    - aucun runbook rollback explicite détecté dans docs projet

### Findings
- `🟢` Rollback fonctionnel bien présent côté import/stockage desktop.
- `🔴` Risque structurel DB: pas de rollback migration versionné.
- `🟠` Runbook de restauration non formalisé pour exploitation équipe.

### Score: 6/10 — Risque régression: 🔴

---

## SECTION 30 — Onboarding et bus factor

## Bus factor — listes explicites
- Auteurs commits:
  - Top 3: `Lolodev: 100%`
  - Bus factor estimé: 1
- Onboarding:
  - Conformes: README racine + `scriptor/README.md` détaillé
  - Non conformes: absence de `CONTRIBUTING.md`

### Findings
- `🔴` Bus factor très faible (un seul contributeur observé).
- `🟡` Onboarding technique bon pour installation/exécution, mais gouvernance équipe incomplète.

### Score: 5/10 — Risque régression: 🟡

---

## SECTION 31 — Dette technique mesurée

## Mesure de la dette — listes explicites
- Marqueurs TODO/FIXME/HACK/XXX (code applicatif):
  - Total: 0
  - Conformes: 0 (N/A)
  - Non conformes: 0
- Linter:
  - Config présente: `scriptor/eslint.config.js`
  - Exécution intégrée: `scriptor/package.json` (`npm run lint`)
- Gate qualité local:
  - Script de validation présent: `scriptor/scripts/cdc-gate.mjs`
  - Point faible: lint non bloquant par défaut (`CDC_STRICT_LINT=1` requis)

### Findings
- `🟢` Endettement "commentaire temporaire" faible dans le code métier.
- `🟡` Qualité pilotée surtout en local; absence de CI rend le contrôle fragile.

### Score: 7/10 — Risque régression: 🟡

---

## AUTO-VALIDATION L4

### 3 affirmations re-vérifiées
1. Les automatisations d’upgrade sont absentes (Renovate/Dependabot projet non présents).
2. Le rollback applicatif existe côté desktop/import, mais pas de rollback DB versionné.
3. Le versioning API est majoritairement correct (`/api/v1/*`) avec exception `GET /api/health`.

### Zones de faible confiance
- Historique Git potentiellement incomplet (repo observé avec 1 commit seulement).
- Dette technique cyclomatique non mesurée (pas d’outil de complexité branché).
- État CI distant (GitHub Actions) non vérifiable sans remote branch/workflows projet.

### Métriques L4
- Couverture sections évaluées: 7/7
- 🔴 : 2 | 🟠 : 4 | 🟡 : 6 | 🟢 : 3
- Confiance globale: 7/10
- Risque régression corrections L4: 🟡

## ✅ Ce qui est bien fait (NE PAS CASSER)
- Abstraction providers IA propre (`LLMProvider` + orchestrateur central).
- Feature flags déjà présentes pour couper des modules sans refactor lourd.
- Mécanismes de snapshot/restore import existants et exposés en UI.
- Runtime borné (Node/Rust/JDK) et stack Docker explicitement versionnée.

## Prochaines étapes
1. Mettre en place CI projet (lint/build/tests bloquants sur PR).
2. Activer Dependabot ou Renovate (patch/minor auto, major manuelles).
3. Formaliser un runbook rollback (app + DB + import restore).
4. Introduire un système de migrations versionnées (Flyway/Liquibase) avant évolutions DB sensibles.

## 🛑 STOP — VALIDATION HUMAINE REQUISE

Fin L4 partiel — prêt pour consolidation finale après validation humaine.
