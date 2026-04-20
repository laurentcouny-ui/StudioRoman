# RAPPORT D'AUDIT — STUDIO ROMAN (CONSOLIDÉ)

Date: 2026-04-20  
Références: `audit-00-core.md`, `audit-L1-sealed.md`, `audit-L2-sealed.md`, `audit-L3-partiel.md`, `audit-L4-partiel.md`

## Scoreboard global
| Dimension | Score |
|---|---|
| Sécurité critique (L1) | 88/100 |
| Robustesse & perf (L2) | 74/100 |
| Qualité / conformité (L3) | 63/100 |
| Maintenabilité & évolution (L4) | 79/100 |
| **Score global** | **76/100** |

- Confiance moyenne: 8/10
- Risque global de régression des corrections: 🟡
- Statut audit: ✅ consolidé (avec actions résiduelles priorisées)

---

## Synthèse exécutive

- L1 est remédié et stabilisé (contrôles d'accès, validation, headers sécurité, blocage chemins sensibles).
- L2 a progressé de manière concrète: rate limiting multi-niveaux, tests smoke API, tests de non-régression rate-limit.
- L3 est partiellement remédié: SEO minimal, pages légales, robots/sitemap; conformité RGPD complète encore inachevée.
- L4 a fortement progressé: CI racine, Dependabot, OpenAPI baseline + lint strict + drift check, Flyway V1/V2, runbook rollback.

---

## Cartographie des remédiations majeures appliquées

### L1 — Sécurité critique
- Contrôle loopback + token API sur `/api/**` (hors `/api/health`) maintenu.
- Validation serveur DTO (`@Valid` + contraintes) active.
- Gestion d'erreur validation centralisée HTTP 400 active.
- Headers sécurité HTTP actifs.

### L2 — Robustesse / anti-abus
- Rate limit API IA en mémoire:
  - bucket `default`
  - bucket `heavy`
  - bucket `very-heavy`
- Headers de quota exposés:
  - `X-RateLimit-Bucket`
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`
  - `Retry-After` sur `429`
- Tests smoke API présents (`/api/health`, `/api/v1/ia/health`, validation 400 summary).

### L3 — Qualité / conformité
- SEO minimal ajouté:
  - meta description + robots + OG dans `scriptor/index.html`
  - `scriptor/public/robots.txt`
  - `scriptor/public/sitemap.xml`
- Légal:
  - `scriptor/public/mentions-legales.html`
  - lien depuis `scriptor/public/privacy.html`

### L4 — Pérennité / gouvernance
- CI racine présente:
  - job contract OpenAPI
  - job frontend (lint/build/security gate)
  - job backend (compile/test)
- Dependabot projet présent (`.github/dependabot.yml`).
- Contrat OpenAPI versionné (`backend/openapi/openapi-baseline.yaml`) + lint strict + check dérive PR.
- Flyway activé + migrations:
  - `V1__init_core_tables.sql`
  - `V2__add_perf_indexes.sql`
- Profil prod explicite (`application-prod.yml`) avec `ddl-auto=validate`.
- Runbook rollback formalisé (`RUNBOOK-ROLLBACK.md`).

---

## Métriques critiques croisées (règle 24)

### 1) CI/gates qualité projet
- Total attendu: 3 gates majeures (frontend, backend, contract)
- Conformes: 3
- Non conformes: 0
- Liste explicite des non conformes:
  - aucun

### 2) Contrat API versionné et contrôlé
- Total attendu: 3 éléments (spec versionnée, lint, drift check PR)
- Conformes: 3
- Non conformes: 0
- Liste explicite des non conformes:
  - aucun

### 3) Migrations DB versionnées
- Total attendu: >= 1
- Conformes: 2
- Non conformes: 0
- Liste explicite des non conformes:
  - aucun (au niveau "versioning présent")

### 4) Dépendances critiques npm
- Total vulnérabilités high/critical bloquantes (gate locale): 0
- Conformes: 0 blocking
- Non conformes: 0
- Liste explicite des non conformes:
  - aucun

### 5) Gouvernance documentaire minimale
- Total attendu: 4 (`README`, `CHANGELOG`, `CONTRIBUTING`, `RUNBOOK-ROLLBACK`)
- Conformes: 4
- Non conformes: 0
- Liste explicite des non conformes:
  - aucun

### 6) Conformité légale web de base
- Total attendu: 5 (`privacy`, `mentions légales`, `meta SEO`, `robots`, `sitemap`)
- Conformes: 5
- Non conformes: 0
- Liste explicite des non conformes:
  - aucun (niveau baseline)

---

## Non-conformités résiduelles (priorité)

### 🔴 Critiques
1. Absence de stratégie de rollback DB "down migration" explicite (les migrations sont versionnées, mais pas de procédure `down` outillée).
2. Bus factor très bas (contribution observée mono-auteur).

### 🟠 Majeures
1. Conformité RGPD incomplète sur les droits applicatifs:
   - endpoint suppression compte non détecté
   - endpoint export/portabilité non détecté
2. Documentation architecture type ADR absente.
3. LICENSE projet absente.

### 🟡 Moyennes
1. SEO/structured data reste minimal (pas de JSON-LD, sitemap statique à adapter au domaine final).
2. Cohérence format d'erreurs API encore hétérogène selon chemins historiques.

---

## Top 10 urgences restantes

1. Ajouter endpoints RGPD "export data" et "delete account" (ou déclarer explicitement N/A desktop-only).
2. Définir politique migrations réversibles (down plan) pour opérations sensibles.
3. Ajouter `LICENSE` racine selon mode de distribution.
4. Ajouter 1 à 3 ADR clés (auth locale, architecture IA, stratégie migration DB).
5. Rendre `sitemap.xml` piloté par domaine réel de déploiement.
6. Harmoniser format d'erreur API sur endpoints critiques.
7. Renforcer tests de charge sur endpoints `heavy` / `very-heavy`.
8. Mettre en place suivi simple de KPI runtime (latence, taux 429, taux 5xx).
9. Préparer plan de transfert connaissances pour réduire bus factor.
10. Ajouter revue trimestrielle dépendances + architecture.

---

## ✅ Ce qui est bien fait (NE PAS CASSER)

- Garde-fous L1 (loopback/token/validation/headers) désormais structurants.
- Pipeline CI multi-volet opérationnel.
- Contrat OpenAPI versionné et contrôlé automatiquement.
- Mécanisme anti-abus API pragmatique et testé.
- Socle rollback documenté et utilisable.
- Migrations Flyway introduites sans casser l'existant.

---

## Plan de remédiation priorisé (suite)

### Sprint A (sécurité & conformité)
- Endpoints RGPD (export/suppression) ou position formelle desktop-only.
- Politique `down` migration + runbook DB enrichi.

### Sprint B (gouvernance)
- `LICENSE` racine.
- ADR initiaux.
- Process ownership pour réduire bus factor.

### Sprint C (qualité continue)
- Uniformisation erreur API.
- SEO structuré (JSON-LD, sitemap dynamique).
- Monitoring minimal sur quotas/rate-limit.

---

## Méta-rapport

- Couverture consolidée: 4/4 layers
- Zones non auditées en profondeur: perf fine front (profiling runtime), ergonomie accessibilité manuelle exhaustive, pentest externe
- Limites: audit majoritairement statique + validations techniques ciblées
- Recommandation: audit humain ciblé conformité légale + test de sécurité applicative avant diffusion large

## Verdict final

Le projet passe d'un état "audit majoritairement constatatif" à un état **corrigé et industrialisé sur les axes critiques**.  
Le niveau global est **opérationnel** avec un reliquat concentré sur conformité RGPD complète, gouvernance documentaire/ADR, et maturité organisationnelle (bus factor).

## 🛑 VALIDATION HUMAINE REQUISE

Fin de la dernière partie d'audit — consolidation finale prête à validation.
