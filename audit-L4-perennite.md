# 🟢 AUDIT VIBE-CODING — FICHIER 5/7 : LAYER 4 (MAINTENABILITÉ & ÉVOLUTION)

**Version 3.2 DÉFINITIVE**
**À charger avec** : `audit-00-core.md`
**Prérequis** : L1+L2+L3 audités (ou audit séparé pérennité)
**Durée** : 45-90 min
**Objectif** : garantir que l'app peut évoluer, recevoir des mises à jour, et être maintenue pendant plusieurs années

**🆕 v3.2** : règle 24 appliquée partout (listes explicites des non-conformes).

Sections :
- 25 — Stratégie de mises à jour
- 26 — Évolutivité architecturale
- 27 — Stabilité des contrats
- 28 — Documentation vivante
- 29 — Reversibilité et rollback
- 30 — Onboarding et bus factor
- 31 — Dette technique mesurée

---

## ⚡ PHASE -1 RAPPEL L4

```markdown
## Métriques L4
- Dernier commit : [date]
- Fréquence de commits : X/mois
- Commits par auteur principal : Y% (bus factor faible si > 80%)
- Âge moyen des dépendances : X mois
- Dépendances avec version majeure de retard : X
- Documentation architecture (ADR) : OUI/NON
- Scripts de mise à jour automatisés : OUI/NON
- CI qui bloque upgrade cassante : OUI/NON
```

---

## SECTION 25 — Stratégie de mises à jour

### Indexation (règle 24)

```markdown
## État des lieux des mises à jour — listes explicites

### Dépendances principales
| Package | Version actuelle | Dernière version | Retard | Breaking changes attendus |
|---|---|---|---|---|
| react | 18.2.0 | 18.3.1 | 1 mineur | Non |
| next | 13.5.0 | 15.0.0 | 2 majeurs | OUI |
| ... |

- **Liste des dépendances avec CVE non patchées** : [package + CVE + sévérité]
- **Liste des dépendances EOL** : [package + date EOL]

### Automatisation
- Renovate configuré : OUI/NON (fichier)
- Dependabot configuré : OUI/NON (fichier)
- npm-check-updates : OUI/NON

### CI blocage upgrade cassante
- Tests avant merge upgrade : OUI/NON
- Coverage minimum : X%
- Linter bloquant : OUI/NON
- TypeScript strict : OUI/NON

### Runtime
- Version Node/Python/etc. pinned : OUI/NON (fichier)
- Runtime en LTS : OUI/NON
- Engines dans package.json : OUI/NON
- Dockerfile épinglé précis : OUI/NON

### SDK IA
- Versions SDK LLM pinnées : OUI/NON (liste)
- Modèles LLM pinnés (gpt-4-0613 vs gpt-4) : OUI/NON
```

### Findings

**Automatisation** :
- [ ] Renovate ou Dependabot configuré ?
- [ ] Groupement intelligent (minor/patch groupés, major individuels) ?
- [ ] Auto-merge patches sécu quand tests passent ?
- [ ] Schedule défini ?

**Sécurité updates** :
- [ ] Scan CVE automatisé (npm audit dans CI) ?
- [ ] Trivy/Snyk/Grype pour dépendances + container ?
- [ ] Blocage merge si vulnérabilité critique ?
- [ ] Alerting nouvelles CVE ?

**Tests non-régression** :
- [ ] Suite tests couvre features critiques ?
- [ ] Tests E2E parcours clés ?
- [ ] CI bloque merge si tests rouges ?
- [ ] Tests contractuels (API, schemas) ?

**Runtime** :
- [ ] Version fixée (`.nvmrc`, `.python-version`) ?
- [ ] LTS (pas EOL proche) ?
- [ ] `engines` dans package.json ?
- [ ] Dockerfile épinglé (pas `:latest`) ?

**Documentation updates** :
- [ ] CHANGELOG.md à jour ?
- [ ] Semver si lib ?
- [ ] Tags Git par release ?
- [ ] Notes de migration breaking changes ?

**IA spécifique** :
- [ ] SDK IA pinnés ?
- [ ] Modèles LLM pinnés (reproductibilité) ?
- [ ] Stratégie migration modèle déprécié ?

**Note risque de casse (CRITIQUE)** :
Les mises à jour = premier vecteur de régression. Règles d'or :
- JAMAIS plusieurs dépendances majeures en un commit
- TOUJOURS lire CHANGELOG avant upgrade majeur
- TOUJOURS tester staging avant prod
- TOUJOURS avoir plan de rollback (commit revert prêt)

### Score : X/10 — Risque régression : 🔴 (auto — updates = principal vecteur)

---

## SECTION 26 — Évolutivité architecturale

### Indexation (règle 24)

```markdown
## Signaux évolutivité — listes explicites
- Couches séparées (présentation/métier/données) : OUI/NON
- Services externes abstraits (interface + impl) : **liste des services + statut**
  - Email : [abstrait / couplé direct / mixte]
  - Payment : [...]
  - Auth : [...]
- Feature flags : OUI/NON (système)
- Configuration env propre : OUI/NON
- `if (process.env.NODE_ENV === 'production')` dans métier : X occurrences — **liste explicite**
```

### Findings

**Couplage / dépendances** :
- [ ] Services externes abstraits (interface `EmailService` remplaçable) ?
- [ ] Pas de couplage direct BDD dans métier (repository pattern) ?
- [ ] Auth abstraite : changer Clerk → Auth0 = combien de modifs ?
- [ ] Payment abstraite : changer Stripe → Lemon Squeezy = combien ?

**Feature flags** :
- [ ] Système présent (LaunchDarkly/Posthog/maison) ?
- [ ] Rollout progressif possible ?
- [ ] A/B testing ?
- [ ] Kill switch sur features critiques ?

**Configuration** :
- [ ] Env propre (dev/staging/prod) ?
- [ ] Pas de `if (NODE_ENV ===)` éparpillés ?
- [ ] `.env.example` documenté ?
- [ ] Validation env au démarrage (Zod sur process.env) ?

**Structure modulaire** :
- [ ] Ajouter endpoint : structure claire ?
- [ ] Ajouter table DB : workflow défini ?
- [ ] Ajouter page : structure routing claire ?
- [ ] Plugins/extensions prévus si extensible ?

**Limites architecture** :
- [ ] Architecture soutient les 3 prochaines features probables ?
- [ ] Multi-tenant : ajoutable ou refactor total ?
- [ ] i18n : ajoutable ou refactor ?
- [ ] Mono → micro : possible ou monolithe verrouillé ?

**Note risque de casse** : introduire des abstractions sur code existant = refactor massif. Ne pas le faire "pour le plaisir".

### Score : X/10 — Risque régression : 🟡/🔴

---

## SECTION 27 — Stabilité des contrats

### Indexation (règle 24)

```markdown
## Contrats détectés — listes explicites
- Versioning API : OUI/NON (v1, v2 dans les routes ?)
- Endpoints avec versioning : **liste**
- Endpoints sans versioning : **liste**
- Schema OpenAPI : OUI/NON
- Types partagés client/serveur : OUI/NON (tRPC/GraphQL/manuel)
- Migrations DB versionnées : OUI/NON
- Semver respecté en interne : OUI/NON
```

### Findings

**Contrats API** :
- [ ] Versioning endpoints (`/api/v1/users`) ?
- [ ] Deprecation policy documentée ?
- [ ] Schema OpenAPI à jour ?
- [ ] Backward compatibility (pas de rename de champ sans transition) ?
- [ ] Clients externes identifiés ?

**Contrats BDD** :
- [ ] Migrations versionnées (rappel L3 S21) ?
- [ ] Colonnes jamais supprimées directement ?
- [ ] Renommages : colonne temp + copie + suppression après X jours ?
- [ ] Changements de types réversibles ?

**Contrats internes** :
- [ ] Types partagés front/back ?
- [ ] Changements détectés par TypeScript ?
- [ ] Interfaces publiques modules documentées ?

**Contrats IA** :
- [ ] Schémas de réponse IA stables ?
- [ ] Migration quand modèle IA change ?

**Note risque de casse** : modifier API sans versioning casse tous les clients. TOUJOURS versionner si breaking change.

### Score : X/10 — Risque régression : 🟡

---

## SECTION 28 — Documentation vivante

### Indexation (règle 24)

```markdown
## Documentation présente — listes explicites
- README.md : X lignes
- Documentation API : [OpenAPI/Postman/aucune]
- ADR fichiers : X — **liste**
- Commentaires code ratio : X% fonctions commentées
- CHANGELOG : OUI/NON (dernière entrée : date)
- Wiki / Notion / Confluence : [via liens README ?]
- Doc onboarding dev : OUI/NON
- Diagrammes (archi, ERD, flux) : **liste**
- Commentaires IA génériques détectés : X — **liste** (`// Add your code here`, etc.)
- README mentionnant features qui n'existent pas : X incohérences — **liste**
```

### Findings

**Doc utilisateur (dev)** :
- [ ] README onboarding : < 30 min démarrage ?
- [ ] Setup documenté (prérequis, env, commandes) ?
- [ ] Scripts usuels documentés ?
- [ ] Gotchas documentés ?

**Doc architecture** :
- [ ] ADR pour décisions majeures ?
- [ ] Diagramme archi à jour ?
- [ ] ERD ?
- [ ] Flux utilisateurs critiques documentés ?

**Doc code** :
- [ ] Fonctions complexes commentées ("pourquoi" pas "quoi") ?
- [ ] Décisions étranges justifiées ?
- [ ] JSDoc/docstrings sur APIs publiques ?
- [ ] TODO avec contexte (qui, quand, pourquoi) ?

**Doc exploitation** :
- [ ] Runbook incidents courants ?
- [ ] Procédure déploiement ?
- [ ] Procédure rollback ?
- [ ] Procédure restauration backup ?

**Anti-patterns doc vibe-coding** :
- [ ] README généré IA sans relecture ?
- [ ] Commentaires IA type (`// Add your code here`) ?
- [ ] Documentation qui ment ?

**Note risque de casse** : aucun risque technique. Mais doc fausse est PIRE que pas de doc.

### Score : X/10 — Risque régression : 🟢

---

## SECTION 29 — Reversibilité et rollback

### Indexation (règle 24)

```markdown
## Mécanismes rollback — listes explicites
- Plateforme avec rollback 1-click : OUI/NON (Vercel/Netlify/Railway)
- Feature flags : OUI/NON
- Migrations DB avec `down` : X sur Y — **liste des migrations sans down**
- Versioning déploiements (tags) : OUI/NON
- Scripts rollback : **liste**
- Snapshots DB avant déploiements majeurs : OUI/NON

## One-way doors identifiées — listes explicites
- Suppressions hard detectées dans le code : **liste**
- Destructions de tables dans migrations : **liste**
- Changements de clés API sans mécanisme de retour : **liste**
```

### Findings

**Rollback applicatif** :
- [ ] Rollback 1-click plateforme ?
- [ ] Blue/Green ou Canary ?
- [ ] Temps rollback < 5 min ?
- [ ] Alerting détecte besoin rollback (error rate spike) ?

**Rollback BDD** :
- [ ] Chaque migration a son `down` ?
- [ ] Backups auto avant déploiement avec migrations ?
- [ ] Procédure restauration testée ?

**Feature flags comme rollback** :
- [ ] FF permet désactiver feature défaillante sans redeploy ?
- [ ] Kill switch sur critiques ?

**Git / historique** :
- [ ] Pas de `git push --force` sur main ?
- [ ] Historique préservé (pas de rebase après merge) ?
- [ ] Tags pour chaque release ?

**One-way doors** :
- [ ] Suppressions : toujours soft delete ?
- [ ] Destructions tables : jamais sans backup ?
- [ ] Changements clés API externes : retour possible ?
- [ ] Migrations de données : réversibles ?

**Note risque de casse** : une migration irréversible déployée = données perdues définitivement. Classe de bug la plus grave.

### Score : X/10 — Risque régression : 🔴

---

## SECTION 30 — Onboarding et bus factor

### Indexation (règle 24)

```markdown
## Bus factor — listes explicites
- Top 3 auteurs en % de commits : [A : X% / B : Y% / C : Z%]
- Bus factor estimé : 1 / 2 / 3+
- Doc onboarding présente : OUI/NON
- Setup reproductible (Docker/script) : OUI/NON
- Zones du code maîtrisées par une seule personne : **liste** (via blame analysis)
```

### Findings

- [ ] Script setup unique (`./setup.sh`, `make install`) ?
- [ ] Docker Compose dev complet ?
- [ ] Seed data pour démarrer sans accès prod ?
- [ ] Tests tournent en local sans config complexe ?
- [ ] README onboarding clair ?
- [ ] Glossaire métier ?
- [ ] Diagramme simplifié des modules ?
- [ ] Walkthrough "première feature" ?
- [ ] Playbook incidents ?
- [ ] Contacts critiques (prod access, ops sous-traités) ?

### Score : X/10 — Risque régression : 🟢

---

## SECTION 31 — Dette technique mesurée

### Indexation (règle 24)

```markdown
## Mesure de la dette — listes explicites
- TODO/FIXME/HACK/XXX : X (top 20 avec fichier:ligne + date commit)
- Issues "tech-debt" : X (si accès)
- SonarQube/Code Climate : OUI/NON
- Linter configuré : OUI/NON (résultats : X warnings/errors)
- Fichiers avec complexité cyclomatique > 10 : **liste**
```

### Findings

- [ ] TODOs datés (auteur + date + contexte) ?
- [ ] TODOs prioritaires vs nice-to-have ?
- [ ] Refactor notebook (liste refactors prévus) ?
- [ ] Review régulière dette (1x/trimestre) ?
- [ ] Budget dette par sprint (20%) ?
- [ ] Metrics auto (complexité, duplication, coverage trend) ?
- [ ] Wall of shame (10 pires portions) ?
- [ ] Renovate / dépendances à jour ?

**Note risque de casse** : refactorer sans tests = casse garantie. Ajouter les tests AVANT.

### Score : X/10 — Risque régression : 🟡

---

## 🔁 AUTO-VALIDATION L4

```markdown
## AUTO-VALIDATION L4
[format standard]

### Zones faible confiance
[...]

### Métriques L4
- Couverture : X%
- 🔴 : X | 🟠 : X | 🟡 : X | 🟢 : X
- Confiance : X/10
- Score global pérennité : X/100
```

---

## 📤 LIVRABLE L4

```markdown
# RAPPORT PARTIEL — LAYER 4 (PÉRENNITÉ)

## Résumé
- 🔴 : X | 🟠 : X | 🟡 : X | 🟢 : X
- Score maintenabilité : X/100
- Score évolutivité : X/100
- Bus factor : [1/2/3+]
- Risque pérennité à 12 mois : 🟢/🟡/🔴
- Confiance : X/10

## Scoreboard L4
| Section | 🔴 | 🟠 | 🟡 | 🟢 | Score | Confiance |
|---|---|---|---|---|---|---|
| 25. Stratégie updates | | | | | /10 | /10 |
| 26. Évolutivité archi | | | | | /10 | /10 |
| 27. Stabilité contrats | | | | | /10 | /10 |
| 28. Doc vivante | | | | | /10 | /10 |
| 29. Reversibilité | | | | | /10 | /10 |
| 30. Onboarding/bus factor | | | | | /10 | /10 |
| 31. Dette mesurée | | | | | /10 | /10 |

## 🔮 Projection à 12 mois
Sans action, dans 12 mois :
- X dépendances en retard
- Probabilité CVE critiques non patchées : [...]
- Coût estimé de reprise si dev initial part : X jours
- Probabilité de réécriture forcée : FAIBLE/MOYENNE/ÉLEVÉE

## 🔄 Stratégie mises à jour recommandée
1. **Hebdomadaire** : patches sécu (auto-merge si tests OK)
2. **Mensuelle** : dépendances mineures groupées
3. **Trimestrielle** : dépendances majeures une à la fois, avec E2E
4. **Annuelle** : review architecturale + bilan dette

## 📅 Planning actions pérennité
### Immédiat (1 semaine)
- [ ] Configurer Renovate/Dependabot
- [ ] Créer CHANGELOG.md si absent
- [ ] Documenter procédure rollback
### Court terme (1 mois)
- [ ] ADR sur décisions architecturales majeures
- [ ] Feature flags si pertinent
- [ ] Runbook incidents
### Moyen terme (3 mois)
- [ ] Abstraire services externes
- [ ] CI robuste bloquant upgrades cassantes
- [ ] Réduire bus factor

## ✅ Ce qui est bien fait (NE PAS CASSER)
[...]

## Prochaines étapes
**Prêt à produire le LIVRABLE FINAL CONSOLIDÉ dès ta validation.**
```

---

## 🛑 STOP — VALIDATION HUMAINE REQUISE

**Fin L4 — v3.2 DÉFINITIVE**
