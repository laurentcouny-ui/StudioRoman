# 🔴 AUDIT VIBE-CODING — FICHIER 2/7 : LAYER 1 (BLOQUANT PROD)

**Version 3.2 DÉFINITIVE**
**À charger avec** : `audit-00-core.md`
**Durée** : 45-90 min
**Objectif** : identifier ce qui empêche une mise en prod safe

Contenu :
- **Phase -1** : indexation factuelle obligatoire
- **Phase 0** : découverte métier
- **Sections 1-5** : sécurité critique (accès, validation, secrets, erreurs, config prod)

**🆕 v3.2** : toutes les métriques appliquent la règle 24 du CORE (croisement obligatoire avec liste des non-conformes).

---

## ⚡ PHASE -1 — INDEXATION BRUTE OBLIGATOIRE

**Règle** : aucune analyse qualitative ne commence avant cette phase. Toute conclusion doit être traçable à cette cartographie.

### 1. Endpoints API

```markdown
| # | Méthode | Route | Fichier:ligne | Auth? | Validation? |
|---|---------|-------|---------------|-------|-------------|
| 1 | GET | /api/users | src/api/users.ts:12 | ? | ? |
```

### 2. Modèles / tables DB

```markdown
| # | Modèle/Table | Fichier | Champs clés | RLS/policies? |
|---|--------------|---------|-------------|---------------|
```

### 3. Middlewares

```markdown
| # | Middleware | Fichier:ligne | Appliqué à | Rôle |
|---|------------|---------------|------------|------|
```

### 4. Services externes

```markdown
| # | Service | Usage | Fichier | Credentials dans |
|---|---------|-------|---------|------------------|
```

### 5. Secrets potentiels

```markdown
- Fichiers `.env*` : [liste]
- Variables `PUBLIC_` / `NEXT_PUBLIC_` / `VITE_` : [liste]
- Fichiers de config sensibles : [liste]
```

### 6. Formulaires / entrées utilisateur

```markdown
| # | Formulaire | Fichier | Champs | Submit vers |
|---|------------|---------|--------|-------------|
```

### 7. Métriques brutes

- Fichiers de code : X
- Lignes de code : X
- Endpoints total : X
- Tables total : X
- Composants frontend : X
- Dépendances directes : X

**Règle** : cartographies EXHAUSTIVES (pas d'échantillonnage). Si > 200 entrées, tu les listes quand même toutes.

---

## 🧭 PHASE 0 — DÉCOUVERTE MÉTIER

1. Stack complète
2. Type d'app (landing / SaaS / outil interne / e-commerce / mobile)
3. Données manipulées (personnelles / paiements / santé / mineurs ?)
4. Âge du projet + nombre de commits
5. Signaux vibe-coding :
   - Commits génériques (`update`, `fix`)
   - Commits rapprochés (plusieurs par minute)
   - Gros commits initiaux (> 1000 lignes)
   - Absence de PRs / code review
   - Commentaires caractéristiques IA
6. Sections L1 applicables : ✅ ou N/A avec justification

---

## SECTION 1 — Contrôles d'accès et d'autorisation

**CWE** : CWE-862, CWE-863, CWE-639

### Indexation factuelle (avec règle 24 — croisement obligatoire)

```markdown
## Métriques auth — avec listes explicites

### Endpoints
- Total : X
- Avec auth : Y
- Sans auth : Z
- **Liste explicite des endpoints sans auth** (si volontaire ou oubli à statuer) :
  - GET /api/xxx (src/api/xxx.ts:12)
  - POST /api/yyy (src/api/yyy.ts:45)
  - ...

### Autorisation granulaire
- Endpoints authentifiés : Y
- Avec autorisation granulaire (vérification propriétaire/rôle) : A
- Avec auth mais sans autorisation granulaire : B
- **Liste explicite des B** (auth OK mais pas d'autorisation fine) :
  - fichier:ligne
  - ...

### Endpoints admin
- Total identifiés : X
- **Liste explicite** : [tous les endpoints admin]

### Middleware d'auth
- Middleware unique : OUI/NON
- Si NON → **liste explicite des endpoints avec auth ré-implémentée manuellement** :
  - fichier:ligne (logique d'auth inline)

### RLS Supabase (si applicable)
- Tables total : X
- Avec RLS activé : Y
- Sans RLS : Z
- **Liste explicite des tables sans RLS** :
  - nom_table (migrations/xxx.sql:ligne)
- Avec policies permissives (`USING (true)`) : A
- **Liste explicite des policies permissives** :
  - table_name / policy_name (fichier:ligne)
```

### Findings à rechercher

- [ ] Endpoints sans auth : volontaire ou oubli ?
- [ ] **IDOR** : user A peut-il accéder aux données de B via ID URL ? Tester 3 endpoints min.
- [ ] **RLS Supabase** : activé sur TOUTES les tables ? Policies réellement restrictives ?
- [ ] **Rôle admin** : vérifié côté serveur ou juste caché côté client ?
- [ ] **Auth middleware** : unique ou ré-implémenté (source d'oublis) ?
- [ ] **Webhooks externes** : signatures HMAC vérifiées ?
- [ ] **Endpoints destructifs** (DELETE, export massif) : protection renforcée ?
- [ ] **Multi-tenant** : chaque requête filtre par tenantId ?
- [ ] **JWT** : expiration ? refresh ? révocation ?
- [ ] **Session fixation** : nouvelle session après login ?
- [ ] **CSRF** : tokens sur mutations si cookies ?
- [ ] **Changement password/email** : confirmation old password ?

### Test concret obligatoire

3 endpoints retournant des data user :

```markdown
| Endpoint | User A OK | User B tente data de A | Résultat |
|---|---|---|---|
```

### Findings détaillés

Format enrichi v3.2 (voir CORE).

### Ce qui est correctement fait (NE PAS CASSER)
[liste explicite]

### À VÉRIFIER MANUELLEMENT
[...]

### Score de confiance Section 1 : X/10

### Risque régression global section : 🟢/🟡/🔴

---

## SECTION 2 — Validation et sanitisation des entrées

**CWE** : CWE-20, CWE-89, CWE-79, CWE-22, CWE-918

### Indexation factuelle (règle 24)

```markdown
## Métriques validation — avec listes explicites

### Validation serveur
- Endpoints total : X
- Avec schéma validation (Zod/Joi/Yup/Pydantic) : Y
- Sans validation serveur : Z
- **Liste explicite des Z endpoints sans validation** :
  - POST /api/xxx (src/api/xxx.ts:ligne)
  - ...

### Patterns dangereux détectés
- `dangerouslySetInnerHTML` : X occurrences
- **Liste explicite** :
  - src/components/Post.tsx:42
  - ...
  
- `innerHTML =` : X occurrences
- **Liste explicite** : [...]

- `v-html` : X occurrences — **liste** : [...]

- `eval(` / `Function(` : X occurrences — **liste** : [...]

- Concaténation SQL suspecte : X occurrences
- **Liste explicite** : [...]

- `exec()` / `spawn()` avec input user : X occurrences — **liste** : [...]
```

### Findings à rechercher

- [ ] Validation serveur 100% ?
- [ ] **SQL paramétré** ou concaténation ?
- [ ] **NoSQL injection** : operators `$gt`, `$ne` injectables ?
- [ ] **XSS** : sorties échappées ?
- [ ] **Upload** : MIME vérifié serveur ? Taille ? Nom sanitisé ? Hors webroot ?
- [ ] **Path traversal** : `../`, `..\\`, null bytes filtrés ?
- [ ] **SSRF** : URLs user restreintes (pas 10.x, 172.16-31.x, 192.168.x, 169.254.x, localhost) ?
- [ ] **Command injection** : `exec`, `shell=True` avec input user ?
- [ ] **Prototype pollution** : `Object.assign`, spread avec objets user ?
- [ ] **SSTI** : templates avec input user ?
- [ ] **Deserialization** : `pickle.loads`, `unserialize` sur input user ?
- [ ] **Open redirect** : redirects user validées ?
- [ ] **XXE** : parsers XML configurés sans entités externes ?
- [ ] **ReDoS** : regex avec backtracking catastrophique ?

### Test concret obligatoire

10 variables user tracées jusqu'à usage final :

```markdown
| # | Variable | Source | Usage | Validée | Échappée | Risque |
|---|---|---|---|---|---|---|
```

### Score de confiance : X/10
### Risque régression : 🟢/🟡/🔴

---

## SECTION 3 — Gestion des secrets

**CWE** : CWE-798, CWE-522

### Commandes obligatoires

```bash
grep -rIE "sk_[a-z]*_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{30,}|AKIA[A-Z0-9]{16}|ghp_[A-Za-z0-9]{30,}|xoxb-[0-9]+" . 2>/dev/null
git log -p --all 2>/dev/null | grep -iE "sk_[a-z]*_|api[_-]?key|secret|password|token|bearer" | head -100
git log --all --full-history -- "**/.env*" 2>/dev/null
```

### Indexation factuelle (règle 24)

```markdown
## Métriques secrets — avec listes explicites

### Fichiers sensibles
- Fichiers `.env*` actuels : [liste complète]
- Fichiers `.env*` dans historique Git : [liste complète avec commits]

### Secrets actifs détectés
- Total dans le code source : X
- **Liste explicite** (anonymisée, type + fichier:ligne) :
  - sk_live_... (src/lib/stripe.ts:12) → Stripe production
  - sk-proj-... (src/lib/openai.ts:8) → OpenAI
  - ...

### Secrets dans l'historique Git (même retirés)
- Total : X
- **Liste explicite** (commit + fichier) :
  - commit abc123 (src/config.ts) — clé Stripe retirée depuis
  - ...

### Variables PUBLIC_ à risque
- Total variables préfixées PUBLIC_/NEXT_PUBLIC_/VITE_ : X
- Potentiellement secrètes (non-conformes) : Y
- **Liste explicite des Y variables suspectes** :
  - NEXT_PUBLIC_API_KEY (fichier:ligne) → pas publique !
  - ...

### Clés LLM côté client
- Clés API LLM détectées : [fichiers avec localisation]
- Exposées au client (🔴 critique) : [liste]
```

### Findings

- [ ] Secrets actifs dans code : 🔴 auto
- [ ] Secrets dans historique Git (même retirés) : 🔴 — révocation obligatoire
- [ ] `service_role` Supabase / admin SDK Firebase côté client : 🔴
- [ ] Clés API LLM côté client : 🔴 (exploitables pour quota-bombing)
- [ ] Variables `NEXT_PUBLIC_` / `VITE_` avec secret : 🔴
- [ ] `.gitignore` : `.env*` ignoré ?
- [ ] Rotation prévue ?
- [ ] Secrets manager (Doppler/Vault/AWS) ou tout dans `.env` ?
- [ ] Clés de chiffrement : localisation sécurisée ?
- [ ] Secrets dans les logs : recherche `console.log(req.headers)`, etc.
- [ ] Secrets dans messages d'erreur client ?
- [ ] Clés test en prod ?

**Note risque de casse** : la rotation de secrets nécessite coordination (nouveau secret déployé AVANT suppression de l'ancien, sinon downtime).

### Score de confiance : X/10
### Risque régression : 🟢/🟡/🔴

---

## SECTION 4 — Gestion des erreurs et cas limites

### ⚠️ RÈGLE DURE — Anti-silent-fail

**Tout `catch` qui NE FAIT PAS l'une de :**
1. `throw` avec contexte enrichi
2. Envoi à tracker externe (Sentry, etc.)
3. Logger structuré + notification alternative
4. Recovery documentée par commentaire

= **🔴 CRITIQUE automatique**

**Patterns flaggués 🔴** :
```javascript
try { ... } catch(e) {}
try { ... } catch(e) { console.log(e) }
try { ... } catch {}
```
```python
except: pass
except Exception: pass
```

### Indexation factuelle (règle 24)

```markdown
## Métriques erreurs — avec listes explicites

### Try/catch
- Total : X
- Conformes (throw/tracker/logger+notif/recovery documentée) : Y
- Non conformes (silent fails) : Z
- **Liste explicite des Z catch silencieux** :
  - src/api/users.ts:42 (catch vide)
  - src/lib/payment.ts:88 (juste console.log)
  - ...

### Gestion promises
- Appels async total identifiés : X
- Avec .catch() ou try/catch englobant : Y
- Sans gestion d'erreur : Z
- **Liste explicite** : [...]

### Error boundaries React
- Composants de routing principaux : X
- Avec ErrorBoundary : Y
- Sans : Z
- **Liste explicite des routes sans boundary** : [...]

### Timeouts réseau
- Appels externes total : X
- Avec timeout configuré : Y
- Sans timeout : Z
- **Liste explicite des Z sans timeout** :
  - src/api/stripe.ts:45 (stripe.charges.create)
  - src/lib/mailgun.ts:23
  - ...
```

### Findings

- [ ] Liste exhaustive des catch silencieux (via indexation ci-dessus)
- [ ] Null/undefined checks
- [ ] Division par zéro / opérations maths non sécurisées
- [ ] Tableaux vides : comportement user-friendly ?
- [ ] Timeouts réseau configurés ?
- [ ] Retries avec backoff exponentiel ?
- [ ] Race conditions
- [ ] Transactions DB atomiques ?
- [ ] Messages d'erreur user : révèlent stack traces/chemins/versions ?
- [ ] Error boundaries présents ?
- [ ] Unhandled promise rejections : `process.on('unhandledRejection')` ?
- [ ] Signaux SIGTERM : graceful shutdown ?
- [ ] Mode dégradé si service down ?
- [ ] Circuit breakers ?

**Note risque de casse** : corriger un catch silencieux peut exposer des erreurs jusque-là masquées qui affichaient un résultat "dégradé mais fonctionnel". Attention aux side effects.

### Score de confiance : X/10
### Risque régression : 🟢/🟡/🔴

---

## SECTION 5 — Configuration de production

### Indexation factuelle (règle 24)

```markdown
## Métriques config prod — avec listes explicites

### Headers de sécurité HTTP
- Headers critiques attendus : 6 (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- Configurés : X
- Manquants : Y
- **Liste explicite des Y headers manquants** :
  - Content-Security-Policy : ABSENT
  - ...

### Cookies
- Cookies définis dans le code : X
- Conformes (Secure + HttpOnly + SameSite) : Y
- Non conformes : Z
- **Liste explicite des Z cookies non conformes** :
  - `session_id` (src/auth/session.ts:12) — manque SameSite
  - ...

### Endpoints debug exposés
- Routes détectées en dev : [liste]
- Protégées en prod : [oui/non + condition détectée]
- **Liste explicite des endpoints potentiellement exposés en prod** :
  - /api/debug (src/api/debug.ts:1) — pas de check NODE_ENV
  - ...

### CORS
- Endpoints avec CORS configuré : X/Y
- **Liste explicite des endpoints avec CORS laxiste** (`*` + credentials, ou wildcard sur auth) : [...]

### Mode debug
- Variables DEBUG/NODE_ENV détectées : [valeurs]
- Fichiers avec mode debug activé en dur : **liste explicite**
```

### Findings

**Headers sécurité HTTP** :
- [ ] `Content-Security-Policy` (sans `unsafe-inline`/`unsafe-eval`)
- [ ] `Strict-Transport-Security` (HSTS)
- [ ] `X-Frame-Options` ou CSP `frame-ancestors`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy`
- [ ] `Permissions-Policy`

**Autres** :
- [ ] TLS ≥ 1.2, cert valide, auto-renew ?
- [ ] Endpoints debug (/debug, /admin/test) accessibles prod ?
- [ ] Mode debug désactivé (`DEBUG=False`, `NODE_ENV=production`) ?
- [ ] CORS restrictif (pas `*` avec `credentials: true`) ?
- [ ] Cookies : Secure, HttpOnly, SameSite ?
- [ ] Erreurs verbeuses désactivées en prod ?
- [ ] Compression (attention BREACH/CRIME si auth + compression) ?
- [ ] Taille max requêtes limitée ?
- [ ] Endpoints exposés : `/.env`, `/.git/config` ne répondent pas 200 ?
- [ ] Source maps en prod : fichiers `.map` accessibles ?
- [ ] Logs centralisés ?
- [ ] Secrets prod : secrets manager ou dashboard hébergeur ?

**Note risque de casse** : activer CSP strict peut casser des intégrations tierces. Tester en `Content-Security-Policy-Report-Only` d'abord.

### Score de confiance : X/10
### Risque régression : 🟢/🟡/🔴

---

## 🔁 AUTO-VALIDATION LAYER 1

```markdown
## AUTO-VALIDATION L1

### 3 affirmations re-vérifiées
[pour chaque : finding d'origine, citation exacte, re-vérif, verdict ✅/❌/⚠️, action]

### Zones de faible confiance
[sections < 7/10]

### Métriques L1
- Couverture : X%
- 🔴 : X | 🟠 : X | 🟡 : X | 🟢 : X
- Confiance globale : X/10
- Risque régression corrections L1 : 🟢/🟡/🔴
```

---

## 📤 LIVRABLE L1

```markdown
# RAPPORT PARTIEL — LAYER 1 (BLOQUANT PROD)

## Résumé
- 🔴 : X | 🟠 : X | 🟡 : X | 🟢 : X
- Score sécurité : X/100
- Confiance : X/10
- Risque régression : 🟢/🟡/🔴

## ⛔ BLOCKERS ABSOLUS
[critiques uniquement]

## Scoreboard L1
[tableau 5 sections]

## Cartographies (Phase -1)
[rappel]

## Top 5 fichiers à risque L1
[heatmap]

## ✅ Ce qui est bien fait (NE PAS CASSER)
[...]

## Prochaines étapes
Prêt pour L2 dès validation. 
**Recommandation** : corriger les 🔴 L1 avant L2.
```

---

## 🛑 STOP — VALIDATION HUMAINE REQUISE

**Tu t'arrêtes. Pas de passage automatique au L2.**

---

**Fin L1 — v3.2 DÉFINITIVE**
