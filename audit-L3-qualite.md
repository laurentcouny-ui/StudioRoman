# 🟡 AUDIT VIBE-CODING — FICHIER 4/7 : LAYER 3 (QUALITÉ)

**Version 3.2 DÉFINITIVE**
**À charger avec** : `audit-00-core.md`
**Prérequis** : L1+L2 audités (ou au moins L1)
**Durée** : 60-120 min

Sections 13-24 : accessibilité, doc, backups, RGPD, SEO, i18n, responsive, dépendances, migrations DB, hallucinations, cohérence globale, cohérence mentale.

**🆕 v3.2** : règle 24 appliquée partout (croisement métriques + listes explicites des non-conformes).

---

## ⚡ RAPPEL PHASE -1

Si cartographie non en contexte, la refaire. Métriques L3 supplémentaires :

```markdown
- Pages publiques : X
- Pages authentifiées : X
- Chaînes hardcodées estimées : X
- Fichiers traduction : [oui/non]
- README/docs/CONTRIBUTING : [liste]
- LICENSE présent ? type ?
```

---

## SECTION 13 — Accessibilité (WCAG 2.2 AA)

### Indexation (règle 24)

```markdown
## Métriques accessibilité — listes explicites

### HTML sémantique
- `<div onClick>` / `<span onClick>` (au lieu de button) : X — **liste explicite** (fichier:ligne)

### Images
- Images `<img>` total : X
- Avec `alt` : Y
- Sans `alt` : Z — **liste explicite** (fichier:ligne)

### Formulaires
- Inputs total : X
- Avec `<label>` associé ou `aria-label` : Y
- Sans label : Z — **liste explicite** (fichier:ligne)

### Attribut lang
- `<html lang>` : OUI/NON (fichier de layout)

### Focus
- `outline: none` sans alternative : X — **liste explicite**
```

### Findings

- [ ] HTML sémantique (`<button>`, `<nav>`, `<main>`, etc.) ?
- [ ] Hiérarchie titres (h1 unique, pas de saut) ?
- [ ] Labels formulaire (`<label for>` ou `aria-label`) ?
- [ ] ARIA utilisé correctement ?
- [ ] Contraste 4.5:1 (3:1 gros texte) ?
- [ ] Focus visible (outline non supprimé sans alternative) ?
- [ ] Navigation clavier (Tab fonctionnel) ?
- [ ] Skip links ?
- [ ] `alt` sur images non décoratives ?
- [ ] Modales : focus trap, Escape ferme ?
- [ ] Formulaires : erreurs associées (`aria-describedby`) ?
- [ ] `lang` sur `<html>` ?
- [ ] `rem`/`em` plutôt que `px` ?
- [ ] `prefers-reduced-motion` respecté ?
- [ ] Confirmation avant actions destructives ?
- [ ] Couleurs comme seul indicateur (daltoniens) ?
- [ ] Videos : sous-titres/transcripts ?
- [ ] Tables : `<th>`, `scope`, `<caption>` ?
- [ ] Zoom 200% fonctionnel ?

**Note risque de casse** : changer `<div onClick>` en `<button>` peut casser CSS existant. Tester rendering avant validation.

### Score : X/10 — Risque régression : 🟢/🟡/🔴

---

## SECTION 14 — Maintenabilité et documentation

### Indexation (règle 24)

```markdown
## Métriques documentation — état des lieux
- README.md : OUI/NON, X lignes
- Documentation API : OUI/NON (type)
- CONTRIBUTING.md : OUI/NON
- ADR/docs architecture : **liste explicite**
- CHANGELOG : OUI/NON, dernière entrée : [date]
- LICENSE : OUI/NON (type)
- Fonctions publiques sans doc : X sur Y — **liste top 20**
```

### Findings

- [ ] README : setup clair, env documentées, commandes ?
- [ ] Doc API (OpenAPI/Swagger/Postman) ?
- [ ] ADR ou docs architecture ?
- [ ] Onboarding : nouveau dev démarre en < 30 min ?
- [ ] Scripts utilitaires (`npm run setup`, `make dev`) ?
- [ ] Conventions de commit ?
- [ ] Semver + tags Git ?
- [ ] Changelog à jour ?
- [ ] Branching strategy documenté ?
- [ ] Code review (PRs, protection branches) ?
- [ ] Renovate/Dependabot ?
- [ ] LICENSE présent ?

### Score : X/10 — Risque régression : 🟢/🟡/🔴

---

## SECTION 15 — Sauvegardes et plan de reprise

### Indexation (règle 24)

```markdown
## Métriques backups
- Scripts backup : **liste explicite**
- Config backup cloud détecté : OUI/NON
- Tables total : X
- Avec soft delete (deleted_at) : Y
- Sans soft delete : Z — **liste explicite des tables critiques concernées**
- Runbook restauration : OUI/NON
- Envs séparés (dev/staging/prod) : [détection dans configs]
```

### Findings

- [ ] Backups automatiques (BDD + fichiers + configs) ?
- [ ] Fréquence quotidienne minimum ?
- [ ] Rétention (30j min) ?
- [ ] **Test de restauration** : déjà effectué ? (Souvent JAMAIS)
- [ ] Backups chiffrés (repos + transit) ?
- [ ] Stockage hors-site ?
- [ ] Soft deletes sur tables critiques ?
- [ ] Séparation prod/staging/dev ?
- [ ] Runbook restauration documenté ?
- [ ] RTO/RPO définis ?
- [ ] Migrations DB reversibles ?

**Note risque de casse** : activer soft deletes sur une table existante nécessite migration + refactor de toutes les requêtes (`WHERE deleted_at IS NULL` partout). Énorme risque de régression.

### Score : X/10 — Risque régression : 🟢/🟡/🔴

---

## SECTION 16 — RGPD / conformité légale

### Indexation (règle 24)

```markdown
## Métriques RGPD — listes explicites

### Pages légales obligatoires
- Politique confidentialité : OUI/NON (URL/fichier)
- Mentions légales : OUI/NON
- CGU/CGV : OUI/NON

### Cookies et consentement
- Bannière cookies : OUI/NON (lib)
- Cookies détectés avant consentement (🔴 si non essentiel) : **liste explicite**
- Trackers chargés avant consentement : **liste explicite**

### Droits utilisateurs
- Endpoint "supprimer compte" : OUI/NON (fichier:ligne)
- Endpoint "exporter données" : OUI/NON (fichier:ligne)

### Tiers / sous-traitants identifiés
- **Liste explicite** : Stripe, Mailgun, Sentry, etc. (mentionnés dans politique ? OUI/NON)
```

### Findings

- [ ] Politique confidentialité présente, à jour, décrit traitements réels ?
- [ ] Mentions légales complètes ?
- [ ] CGU/CGV si service payant ?
- [ ] Bannière cookies granulaire (pas "accepter ou quitter") ?
- [ ] **Aucun cookie non essentiel avant consentement** ?
- [ ] Trackers (GA/Meta Pixel/Hotjar) chargés après consentement uniquement ?
- [ ] Droit effacement : "supprimer mon compte" **réellement implémenté** + cascade ?
- [ ] Droit accès/portabilité : endpoint export (JSON/CSV) ?
- [ ] Registre traitements documenté ?
- [ ] Base légale par traitement ?
- [ ] Contact DPO ?
- [ ] Minimisation (que le nécessaire) ?
- [ ] Sous-traitants listés ?
- [ ] Transferts hors UE : clauses contractuelles ?
- [ ] Durée conservation définie ?
- [ ] Mineurs : vérification âge, consentement parental ?
- [ ] Emails marketing : double opt-in + lien désinscription ?
- [ ] DPIA si traitement à haut risque ?
- [ ] Logs avec PII : rétention compatible RGPD ?

**Note risque de casse** : implémenter "supprimer mon compte" avec cascade peut casser des contraintes de clés étrangères si mal fait. Très sensible.

### Score : X/10 — Risque régression : 🟢/🟡/🔴

---

## SECTION 17 — SEO

### Indexation (règle 24)

```markdown
## Métriques SEO — listes explicites

### Pages publiques
- Total : X
- Avec <title> unique : Y
- Sans <title> ou titre dupliqué : Z — **liste explicite**
- Avec meta description : Y
- Sans : Z — **liste explicite**

### Sitemap / robots
- Sitemap.xml : OUI/NON
- Robots.txt : OUI/NON

### Structured data
- Pages avec JSON-LD : X — **liste**
- Pages sans : Z
```

### Findings par page publique

- [ ] `<title>` unique, < 60 car ?
- [ ] Meta description unique, < 160 car ?
- [ ] Meta robots : pas de `noindex` accidentel ?
- [ ] Open Graph ?
- [ ] Twitter Cards ?
- [ ] Canonical sur variantes ?
- [ ] Sitemap.xml référencé robots.txt ?
- [ ] Robots.txt correct ?
- [ ] Structured data JSON-LD ?
- [ ] URLs slugifiées ?
- [ ] Hreflang si multi-langues ?
- [ ] HTTPS + redirection ?
- [ ] Core Web Vitals (LCP < 2.5s, INP < 200ms, CLS < 0.1) ?
- [ ] SSR/SSG si SPA ?
- [ ] Breadcrumbs sémantiques ?
- [ ] 404 personnalisée ?
- [ ] Favicon multi-formats ?

**Note risque de casse** : changer les URLs pour les slugifier casse les liens externes (perte SEO). Toujours prévoir redirections 301.

### Score : X/10 — Risque régression : 🟢/🟡/🔴

---

## SECTION 18 — Internationalisation

### Indexation (règle 24)

```markdown
## Métriques i18n — listes explicites
- Librairie i18n : [i18next/react-intl/next-intl/vue-i18n/aucune]
- Fichiers traduction : **liste**
- Chaînes hardcodées (heuristique) : X — **liste top 30**
- Dates hardcodées (`"DD/MM/YYYY"`) : X — **liste explicite**
```

### Findings

- [ ] Chaînes externalisées ou hardcodées ?
- [ ] Lib i18n si multi-langues ?
- [ ] Dates via `Intl.DateTimeFormat` ?
- [ ] Nombres avec séparateurs localisés ?
- [ ] Monnaies localisées ?
- [ ] Pluriels gérés ?
- [ ] RTL si pertinent ?
- [ ] Détection langue (Accept-Language) ?
- [ ] Timezones : UTC en BDD, local en UI ?
- [ ] Regex compatibles formats internationaux ?
- [ ] Contenu dynamique traduit (emails, erreurs) ?

**Note** : si app officiellement mono-langue, largement N/A.

### Score : X/10 — Risque régression : 🟢/🟡/🔴

---

## SECTION 19 — Responsive et cross-device

### Indexation (règle 24)

```markdown
## Métriques responsive
- Meta viewport : OUI/NON
- Media queries : X (breakpoints utilisés : [liste])
- Framework responsive : [...]
- PWA manifest : OUI/NON
- Service worker : OUI/NON
- `maximum-scale=1` détecté (bloque l'accessibilité) : **liste si présent**
```

### Findings

- [ ] Viewport meta ?
- [ ] Breakpoints (mobile/tablet/desktop) ?
- [ ] Images responsives (`srcset`, `<picture>`) ?
- [ ] Touch targets ≥ 44x44px ?
- [ ] Input types mobile corrects ?
- [ ] Hover avec alternative tactile ?
- [ ] Safe areas iOS ?
- [ ] Portrait ET paysage ?
- [ ] PWA (manifest + SW) ?
- [ ] Bundle raisonnable 3G ?
- [ ] Pas de `maximum-scale=1` ?

### Score : X/10 — Risque régression : 🟢/🟡/🔴

---

## SECTION 20 — Dépendances et chaîne d'approvisionnement

### Indexation (règle 24)

```markdown
## Métriques dépendances — listes explicites
- package.json / requirements.txt / go.mod / Gemfile : **liste**
- Directes : X | Transitives : Y
- Lockfile commité : OUI/NON
- npm audit résultats : critical X / high Y / moderate Z / low W
- **Liste explicite des critical/high** (package + CVE + version)
- Dépendances abandonnées (> 2 ans) : X — **liste**
- Dépendances avec version majeure de retard : X — **liste**
- **Ghost dependencies** : packages listés mais non importés : X — **liste explicite**
- Packages importés mais non listés : X — **liste**
```

### Findings

- [ ] Chaque dépendance existe réellement (anti-slopsquatting) ?
- [ ] Typosquatting ?
- [ ] Packages peu téléchargés (< 1000 DL/semaine) ?
- [ ] Mainteneurs inconnus ?
- [ ] Dates publication récentes suspectes ?
- [ ] Lockfile commité ?
- [ ] CVE listées ?
- [ ] Licenses compatibles ?
- [ ] SBOM généré ?
- [ ] Dépendances abandonnées ?
- [ ] Versions pinnées ou `^` qui peuvent casser ?
- [ ] Ghost dependencies ?

**Note risque de casse** : mettre à jour un package avec breaking changes casse l'app. Lire le CHANGELOG. Ne jamais utiliser `npm audit fix --force`.

### Score : X/10 — Risque régression : 🟢/🟡/🔴

---

## SECTION 21 — Migrations et évolution DB

### Indexation (règle 24)

```markdown
## Métriques migrations
- Système : [Prisma/Drizzle/Alembic/Flyway/aucun]
- Migrations : X fichiers (dossier)
- Avec `down` : Y
- Sans `down` (irréversibles) : Z — **liste explicite**
- Usage `db push` (Prisma) détecté : **liste scripts**
- Tables total : X
- Avec foreign keys : Y
- Sans : Z — **liste explicite**
- Tables avec soft delete : Y
```

### Findings

- [ ] Système de migrations présent ?
- [ ] Migrations versionnées datées ?
- [ ] Reversibles (`down`) ?
- [ ] **Pas de `db push` en prod** ?
- [ ] Seed data reproductible ?
- [ ] Schéma single source of truth ?
- [ ] Migrations testées sur copie prod ?
- [ ] Zero-downtime pour migrations longues ?
- [ ] Foreign keys présentes ?
- [ ] Contraintes (NOT NULL, UNIQUE, CHECK) ?
- [ ] Types colonnes adaptés ?
- [ ] Dates en `TIMESTAMPTZ` ?
- [ ] IDs : UUID ou séquentiels ?

**Note risque de casse** : ⚠️ zone la plus destructrice. Une migration mal faite = perte de données irréversible. TOUJOURS : backup + test sur copie + plan de rollback.

### Score : X/10 — Risque régression : 🔴 (auto)

---

## SECTION 22 — Hallucination de code (transversal)

### Indexation (règle 24)

```markdown
## Métriques hallucination — listes explicites
- Imports non résolus : X — **liste**
- Méthodes obsolètes détectées : X — **liste** (ex: componentWillMount, jQuery.live, fs.exists)
- Signatures fonctions externes vs version installée : incohérences détectées — **liste**
- Ghost dependencies (rappel S20) : X — **liste**
```

### Findings

- [ ] Chaque import pointe vers module/fonction existant ?
- [ ] APIs externes : endpoints correspondent à doc actuelle ?
- [ ] Versions APIs : signatures correspondent à version installée ?
- [ ] Paramètres passés existent réellement ?
- [ ] Méthodes obsolètes ?
- [ ] Syntaxe moderne vs target ?
- [ ] Fonctions inventées (sonnent bien mais n'existent pas) ?
- [ ] Patterns impossibles (accès sync à résultat async) ?
- [ ] Headers HTTP / codes erreur inventés ?
- [ ] Ghost dependencies ?

### Score : X/10 — Risque régression : 🟢/🟡/🔴

---

## SECTION 23 — Cohérence globale (transversal)

### Indexation (règle 24)

```markdown
## Métriques cohérence globale — listes explicites
- Formats d'erreur API détectés : [{error}, {message}, {detail}, autre] — répartition par endpoint
- Codes HTTP utilisés pour même situation : **liste des incohérences**
- Conventions de nommage DB : [snake_case/camelCase/mixte] — **liste des tables mixtes**
- Formats de réponse : [objet/tableau/{data,meta}] — **liste des endpoints par format**
```

### Findings

- [ ] Validation : règles client ET serveur identiques ?
- [ ] Modèles : "User" défini pareil partout ?
- [ ] Noms routes cohérents ?
- [ ] REST ou RPC (pas mélange) ?
- [ ] Format erreur uniforme ?
- [ ] Codes HTTP corrects et cohérents ?
- [ ] Dates : ISO 8601 en API, localisé UI ?
- [ ] Nommage DB (snake_case + camelCase = piège) ?
- [ ] Formats réponse : objet/tableau/enveloppe cohérent ?
- [ ] États UI (loading/error/data) gérés pareillement ?

**Note risque de casse** : harmoniser les formats d'erreur sur une API existante casse tous les clients qui parsent l'ancien format. Versionner l'API si break nécessaire.

### Score : X/10 — Risque régression : 🟢/🟡/🔴

---

## SECTION 24 — Cohérence mentale — cadavres exquis ⭐

**Contexte** : signature du vibe coding sur plusieurs sessions.

### Indexation objective (règle 24)

```markdown
## Bibliothèques concurrentes — listes explicites

### HTTP
- axios : X fichiers — **liste**
- fetch : Y fichiers — **liste**
- got/node-fetch : Z fichiers — **liste**
- **Verdict** : 1=OK, 2+=⚠️, 3+=🔴

### Dates
- moment : X — **liste**
- date-fns : Y — **liste**
- dayjs/luxon : Z — **liste**
- Date natif : W — **liste**

### State management
- Redux, Zustand, Jotai, Context, useState pour data partagée : **détection + liste**

### Forms
- react-hook-form, Formik, final-form, useState manuel : **détection + liste**

### Validation
- Zod, Yup, Joi, regex maison : **détection + liste**

### CSS
- styled-components, Tailwind, CSS Modules, inline, Emotion : **détection + liste**

### UI Kits
- shadcn, MUI, Ant, Chakra, maison : **détection + liste**
```

```markdown
## Signes objectifs de dette de prompt — listes explicites

### Commentaires de dette
- `// hack` / `// HACK` : X — **liste** (fichier:ligne)
- `// fix` / `// FIX` : X — **liste**
- `// workaround` : X — **liste**
- `// temporary` / `// temp` : X — **liste**
- `// TODO: refactor` : X — **liste**
- `// not sure why this works` : X — **liste**
- `// ne pas toucher` / `// do not touch` : X — **liste**

### Fonctions versionnées
- `xxxV2`, `xxxNew`, `xxxFixed`, `xxxOld` : X — **liste explicite**

### Fichiers abandonnés
- Non importés : **liste explicite**
- Dossiers `_old`, `_backup`, `archive/` : **liste**

### Noms divergents même concept
- `user`/`userData`/`userInfo`/`currentUser`/`u` : **exemples fichier:ligne**
- `id`/`uuid`/`userId`/`user_id`/`ID` : **exemples**

### Patterns auth/API conflictuels
- Endpoints par type d'auth (JWT / sessions / basic / OAuth / API keys) : **répartition + liste**
```

### Calcul score "Dette de Prompt" /10

```markdown
Pondération :
- Libs concurrentes (8 catégories × 1 pt)
  - 0 redondances = 8 pts
  - Chaque catégorie avec 2+ libs = -1 pt
  - Chaque catégorie avec 3+ libs = -2 pts
- Commentaires dette : 0-10=0 / 11-30=-0.5 / 31+=-1
- Fonctions versionnées : 0-2=0 / 3-10=-0.5 / 11+=-1

Score = max(0, 10 - pénalités)
```

### Livrable obligatoire : matrice de redondance

```markdown
| Fonctionnalité | Implémentation #1 | #2 | #3 |
|---|---|---|---|
| Appel HTTP | axios (src/api/user.ts) | fetch (src/lib/posts.ts) | - |
| Validation email | Zod | regex | HTML5 |
| Formatage date | date-fns (front) | moment (back) | Date natif (emails) |
```

**Note risque de casse** : unifier les bibliothèques = refactor de N fichiers. Faire progressivement, un pattern à la fois.

### Score : X/10 — Risque régression : 🟡/🔴 (auto car refactor)

---

## 🔁 AUTO-VALIDATION L3

[format standard]

---

## 📤 LIVRABLE L3

```markdown
# RAPPORT PARTIEL — LAYER 3

## Résumé
- 🔴 : X | 🟠 : X | 🟡 : X | 🟢 : X
- Score accessibilité : X/100
- Score conformité RGPD : X/100
- Score SEO : X/100
- Score cohérence : X/100
- Score dette de prompt : X/10
- Confiance : X/10
- Risque régression L3 : 🟢/🟡/🔴

## Scoreboard L3
[tableau 12 sections]

## Top 5 fichiers à risque L3
[heatmap]

## Matrice de redondance (extrait)
[...]

## ✅ Ce qui est bien fait (NE PAS CASSER)
[...]

## Prochaines étapes
Prêt pour L4 (Maintenabilité & Évolution) dès validation.
```

---

## 🛑 STOP — VALIDATION HUMAINE REQUISE

**Fin L3 — v3.2 DÉFINITIVE**
