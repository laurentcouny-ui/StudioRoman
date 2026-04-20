# SCELLEMENT FINAL — AUDIT L1 (BLOQUANT PROD)

Date: 2026-04-20  
Références: `audit-00-core.md`, `audit-L1-bloquant-prod.md`, `audit-L1-suite-actions.md`

## Verdict

- **Statut L1**: ✅ **SCELLÉ**
- **Blocants L1 critiques**: **traités**
- **Risque régression (après remédiations)**: 🟡 (surveillance recommandée)
- **Autorisation passage L2**: ✅ **oui**

## Récapitulatif des remédiations L1

1. **Contrôles d'accès**
   - API restreinte au loopback par défaut.
   - Auth locale par token partagée implémentée et active (`SCR_API_REQUIRE_TOKEN=true`).
   - Frontend aligné (`VITE_AI_API_TOKEN`) sur les appels API, y compris proxy OAuth backend.

2. **Validation des entrées**
   - DTO durcis (contraintes `@NotBlank`, `@Size`, `@Pattern`, etc.).
   - Contrôleurs branchés en `@Valid`.
   - Gestion centralisée des erreurs de validation en HTTP 400 JSON standardisé.

3. **Secrets**
   - Clé API retirée du script backend en clair.
   - `run-backend.ps1` lit `SCR_API_TOKEN` depuis les variables d'environnement User/Machine.

4. **Erreurs / résilience**
   - Suppression des `catch {}` critiques identifiés côté frontend (recovery documentée).
   - Timeouts ajoutés sur les tests de clés API côté backend.

5. **Configuration production**
   - Headers sécurité HTTP en place (CSP, XFO, XCTO, Referrer-Policy, Permissions-Policy).
   - Blocage chemins sensibles confirmé (`/.env`, `/.git/config`, `*.map` -> 404).

## Preuves de vérification (extrait)

- Auth token:
  - sans token -> `401`
  - avec token -> `200`
- Validation:
  - payloads invalides sur endpoints critiques -> `400` attendu
- Sécurité statique:
  - `/.env` -> `404`
  - `/.git/config` -> `404`
  - `/assets/index.js.map` -> `404`
- Non-régression technique:
  - compile backend OK (`mvn -Pno-frontend-build -DskipTests compile`)
  - démarrage full OK (`npm run dev:tauri:full`)

## Points de vigilance (post-scellement)

- Rotation du token à formaliser en procédure d'exploitation.
- Maintenir l'alignement exact `SCR_API_TOKEN` ↔ `VITE_AI_API_TOKEN`.
- Conserver les vérifications runtime L1 dans la routine pré-release.

## Décision

Layer 1 est considéré **conforme aux objectifs de blocage prod** définis dans le cadre audit v3.2.  
Le projet est **autorisé à passer au Layer 2**, sous réserve de conserver les garde-fous L1 actifs.
