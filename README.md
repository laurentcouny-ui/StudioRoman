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

## Développement rapide (hot reload)

```bash
cd scriptor && npm run dev
```

→ **http://localhost:5173** avec proxy `/api` vers le backend (lance `mvn spring-boot:run` dans `backend/` si besoin).
