# Scriptor (monorepo)

- **`scriptor/`** — application web (React / Vite) : écriture, bible, export, etc.
- **`backend/`** — API Spring Boot (IA, LLM, modules).
- **`config/`** — fichiers runtime (prompts, providers, SQLite, données JSON).

## Lancer comme en production (rien d’autre à démarrer)

```bash
docker compose up --build
```

→ **http://localhost:8080** (interface + API).

Sans Docker : voir **`DEPLOIEMENT.md`**.

## Qualite continue

- CI GitHub Actions: `.github/workflows/ci.yml`
- Gate securite npm (frontend): `cd scriptor && npm run security:audit`
- Contrat OpenAPI baseline versionne: `backend/openapi/openapi-baseline.yaml`
- Controle de derive OpenAPI en PR: `scripts/check-openapi-drift.mjs`
- Lint OpenAPI strict: `npm run openapi:lint`

## Contributing et gouvernance

- Guide contribution: `CONTRIBUTING.md`
- Decisions d'architecture (ADR): `docs/adr/`
- Confidentialite et traitement des donnees: `PRIVACY.md`
- Licence open source: `LICENSE`

## Développement rapide (hot reload)

```bash
cd scriptor && npm run dev
```

→ **http://localhost:5173** avec proxy `/api` vers le backend (lance `mvn spring-boot:run` dans `backend/` si besoin).
