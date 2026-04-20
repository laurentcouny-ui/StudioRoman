# ADR-002 — RATE LIMITING (Default / Heavy / Very-Heavy)

- Statut: accepté
- Date: 2026-04-20
- Décideurs: équipe plateforme Studio Roman

## Contexte

Les endpoints IA n'ont pas tous le même coût:
- certains sont légers (validation/requêtes courtes),
- d'autres déclenchent des traitements LLM plus coûteux.

Sans garde-fou, un usage intensif peut:
- dégrader la réactivité locale,
- augmenter les coûts fournisseurs IA,
- masquer des comportements abusifs.

## Décision

Nous adoptons un rate limit en mémoire, par IP + méthode + bucket, sur les requêtes mutantes `/api/v1/ia/**`.

Buckets:

- **default**
  - cible: endpoints IA mutantes standard
  - config: `scriptor.api.rate-limit.max-requests` / `window-seconds`

- **heavy**
  - cible: endpoints coûteux (ex: resume/analysis/challenges)
  - config: `scriptor.api.rate-limit.heavy.*`

- **very-heavy**
  - cible: endpoints les plus coûteux (ex: summary)
  - config: `scriptor.api.rate-limit.very-heavy.*`

Ordre de résolution:
`very-heavy` > `heavy` > `default`.

Headers exposés:
- `X-RateLimit-Bucket`
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After` en cas de `429`

## Alternatives considérées

- Redis/token bucket distribué: inutilement complexe pour un backend local mono-instance.
- Aucune limitation: non acceptable pour robustesse/coûts.

## Conséquences

### Positives
- protection anti-abus pragmatique,
- meilleure maîtrise de la charge et des coûts IA,
- observabilité basique via headers.

### Négatives
- état en mémoire (non partagé entre instances),
- configuration à ajuster selon profils d'usage.

## Règles d'exploitation

- adapter les préfixes buckets selon endpoints réellement coûteux,
- surveiller les taux de `429`,
- conserver les tests de non-régression des buckets en CI.
