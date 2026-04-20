# SUITE AUDIT L1 — Plan d'exécution et validation

Ce document suit `audit-00-core.md` + `audit-L1-bloquant-prod.md` et prépare la clôture opérationnelle de L1.

## 1) État actuel (après remédiations)

- ✅ **Config prod** : dotfiles et chemins sensibles ne sont plus servis (`/.env`, `/.git/config`, `*.map` -> 404).
- ✅ **Headers sécurité** : CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- ✅ **Validation serveur** : DTO contraints + `@Valid` + erreurs 400 standardisées.
- ✅ **Anti-silent-fail minimal** : `catch {}` corrigés dans les zones critiques identifiées.
- ✅ **Contrôle d'accès local** :
  - loopback-only actif par défaut (`SCR_API_LOOPBACK_ONLY=true`)
  - token API optionnel prêt (`SCR_API_REQUIRE_TOKEN`, `SCR_API_TOKEN`)
- ✅ **Frontend prêt token** : `VITE_AI_API_TOKEN` branché dans les appels API (incluant proxy OAuth Google backend).

## 2) Dernières actions pour sceller L1

1. **Activer le token partout** ✅
   - Backend : `SCR_API_REQUIRE_TOKEN=true`, `SCR_API_TOKEN=<clé forte>`
   - Frontend : `VITE_AI_API_TOKEN=<même clé>`
2. **Rotation et stockage du token** 🟡
   - Ne pas versionner la clé en clair
   - Préparer procédure de rotation (nouveau -> déploiement -> ancien)
3. **Vérification non-régression finale** 🟡
   - Démarrage backend via `backend/run-backend.ps1`
   - Démarrage app via `scriptor/npm run dev:tauri`
   - Parcours UI critique : IA, sauvegardes cloud, carte, fiche reprise, annotations
4. **Validation sécurité runtime** ✅
   - Sans token API -> 401
   - Avec token API -> 200
   - `/.env` et `/.git/config` -> 404
5. **Documentation** ✅
   - Conserver la procédure dans ce fichier + `.env.example`

## 2.1) Résultats de vérification (session actuelle)

- `POST /api/v1/ia/summary/chapter` sans token -> **401**.
- `POST /api/v1/ia/summary/chapter` avec token -> **200**.
- Validation active : `POST /api/v1/ia/settings/provider` avec `BadProvider` -> **400** + message JSON structuré.
- Headers sécurité présents sur `GET /api/health` :
  - `Content-Security-Policy`
  - `X-Frame-Options`
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
- Chemins sensibles bloqués :
  - `/.env` -> **404**
  - `/.git/config` -> **404**
  - `/assets/index.js.map` -> **404**
- Non-régression compile backend : `mvn -Pno-frontend-build -DskipTests compile` -> **OK**.

## 2.2) Checklist PASS/FAIL L1 (technique)

- **PASS** `GET /api/health` -> 200
- **PASS** `GET /api/v1/ia/annotations` (avec token) -> 200
- **PASS** `GET /api/v1/ia/bible/search?keyword=test` (avec token) -> 200
- **PASS** `GET /api/v1/ia/characters/search?keyword=test` (avec token) -> 200
- **PASS** blocage auth : `POST /api/v1/ia/summary/chapter` sans token -> 401
- **PASS** validation 400 : `summary/chapter` payload vide -> 400
- **PASS** validation 400 : `resume/generate` payload invalide -> 400
- **PASS** validation 400 : `analysis/narrative` payload vide -> 400
- **PASS** validation 400 : `analysis/review` payload vide -> 400
- **PASS** validation 400 : `map/verify` payload vide -> 400
- **PASS** validation 400 : `map/search` keyword vide -> 400
- **PASS** validation 400 : `challenges/generate` challengeType invalide -> 400
- **PASS** validation 400 : `publisher/generate` documentType invalide -> 400
- **PASS** validation 400 : `settings/provider` providerId invalide -> 400
- **PASS** validation 400 : `oauth/google/token` payload invalide -> 400

## 2.3) Checklist PASS/FAIL L1 (manuel UI) — à cocher

- [ ] **UI IA écriture** : génération/réponse sans erreur visible
- [ ] **Fiche de reprise** : génération fonctionnelle après ouverture projet
- [ ] **Carte du monde** : recherche + vérification cohérence + sauvegarde éditeur
- [ ] **Annotations** : création/suppression depuis l’UI
- [ ] **Sauvegardes cloud** : Google/Dropbox connexion + upload manuel
- [ ] **Paramètres IA** : changement provider + test clé API
- [ ] **Démarrage full** : `npm run dev:tauri:full` stable

## 3) Commandes de vérification (copier/coller)

```powershell
# Sans token (doit échouer)
Invoke-WebRequest -Uri "http://127.0.0.1:8080/api/v1/ia/summary/chapter" `
  -Method POST -ContentType "application/json" -Body '{"chapterText":"test"}'
```

```powershell
# Avec token (doit passer)
$h = @{ "X-Scriptor-Api-Token" = "VOTRE_TOKEN" }
Invoke-WebRequest -Uri "http://127.0.0.1:8080/api/v1/ia/summary/chapter" `
  -Method POST -Headers $h -ContentType "application/json" -Body '{"chapterText":"test"}'
```

```powershell
# Doit être inaccessible
Invoke-WebRequest -Uri "http://127.0.0.1:8080/.env"
Invoke-WebRequest -Uri "http://127.0.0.1:8080/.git/config"
```

## 4) Critères de clôture L1

- Aucun blocant 🔴 restant sur :
  - accès API
  - validation serveur
  - exposition paths sensibles
  - erreurs silencieuses critiques
  - configuration sécurité HTTP de base
- Build/compile OK côté backend
- Parcours manuel UI critique validé

## 5) STOP de gouvernance

Ne pas lancer L2 automatiquement tant que cette checklist n'est pas validée humainement.
