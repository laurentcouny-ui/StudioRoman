# ADR-003 — DATABASE MIGRATIONS (Flyway)

- Statut: accepté
- Date: 2026-04-20
- Décideurs: équipe plateforme Studio Roman

## Contexte

Le projet utilisait initialement `ddl-auto=update`, pratique en dev mais risquée en production:
- changements implicites du schéma,
- faible traçabilité des évolutions,
- rollback complexe.

## Décision

Nous standardisons les évolutions DB via **Flyway**:

- migrations versionnées sous `backend/src/main/resources/db/migration/`
- convention `V<version>__<description>.sql`
- exécution automatique au démarrage
- validation active en prod

Paramétrage:
- dev: `SCR_JPA_DDL_AUTO=update` toléré
- prod: `ddl-auto=validate` (profil `application-prod.yml`)

## Alternatives considérées

- conserver `ddl-auto=update` partout: rejeté (risque prod).
- Liquibase: valide mais non retenu pour garder une stack minimale.

## Conséquences

### Positives
- historique clair des changements de schéma,
- meilleure prévisibilité des déploiements,
- base alignée avec standards contributor-ready.

### Négatives
- discipline de migration requise à chaque évolution de modèle,
- coût initial de mise en place.

## Règles de contribution

- toute évolution d'entité persistée doit inclure une migration Flyway,
- ne pas modifier une migration déjà appliquée; créer une nouvelle version,
- tester les migrations en local avant PR,
- documenter les migrations sensibles dans le runbook rollback.
