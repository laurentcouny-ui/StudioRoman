# Déployer Scriptor (une seule appli)

L’interface et l’API tournent **au même endroit** : tu n’as **pas** à lancer Vite à part en production.

## En production / pour un tiers

### Option A — Docker (recommandé, une commande)

À la racine du projet (là où se trouvent `docker-compose.yml`, `scriptor/`, `backend/`, `config/`) :

```bash
docker compose up --build
```

Puis ouvre **http://localhost:8080** dans le navigateur.

- Le dossier **`config/`** du projet est monté dans le conteneur : prompts, providers, SQLite, clés, etc. restent sur ton disque.
- Le conteneur force le profil Spring **`prod`** (`SPRING_PROFILES_ACTIVE=prod`) avec schéma en mode **validate**.

### Option B — JAR Java (sans Docker)

1. Installe **Java 21** et **Maven**.
2. Depuis la racine du dépôt :

```bash
cd backend
mvn -DskipTests package
```

Le Maven build **télécharge Node**, fait **`npm ci`** et **`npm run build`** dans `../scriptor`, puis copie le site dans le JAR.

3. Lance :

```bash
java -jar target/scriptor.jar
```

Ouvre **http://localhost:8080**.

> Le premier `mvn package` peut être long (téléchargement de Node + build npm). Les suivants sont plus rapides.

### Désactiver le rebuild du frontend (optionnel)

Si tu viens de builder le frontend (`cd scriptor && npm run build`) et tu veux accélérer Maven :

```bash
cd backend
mvn -DskipTests -Dskip.npm=true package
```

(Le dossier `scriptor/dist` doit déjà exister.)

Profil Maven équivalent : `-Pno-frontend-build`.

---

## En développement

- **Tout-en-un** : `cd backend` puis `mvn spring-boot:run` → après le premier build, l’app est sur **http://localhost:8080** (comme en prod).
- **Frontend seul avec rechargement rapide** : `cd scriptor` puis `npm run dev` → **http://localhost:5173** (proxy `/api` vers le backend sur 8080 si tu le lances à part).

---

## Variables d’environnement (Docker / hébergeur)

| Variable            | Rôle                                      | Défaut (hors Docker)     |
|---------------------|-------------------------------------------|---------------------------|
| `SCR_CONFIG_DIR`    | Dossier `prompts.yml`, `.master.key`, etc. | `../config` (depuis `backend/`) |
| `SCR_DATA_DIR`      | Données JSON / fichiers data              | `../config/data`          |
| `SCR_SQLITE_PATH`   | Fichier SQLite                            | `../config/data/scriptor.db` |
| `SCR_JPA_DDL_AUTO`  | Stratégie Hibernate schema                | `update` (dev), `validate` conseillé en prod |
| `SCR_API_RATE_LIMIT_ENABLED` | Active limite anti-abus API IA     | `true` |
| `SCR_API_RATE_LIMIT_MAX_REQUESTS` | Requêtes mutantes max par fenêtre | `120` |
| `SCR_API_RATE_LIMIT_WINDOW_SECONDS` | Taille fenêtre de rate limit | `60` |
| `SCR_API_RATE_LIMIT_HEAVY_MAX_REQUESTS` | Limite endpoints IA lourds (summary/resume/analysis/challenges) | `30` |
| `SCR_API_RATE_LIMIT_HEAVY_WINDOW_SECONDS` | Fenêtre endpoints IA lourds | `60` |
| `SCR_API_RATE_LIMIT_HEAVY_PREFIXES` | Préfixes endpoints lourds (CSV) | `/api/v1/ia/resume,/api/v1/ia/analysis,/api/v1/ia/challenges` |
| `SCR_API_RATE_LIMIT_VERY_HEAVY_MAX_REQUESTS` | Limite endpoints IA très coûteux | `20` |
| `SCR_API_RATE_LIMIT_VERY_HEAVY_WINDOW_SECONDS` | Fenêtre endpoints IA très coûteux | `60` |
| `SCR_API_RATE_LIMIT_VERY_HEAVY_PREFIXES` | Préfixes endpoints très coûteux (CSV) | `/api/v1/ia/summary` |

Sous Docker, ces variables sont déjà définies vers `/app/config`.
