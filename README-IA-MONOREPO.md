# Monorepo Scriptor IA — structure & migration

Ce dossier (`backend/`, `frontend/`, `config/`) est **à part** de l’app Scriptor existante dans **`scriptor/`** (React/Vite actuelle). Rien dans `scriptor/` n’a été modifié.

## Déjà en place (généré selon le plan)

| Élément | Emplacement |
|--------|-------------|
| Point d’entrée Spring Boot | `backend/src/main/java/com/scriptor/api/ScriptorApplication.java` |
| TypeScript (Vite) | `frontend/tsconfig.json`, `frontend/tsconfig.node.json` |
| Chemins `../config` (depuis `backend/`) | `backend/src/main/resources/application.yml` |
| Arborescence packages Java | sous `backend/src/main/java/com/scriptor/api/...` |
| Dossiers frontend | `frontend/src/services`, `frontend/src/components` |
| Données runtime | `config/data/` (vide sauf `.gitkeep`) |

## Sources non trouvées dans ce workspace

Les fichiers listés dans votre plan (`.java`, `pom.xml`, `AIPanel.tsx`, `vite.config.ts`, `prompts.yml`, etc.) **n’étaient pas présents** à la racine du projet au moment de la migration automatique.

**À faire de votre côté :**

1. Copiez votre dossier « plat » dans ce workspace (ou clonez-le).
2. **Sans modifier le contenu** des fichiers (sauf fusion `application.yml` si vous aviez déjà un YAML complet — appliquer **uniquement** les 3 remplacements `./config` → `../config` et l’URL SQLite comme dans le plan).
3. Déplacez chaque fichier vers le chemin cible indiqué dans le plan (voir tableau ci-dessous).

### `application.yml`

Si vous aviez un fichier complet à la racine du backend plat, **fusionnez-le** avec `backend/src/main/resources/application.yml` : conservez tout votre contenu Spring et remplacez **seulement** les 3 lignes :

- `jdbc:sqlite:./config/data/scriptor.db` → `jdbc:sqlite:../config/data/scriptor.db`
- `dir: ./config` → `dir: ../config` (x2 pour `config` et `data` sous `scriptor:`)

### Déplacements backend (rappel)

| Package déclaré en tête de fichier | Dossier cible |
|-----------------------------------|---------------|
| `com.scriptor.api.config` | `backend/src/main/java/com/scriptor/api/config/` |
| `com.scriptor.api.security` | `backend/src/main/java/com/scriptor/api/security/` |
| `com.scriptor.api.llm` | `backend/src/main/java/com/scriptor/api/llm/` |
| `com.scriptor.api.llm.providers` | `backend/src/main/java/com/scriptor/api/llm/providers/` |
| `com.scriptor.api.modules.*` | `backend/src/main/java/com/scriptor/api/modules/<module>/` |
| Tests `ScriptorApplicationTests`, `ScriptorStressTests` | `backend/src/test/java/com/scriptor/api/` |

**Note :** `ForgottenCharacterTool.tsx` est du **frontend** → `frontend/src/components/`, pas dans `modules/characters/`.

### Déplacements frontend

- Racine `frontend/` : `package.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `index.html`
- `frontend/src/` : `main.tsx`, `App.tsx`, `index.css`
- `frontend/src/services/` : `apiClient.ts`
- `frontend/src/components/` : tous les `*Tool.tsx`, `AIPanel.tsx`, etc.

**Proxy Vite** (rappel) : dans `vite.config.ts`, rediriger `/api` → `http://localhost:8080`.

### Config

- `prompts.yml`, `providers.yml` → `config/`
- `annotations.json`, `lexicon.json`, `map-data.json`, `style-profiles.json`, `characters.json` → `config/data/`
- `bible.json` : optionnel dans `config/data/` ou laisser à la racine doc (plan étape 8)

## Vérification rapide

1. `backend/src/main/java/com/scriptor/api/ScriptorApplication.java` existe  
2. `backend/src/main/resources/application.yml` contient `../config`  
3. `backend/pom.xml` présent après votre copie  
4. `frontend/src/main.tsx` présent après votre copie  
5. `frontend/src/services/apiClient.ts` présent après votre copie  
6. `frontend/tsconfig.json` existe  
7. `config/prompts.yml` et `config/providers.yml` après votre copie  

## Commandes (après copie des sources)

```bash
cd backend
mvn spring-boot:run
```

```bash
cd frontend
npm install
npm run dev
```

- UI : http://localhost:5173  
- API : http://localhost:8080  
