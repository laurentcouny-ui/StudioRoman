# 🟠 AUDIT VIBE-CODING — FICHIER 3/7 : LAYER 2 (SCALABILITÉ)

**Version 3.2 DÉFINITIVE**
**À charger avec** : `audit-00-core.md`
**Prérequis** : L1 audité et validé
**Durée** : 60-120 min

Sections 6-12 : architecture, perf, observabilité, tests, rate limiting, webhooks, coûts

**🆕 v3.2** : règle 24 appliquée partout + Top 3 bottlenecks obligatoires + pire scénario coût réaliste.

---

## ⚡ RAPPEL PHASE -1

Si cartographie L1 non en contexte → la refaire. Sinon, produire ces métriques L2 :

```markdown
## Métriques L2
- Appels externes APIs tierces : X endpoints, dans X fichiers
- Dépendances total : X (npm audit / pip-audit : [CVE])
- Fichiers de tests : X
- Ratio LOC tests / LOC app : X%
- Files queue/jobs : [liste]
- Cache layer : [Redis/Memcached/aucun]
- CDN : [Cloudflare/Vercel/aucun]
```

---

## SECTION 6 — Architecture et dette technique

### Indexation (règle 24)

```markdown
## Métriques architecture — listes explicites
- Fichiers > 500 lignes : X
- **Liste explicite** : [chaque fichier avec ligne count]
- Fonctions > 100 lignes : X — **liste** : [...]
- Dépendances circulaires : X — **liste** : [paires impliquées]
- TODO/FIXME/HACK/XXX : X occurrences — **liste** : [fichier:ligne]
- Dead code suspect : X — **liste explicite des fichiers/fonctions**
- `any` (TS) / `Any` (Py) : X — **top 20 occurrences**
```

### Findings

- [ ] Séparation couches (présentation/métier/données) ?
- [ ] Fichiers monstres (> 500 lignes) avec rôle
- [ ] Duplication de code (blocks identiques dans N fichiers) ?
- [ ] Cohérence nommage ?
- [ ] Couplage fort / dépendances circulaires ?
- [ ] God objects / God files ?
- [ ] **Dead code** : imports jamais utilisés, fonctions jamais appelées, fichiers orphelins ?
- [ ] **Ghost dependencies** : packages listés mais jamais importés (marqueur hallucination IA)
- [ ] Magic numbers/strings dispersés ?
- [ ] État global chaotique (Redux + Context + Zustand pour même data) ?
- [ ] Dépendances inutiles ?
- [ ] Versions obsolètes / CVE connues ?
- [ ] Typage laxiste ?
- [ ] Commentaires sur sections critiques ?
- [ ] Vieux TODOs (date commits) ?

**Note risque de casse** : supprimer du dead code apparent peut casser si utilisé via reflection/import dynamique. Vérifier avant suppression.

### Score : X/10 — Risque régression : 🟢/🟡/🔴

---

## SECTION 7 — Performance et scalabilité

### Indexation (règle 24)

```markdown
## Métriques performance — listes explicites

### Requêtes DB
- Total identifiées : X
- Avec pagination : Y
- Sans pagination (LIMIT) : Z — **liste explicite** : [endpoints avec fichier:ligne]

### Requêtes N+1 suspectes
- Détectées : X — **liste explicite** : [fichier:ligne + description pattern]

### Cache
- Niveaux de cache présents : [applicatif/HTTP/CDN/aucun]
- Endpoints GET statiques total : X
- Avec cache HTTP : Y
- Sans cache : Z — **liste explicite**

### Images
- Images total dans le code : X
- En format moderne (WebP/AVIF) : Y
- En JPEG/PNG : Z — **liste explicite des plus volumineuses**

### useEffect avec dépendances suspectes
- Total useEffect : X
- Avec deps inline (objet/fonction recréée) : Y — **liste explicite**
```

### Findings

- [ ] **Requêtes N+1** (pattern classique IA)
- [ ] Index DB sur WHERE/JOIN/ORDER BY
- [ ] Pagination présente ?
- [ ] Cache Redis/Memcached ?
- [ ] Cache HTTP sur GET statiques ?
- [ ] CDN pour assets ?
- [ ] Lazy loading (images, routes, composants) ?
- [ ] Bundle size / code splitting ?
- [ ] Opérations bloquantes event loop ?
- [ ] Jobs async pour emails/PDF/images ?
- [ ] Pool connexions DB configuré ?
- [ ] Appels séquentiels parallélisables (`Promise.all`) ?
- [ ] Memory leaks (listeners, timers, useEffect sans cleanup) ?
- [ ] Compression serveur ?
- [ ] Images : WebP/AVIF ? Dimensions adaptées ?
- [ ] `SELECT *` inutiles ?

**Note risque de casse** : ajouter un cache peut masquer des bugs de cohérence. Ajouter une pagination casse l'UI si le frontend attend un tableau complet.

### Score : X/10 — Risque régression : 🟢/🟡/🔴

---

## SECTION 8 — Observabilité

### Indexation (règle 24)

```markdown
## Métriques observabilité — listes explicites

### Logs
- `console.log` détectés : X — **liste explicite** (top 30 fichier:ligne)
- Logger structuré utilisé : OUI/NON (lib : [...])
- Logs avec PII potentiel : X suspectés — **liste explicite** :
  - src/api/auth.ts:45 (log de req.body)
  - ...

### Error tracking
- SDK Sentry/Rollbar/Bugsnag installé : OUI/NON
- Initialisé dans le code : OUI/NON (fichier)

### Healthcheck
- Endpoint détecté : [path ou "absent"]

### Métriques custom
- Export Prometheus/StatsD : OUI/NON
```

### Findings

- [ ] Logging structuré ou console.log partout ?
- [ ] Niveaux log utilisés correctement ?
- [ ] Corrélation (request_id / trace_id) ?
- [ ] Logs sensibles (passwords, tokens, PII) ? VIOLATION RGPD
- [ ] Error tracking intégré ?
- [ ] Uptime monitoring ?
- [ ] Métriques métier trackées ?
- [ ] Alerting sur seuils ?
- [ ] Distributed tracing si microservices ?
- [ ] Dashboards ?
- [ ] Healthcheck vrai check (pas juste 200 OK) ?
- [ ] Analytics produit (Posthog/Mixpanel/Plausible) ?
- [ ] Logs centralisés ou stdout perdu ?
- [ ] Rétention logs définie ?

**Note risque de casse** : ajouter Sentry mal configuré peut exposer des données sensibles vers un tiers si le scrubbing n'est pas bon.

### Score : X/10 — Risque régression : 🟢/🟡/🔴

---

## SECTION 9 — Tests automatisés

### Indexation (règle 24)

```markdown
## Métriques tests — listes explicites

### Couverture
- LOC app : X | LOC tests : Y | Ratio : X%
- Fichiers de tests : X
- Tests unitaires : X | intégration : Y | E2E : Z
- Tests skipped/todo : X — **liste explicite** : [fichier:ligne + raison]

### Couverture par zone critique
| Zone | Fichiers | Tests couvrant | Taux |
|---|---|---|---|
| Auth | X | Y | % |
| Paiement | X | Y | % |
| Upload | X | Y | % |
| Webhooks | X | Y | % |
| Admin | X | Y | % |

- **Zones à haut risque SANS tests** : [liste explicite]

### CI
- Présence CI : OUI/NON (fichier)
- Blocage merge si tests rouges : OUI/NON
```

### Findings

- [ ] Existence de tests ?
- [ ] Coverage %
- [ ] Happy path only ou cas d'erreur aussi ?
- [ ] Tests d'auth (403/401 expected) ?
- [ ] Tests validation entrées malformées ?
- [ ] Tests sécurité (SQLi, XSS, IDOR) ?
- [ ] Fixtures réalistes ou triviaux ?
- [ ] CI à chaque PR ? blocage merge si rouge ?
- [ ] Tests régression pour chaque bug fix ?
- [ ] Load testing (k6/Artillery/Locust) ?
- [ ] Cross-browser (Playwright/Cypress) ?
- [ ] Tests skippés : combien, pourquoi ?
- [ ] Tests lents (> 10s = mauvais mocking) ?
- [ ] Snapshots obsolètes ?

### Score : X/10 — Risque régression : 🟢/🟡/🔴

---

## SECTION 10 — Rate limiting et anti-abus

### Indexation (règle 24)

```markdown
## Métriques rate limiting — listes explicites

### Rate limiting
- Middleware global détecté : OUI/NON (package)
- Endpoints total : X
- Avec rate limit : Y
- Sans rate limit : Z — **liste explicite des endpoints sensibles sans limite** :
  - POST /api/login (src/api/auth.ts:12)
  - POST /api/signup (src/api/signup.ts:8)
  - POST /api/password-reset (src/api/reset.ts:5)
  - ...

### CAPTCHA
- Formulaires sensibles identifiés (login/signup/reset/contact) : X
- Avec CAPTCHA : Y
- Sans CAPTCHA : Z — **liste explicite**
```

### Findings

- [ ] Rate limiting global par IP ?
- [ ] Rate limit spécifique (login, reset, signup) plus strict ?
- [ ] Brute force : lockout + CAPTCHA ?
- [ ] DDoS : Cloudflare/WAF ?
- [ ] Bot protection ?
- [ ] **Énumération utilisateurs** : login révèle-t-il si email existe ? Message identique obligatoire.
- [ ] Timing attacks : `timingSafeEqual` ?
- [ ] CAPTCHA signup ?
- [ ] Circuit breakers sur appels externes ?
- [ ] API key per user : limitation ?
- [ ] Upload limits ?

**Note risque de casse** : rate limit trop strict bloque les utilisateurs légitimes. Commencer permissif, ajuster par monitoring.

### Score : X/10 — Risque régression : 🟢/🟡/🔴

---

## SECTION 11 — Webhooks et intégrations externes

### Indexation (règle 24)

```markdown
## Métriques webhooks et appels externes — listes explicites

### Webhooks entrants
- Total identifiés : X (providers : Stripe/Clerk/GitHub/autres)
- Avec vérification signature HMAC : Y
- Sans vérification : Z — **liste explicite** :
  - /api/stripe-webhook (src/api/webhooks/stripe.ts:12) — pas de stripe.webhooks.constructEvent
  - ...

### Appels externes sortants
- Total : X
- Avec timeout configuré : Y
- Sans timeout : Z — **liste explicite** :
  - src/api/stripe.ts:45 (charges.create)
  - src/api/mailgun.ts:23
  - ...

- Avec retry backoff : Y / X
- Sans retry : Z — **liste explicite**

- Avec gestion 429 (rate limit) : Y
- Sans : Z — **liste explicite**
```

### Webhooks entrants

- [ ] Signature vérifiée (HMAC Stripe, etc.) ?
- [ ] Idempotence (compteur `event_id` stocké) ?
- [ ] Timeout < 5s sinon retry provider ?
- [ ] Retry-safe ?
- [ ] Logs avec ID ?
- [ ] Event replay possible ?
- [ ] Payload validé (pas juste confiance) ?

### Appels sortants

- [ ] Timeout défini ?
- [ ] Retry backoff ?
- [ ] Gestion 429 ?
- [ ] Gestion 5xx temporaires ?
- [ ] Credentials secrets manager ?
- [ ] Fallback si service down ?
- [ ] Circuit breaker ?

**Note risque de casse** : ajouter vérification signature sur webhooks existants casse les anciens envois si la clé change. Migration progressive nécessaire.

### Score : X/10 — Risque régression : 🟢/🟡/🔴

---

## SECTION 12 — Coûts cloud et LLM ⭐

**Contexte** : apps vibe-codées peuvent exploser les coûts silencieusement.

### Indexation (règle 24)

```markdown
## Métriques coûts — listes explicites

### Appels LLM
- Total appels LLM dans le code : X — **liste explicite** (fichier:ligne + modèle)
- Avec cache sémantique : Y
- Sans cache : Z — **liste explicite**
- Modèles utilisés : [gpt-4, claude-opus, etc.]

### Boucles potentielles
- Agents avec max_iterations configuré : X
- Agents sans limite : Y — **liste explicite** (🔴 auto)
- Polling < 5s : X — **liste explicite**
- useEffect avec deps inline : X — **liste explicite**

### Quotas par utilisateur
- Rate limit sur features IA : OUI/NON
- Hard cap journalier/mensuel : OUI/NON
- Tracking tokens par user : OUI/NON

### Clés API LLM côté client
- Détectées : X — **liste explicite** (🔴 auto)
```

### Findings

**Boucles et consommation** :
- [ ] Re-renders React incontrôlés : `useEffect(() => fetch(), [objetInline])` ?
- [ ] Appels API dans render body (hors useEffect) ?
- [ ] Polling agressif (< 5s) ?
- [ ] Debounce/throttle manquants ?
- [ ] Subscriptions non nettoyées ?
- [ ] Requêtes identiques répétées (pas de SWR/React Query) ?

**Spécifique LLM / Agents** :
- [ ] Boucles agent : `max_iterations` / `recursion_limit` ?
- [ ] Prompts optimisés (pas historique complet à chaque appel) ?
- [ ] Modèle fallback (Haiku/Mini au lieu de Opus/GPT-4) ?
- [ ] Streaming utilisé ?
- [ ] Context stuffing (100k tokens systématiquement) ?
- [ ] Cache sémantique ?
- [ ] Tokens trackés par user ?
- [ ] Clés API LLM côté client (rappel L1 S3) : 🔴
- [ ] Rate limiting LLM par user ?
- [ ] Quotas hard cap journalier/mensuel ?

**Infrastructure cloud** :
- [ ] Fonctions serverless : cold starts par mauvais bundling ?
- [ ] Logs verbeux (coût stockage > coût app) ?
- [ ] Egress (transferts sortants) maîtrisé ?
- [ ] Instances auto-scalées down ?
- [ ] Storage nettoyé (pas de fichiers temp qui gonflent) ?
- [ ] Indexes DB manquants (rappel S7) ?
- [ ] Budget alerts configurés ?
- [ ] Double infrastructure (staging H24) ?

### Livrable coût obligatoire

```markdown
## Estimation coût mensuel — 1000 users actifs

| Poste | Bas | Haut | Hypothèses |
|---|---|---|---|
| Hébergement | X€ | Y€ | |
| DB | X€ | Y€ | |
| LLM | X€ | Y€ | |
| Stockage | X€ | Y€ | |
| Egress | X€ | Y€ | |
| Error tracking | X€ | Y€ | |
| **Total** | **X€** | **Y€** | |

## 🆕 Pire scénario réaliste (v3.2)

**Scénario catastrophe** : [décrire le pire enchaînement plausible]

Exemples :
- Bug X (clé API LLM côté client) + exploitation par bot → facture mensuelle estimée : X€
- Boucle agent non limitée + 1 user malveillant → facture journalière : X€
- Requête N+1 sur table 1M lignes + 100 users simultanés → RDS scale-up forcé : X€/mois
- Pas de cache LLM + users qui posent les mêmes questions → surcoût : X€/mois

**Probabilité d'occurrence** : FAIBLE / MOYENNE / ÉLEVÉE
**Détectabilité** : IMMÉDIATE / SOUS 24H / SOUS 1 SEMAINE / INDÉTECTABLE SANS MONITORING

## Top 5 patterns risque explosion coût
1. [pattern détecté] → multiplicateur de coût : x[N]
2. ...
```

**Note risque de casse** : downgrader de GPT-4 vers GPT-4-mini peut dégrader la qualité des réponses. Tester sur échantillon avant bascule.

### Score : X/10 — Risque régression : 🟢/🟡/🔴

---

## 🆕 TOP 3 BOTTLENECKS L2 (v3.2 — OBLIGATOIRE)

**À produire en fin de layer, avant l'auto-validation.**

```markdown
## Top 3 bottlenecks identifiés dans L2

### Bottleneck #1 — [Catégorie : DB / API / Render / Cache / Network / LLM]
- **Localisation** : fichier:ligne
- **Preuve** : [extrait code ou métrique]
- **Impact estimé** : [ce qui casse en premier sous charge]
- **Sous quelle charge** : [ex: > 50 users simultanés]
- **Correction recommandée** : [approche]
- **Gain attendu** : [ex: -60% latence sur endpoint X]

### Bottleneck #2
[idem]

### Bottleneck #3
[idem]

### Diagnostic synthétique
Le maillon faible principal de cette app sous charge est : [1 phrase]
```

---

## 🔁 AUTO-VALIDATION L2

```markdown
## AUTO-VALIDATION L2

### 3 affirmations re-vérifiées
[format standard]

### Zones de faible confiance
- [sections < 7/10]

### Métriques L2
- Couverture : X%
- 🔴 : X | 🟠 : X | 🟡 : X | 🟢 : X
- Confiance : X/10
- Risque régression L2 : 🟢/🟡/🔴
```

---

## 📤 LIVRABLE L2

```markdown
# RAPPORT PARTIEL — LAYER 2

## Résumé
- 🔴 : X | 🟠 : X | 🟡 : X | 🟢 : X
- Score robustesse : X/100
- Score performance : X/100
- Score observabilité : X/100
- Risque coût : FAIBLE/MOYEN/ÉLEVÉ/CRITIQUE
- Confiance : X/10
- Risque régression L2 : 🟢/🟡/🔴

## 💸 Alerte coût
- Estimation mensuelle 1000 users : X€ - Y€
- **Pire scénario réaliste** : X€ (probabilité : [...])

## 🎯 Top 3 bottlenecks
1. [...]
2. [...]
3. [...]

## Scoreboard L2
[tableau 7 sections]

## Top 5 fichiers à risque L2
[heatmap]

## ✅ Ce qui est bien fait (NE PAS CASSER)
[...]

## Prochaines étapes
Prêt pour L3 dès validation.
```

---

## 🛑 STOP — VALIDATION HUMAINE REQUISE

**Fin L2 — v3.2 DÉFINITIVE**
