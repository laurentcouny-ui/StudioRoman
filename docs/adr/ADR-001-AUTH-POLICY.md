# ADR-001 — AUTH POLICY (Loopback + Token)

- Statut: accepté
- Date: 2026-04-20
- Décideurs: équipe plateforme Studio Roman

## Contexte

Studio Roman est une application desktop/local-first.
Le backend Spring Boot est embarqué localement et sert l'UI ainsi que les endpoints IA.

Les risques principaux sont:
- exposition réseau involontaire de l'API locale,
- appels non autorisés vers `/api/**`,
- fuite de token dans le code source.

## Décision

Nous appliquons une politique en deux couches:

1. **Isolation loopback par défaut**
   - filtre `LocalOnlyApiFilter`
   - refus des appels API hors `127.0.0.1` / `::1`
   - configuration: `scriptor.api.loopback-only=true` (par défaut)

2. **Token API partagé (optionnel mais recommandé)**
   - filtre `ApiTokenFilter`
   - token attendu via `X-Scriptor-Api-Token` (ou bearer fallback)
   - activation: `scriptor.api.require-token=true`
   - token injecté via variable d'environnement (`SCR_API_TOKEN`)

## Alternatives considérées

- OAuth/JWT complet: surdimensionné pour un backend local mono-utilisateur.
- Aucune auth: trop risqué en cas d'exposition réseau.

## Conséquences

### Positives
- surface d'attaque réduite,
- déploiement simple en environnement local,
- alignement avec philosophie local-first.

### Négatives
- gestion opérationnelle du token (rotation/documentation),
- besoin d'aligner frontend et backend sur le même secret.

## Règles d'implémentation

- ne jamais versionner de token en clair,
- maintenir `run-backend.ps1` en résolution par variables d'environnement,
- vérifier en pré-release:
  - sans token -> `401` (si token requis),
  - hors loopback -> `403`,
  - `/api/health` accessible pour liveness.
