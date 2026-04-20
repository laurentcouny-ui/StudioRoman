# Runbook Rollback

Ce document decrit la marche a suivre pour revenir rapidement a un etat stable en cas de regression.

## 1) Rollback applicatif (code)

### Cas A - Deploiement Docker
1. Identifier le commit stable precedent.
2. Rebuild sur ce commit:
   - `docker compose down`
   - `git checkout <commit_stable>`
   - `docker compose up --build -d`
3. Verifier:
   - `GET /api/health` repond `200`
   - l'application web charge sans erreur JS bloquante.

### Cas B - Execution locale (Maven/Vite)
1. Revenir au commit stable: `git checkout <commit_stable>`
2. Backend:
   - `cd backend`
   - `mvn "-Dskip.npm=true" spring-boot:run`
3. Frontend:
   - `cd scriptor`
   - `npm run dev`

## 2) Rollback donnees (SQLite)

## Principe
- Toujours sauvegarder le fichier SQLite avant toute operation sensible.
- Fichier DB par defaut: `config/data/scriptor.db`

### Procedure rapide
1. Arreter l'application/backend.
2. Sauvegarder l'etat courant:
   - copier `scriptor.db` (et si presents `scriptor.db-wal`, `scriptor.db-shm`)
3. Restaurer la sauvegarde valide precedente:
   - remplacer `config/data/scriptor.db` par la copie saine
4. Relancer le backend et verifier les ecrans critiques.

## 3) Rollback import manuscrit (desktop)

L'application expose deja un rollback metier via:
- restauration de snapshot (`storage_restore_latest_snapshot`)
- restauration pre-import (`import_restore_from_pre_import_backup`)
- bouton "Annuler le dernier import manuscrit" dans l'UI Import

En cas d'import corrompu, preferer d'abord ces mecanismes avant un rollback global du projet.

## 4) Checklist de validation post-rollback

- API: `/api/health` = `200`
- Flux critiques:
  - ouverture projet
  - sauvegarde locale
  - import manuscrit
  - generation IA de base
- Verifier logs backend: pas d'exception repetitive.

## 5) Escalade

Si rollback impossible:
- geler les nouvelles modifications
- conserver copie de la DB et des logs
- ouvrir un incident interne avec:
  - commit source
  - commit cible
  - heure de debut incident
  - symptomes exacts
