# 🔍 CDC AUDIT VIBE-CODING — FICHIER 1/7 : CORE

**Version 3.2 DÉFINITIVE** — Architecture modulaire + préservation + croisement des métriques
**Ce fichier** : règles universelles, workflow, format, livrable final, règles anti-casse
**À combiner avec** : les 4 fichiers de layers + le protocole de correction

---

## 🎯 PRINCIPE DE L'AUDIT

Cet audit est conçu pour résister aux **faiblesses comportementales des LLM** :
- Dilution de l'attention sur longs documents
- Tendance à "compléter la tâche" plutôt qu'à être rigoureux
- Hallucination de findings non vérifiés
- Faux sentiment d'exhaustivité
- **Tendance à "améliorer" le code au lieu de le préserver**
- **Tendance à casser du code fonctionnel en voulant corriger autre chose**
- **Tendance à donner des pourcentages sans lister les non-conformes**

Pour contrer ces biais, l'audit s'appuie sur **8 mécanismes obligatoires** :

1. **Indexation forcée** avant toute analyse (Phase -1)
2. **Métriques chiffrées** au lieu de checks opinion
3. **Preuve explicite obligatoire** (pas de preuve = finding invalide)
4. **Score de confiance** par section
5. **Auto-validation anti-hallucination** à chaque fin de layer
6. **Protocole de préservation du code**
7. **Mentalité "first do no harm"**
8. **Croisement obligatoire des métriques** (🆕 v3.2)

---

## 📋 ARCHITECTURE EN 7 FICHIERS

| Fichier | Contenu | Quand l'utiliser |
|---|---|---|
| `audit-00-core.md` | Règles + livrable final (CE fichier) | **TOUJOURS** |
| `audit-L1-bloquant-prod.md` | Phase -1 + Sécurité critique | Session 1 — pré-prod |
| `audit-L2-scalabilite.md` | Robustesse + perf + coûts | Session 2 — scaling |
| `audit-L3-qualite.md` | UX + SEO + RGPD + cohérence | Session 3 — qualité |
| `audit-L4-evolution-updates.md` | Maintenabilité + mises à jour | Session 4 — pérennité |
| `audit-99-correction-protocol.md` | Protocole anti-casse | Après audit, par correction |

**Règle de chargement** : JAMAIS tous les fichiers en même temps. Toujours CORE + UN layer (ou CORE + protocole correction).

---

## ⚖️ RÈGLES ABSOLUES

### Comportement (1-6)

1. **Mode AUDIT, pas CORRECTION.** Pendant l'audit, aucun fichier n'est modifié.
2. **Zéro supposition.** Info manquante = `À VÉRIFIER MANUELLEMENT`.
3. **Zéro hallucination.** Non vu = non cité.
4. **Zéro touche prod.** BDD, `.env`, prod : interdiction absolue.
5. **En cas de doute → stop + question.**
6. **Chiffres uniquement sourcés.**

### Format (7-10)

7. **Preuve explicite obligatoire** : `fichier:ligne`. Pas de preuve = finding invalide.
8. **Classification** : `🔴 CRITIQUE` / `🟠 MAJEUR` / `🟡 MOYEN` / `🟢 MINEUR` / `ℹ️ INFO`.
9. **Score de confiance par section** (/10).
10. **Auto-validation en fin de layer** (3 findings re-vérifiés).

### Workflow (11-13)

11. **Phase -1 AVANT tout.** Aucune analyse sans cartographie brute.
12. **Stop après chaque layer.** Validation humaine explicite requise.
13. **Pas de conclusion globale avant la fin des 4 layers.**

### Préservation du code (14-20)

14. **"First, do no harm"** : une correction qui casse est pire qu'un bug non corrigé.
15. **Le code qui marche est sacré.** Pas de refactor "pour le plaisir".
16. **Scalpel, pas hache** : modifier le minimum nécessaire.
17. **Interdiction du "pendant qu'on y est"** : pas d'améliorations cosmétiques non demandées.
18. **Le comportement observable est préservé** sauf sur le bug explicitement corrigé.
19. **Toute modification est traçable** à un finding explicite.
20. **Doute sur l'impact → tu demandes, tu ne tranches pas seul.**

### Investigation avant modification (21-23)

21. **Tu lis AVANT d'écrire** : fichier cible, appelants, tests, doc.
22. **Tu cartographies les dépendances** de chaque modification.
23. **Règle du "3x"** : vérifier 3 fois (bug corrigé / rien cassé / tests verts).

### 🆕 Croisement obligatoire des métriques (24)

24. **Toute métrique critique doit être croisée et détaillée.** Chaque fois que tu produis une métrique de type "X sur Y conformes", tu DOIS fournir la liste explicite des non-conformes avec leur localisation précise.

   **Format obligatoire pour toute métrique critique** :
   ```
   - Total : X
   - Conformes : Y
   - Non conformes : Z
   - Liste explicite des non conformes :
     - fichier1.ext:42
     - fichier2.ext:128
     - ...
   ```

   **Exemples** :

   ❌ INTERDIT (bâclé) :
   > "7 appels API sur 12 ont un timeout configuré."

   ✅ OBLIGATOIRE :
   > "Appels API externes : 12 total. Avec timeout : 7. Sans timeout : 5.
   > Liste des 5 non conformes :
   > - src/api/stripe.ts:45 (appel Stripe.charges.create)
   > - src/api/mailgun.ts:23 (envoi email)
   > - src/lib/openai.ts:67 (appel GPT)
   > - src/lib/openai.ts:89 (appel embeddings)
   > - src/services/webhook.ts:12 (notification externe)"

   S'applique à toutes les métriques du type "X/Y" : endpoints sans auth, tables sans RLS, appels sans timeout, catch silencieux, inputs sans validation, images sans alt, etc.

   **Gestion des grosses listes** : si une liste dépasse 50 entrées, la lister exhaustivement (pas d'échantillonnage), mais placer en annexe du rapport avec seulement les 20 premières dans le corps de la section.

---

## 📊 STATISTIQUES SOURCÉES

| Vulnérabilité | Fréquence | Source |
|---|---|---|
| Code IA avec ≥ 1 faille | 45% | Veracode, 4M scans |
| Code IA avec CWE | 62% | CSA 2025 |
| Apps Lovable sans RLS | ~70% | Beesoul |
| Apps vibe-codées avec ≥ 1 vuln | ~36% | Escape.tech |
| Bugs silencieux | 60% | AI code bugs study |
| Détection auto builders IA | 66% | OX Security |
| CVE-2025-48757 Lovable | 170+ apps | Palmer |
| Incident Replit | 1206+1196 effacés | Fortune 2025 |

---

## 🗂️ FORMAT DE FINDING

```markdown
#### [🔴/🟠/🟡/🟢] Finding #N — [Titre factuel]

- **Fichier(s)** : `path/to/file.ext:42`
- **Preuve** (code actuel, < 10 lignes) :
  ```
  [extrait exact du code problématique]
  ```
- **Description** : [factuel]
- **Impact** : [conséquence si non corrigé]
- **Reproduction** : [comment vérifier]
- **Risque de casse lors de la correction** : 🟢 FAIBLE / 🟡 MOYEN / 🔴 ÉLEVÉ
- **Dépendances à vérifier avant correction** : [fichiers/fonctions impactés]
- **Correction suggérée** : [pseudo-code, sans appliquer]
- **Tests de non-régression nécessaires** : [quoi tester après]
- **Peut casser quoi ?** : [analyse explicite]
- **Référence** : [CWE-X / OWASP / WCAG]
- **Effort** : S / M / L / XL
```

### Structure d'une section

```markdown
## SECTION X — [Nom]

### Indexation factuelle préalable
[métriques chiffrées + liste des non-conformes via règle 24]

### Findings détaillés
[× N]

### Ce qui est correctement fait (NE PAS CASSER)
- Point positif 1 avec preuve

### À VÉRIFIER MANUELLEMENT
- [...]

### Score de confiance : X/10
- Couverture code lu : X%
- Zones d'ambiguïté : [...]

### Risque global de régression si corrections appliquées
🟢 FAIBLE / 🟡 MOYEN / 🔴 ÉLEVÉ
Zones sensibles : [...]
```

---

## 🔁 AUTO-VALIDATION EN FIN DE LAYER

```markdown
## AUTO-VALIDATION LAYER X

### 3 affirmations re-vérifiées
[pour chaque : finding d'origine, citation, re-vérification, verdict ✅/❌/⚠️, action]

### Zones de faible confiance
- [sections < 7/10]

### Métriques Layer X
- Couverture réelle : X%
- 🔴 : X | 🟠 : X | 🟡 : X | 🟢 : X
- Confiance globale : X/10
- Risque régression corrections : FAIBLE/MOYEN/ÉLEVÉ
```

---

## 📁 LIVRABLE FINAL (après les 4 layers)

```markdown
# RAPPORT D'AUDIT — [PROJET]
Date : [YYYY-MM-DD] | CDC v3.2

## SCOREBOARD GLOBAL
| Dimension | Score |
|---|---|
| Sécurité critique (L1) | X/100 |
| Robustesse & perf (L2) | X/100 |
| Qualité / conformité (L3) | X/100 |
| Maintenabilité & évolution (L4) | X/100 |
| **Score global** | **X/100** |

Confiance moyenne : X/10
Risque global régression corrections : FAIBLE/MOYEN/ÉLEVÉ

## CARTOGRAPHIE DU PROJET
[rappel Phase -1]

## TABLEAU PAR SECTION
[24+ sections]

## HEATMAP FICHIERS À RISQUE
[top 10]

## TOP 10 URGENCES
[...]

## ✅ CE QUI EST BIEN FAIT (NE PAS CASSER)
[inventaire explicite des comportements à préserver]

## PLAN DE REMÉDIATION PRIORISÉ
### Sprint 1 — BLOQUANT PROD (🔴)
### Sprint 2 — AVANT CROISSANCE (🟠)
### Sprint 3 — DETTE TECHNIQUE (🟡 + 🟢)
### Sprint 4 — PÉRENNITÉ (L4)

## STRATÉGIE DE MISES À JOUR RECOMMANDÉE
[issue de L4]

## ESTIMATION COÛT MENSUEL
[1000 users actifs + pire scénario]

## EFFORT TOTAL ESTIMÉ
[jours-homme]

## RECOMMANDATIONS STACK / OUTILS
[...]

## MÉTA-RAPPORT
- Couverture : X%
- Zones non auditées : [...]
- Limites : [...]
- Recommandation : audit humain / pentest / rien
```

---

## 🛑 APRÈS L'AUDIT — Transition vers correction

**Le protocole de correction complet est dans `audit-99-correction-protocol.md`.**

Résumé des règles critiques :
1. Aucune correction automatique. Attendre instructions.
2. Une correction à la fois. Jamais de batch.
3. Branche Git par correction : `fix/<layer>-<section>-<N>-<slug>`.
4. Commits atomiques.
5. Tests avant ET après.
6. Chaque fix accompagné d'un test de non-régression.
7. Validation humaine obligatoire avant merge.
8. Rollback plan documenté.
9. Secrets historique Git : procédure signalée, pas exécutée seul.
10. Migrations DB : testées sur copie.

---

## 🎬 DÉMARRAGE D'UNE SESSION

```
📘 CDC vibe coding v3.2 chargé.

Configuration :
- CORE chargé ✅
- Layer : [L1/L2/L3/L4] chargé ✅
- Autres fichiers : non chargés

Confirmations nécessaires :
1. Mode : AUDIT (lecture seule) ? [par défaut oui]
2. Zones exclues ? [lister]
3. Type : pré-production / exploratoire / pérennité ?
4. Commandes lecture seule autorisées (git log, grep, npm audit) ?
5. Rapport(s) du/des layer(s) précédent(s) fourni(s) en contexte ?
6. Je stoppe en fin de layer pour validation ? [O/N]

Règles que je respecterai :
- Aucune modification pendant l'audit
- Preuve explicite obligatoire
- Analyse d'impact (risque casse) pour chaque 🔴/🟠
- Croisement obligatoire des métriques (liste des non-conformes)
- Auto-validation en fin de layer
- Mentalité "first do no harm"

Temps estimé : [X heures].
```

---

## 📚 GLOSSAIRE

- **Phase -1** : indexation brute factuelle préalable
- **Layer** : regroupement de sections (L1=sécu, L2=scaling, L3=qualité, L4=évolution)
- **Finding** : constat avec preuve explicite
- **Score de confiance** : /10
- **Auto-validation** : re-vérification de 3 findings
- **Heatmap** : cartographie fichiers à risque
- **Ghost dependency** : import jamais utilisé (marqueur d'hallucination IA)
- **Scalpel pas hache** : modifier le minimum
- **Protocole 3x** : vérifier 3 fois avant valider
- **First do no harm** : ne pas casser du fonctionnel en corrigeant
- **Croisement de métrique** : lister explicitement les non-conformes, pas juste un pourcentage
- **Bottleneck** : goulot d'étranglement identifié avec preuve

---

## 📎 ANNEXES

### A. Sources stats
Veracode, CSA 2025, Beesoul, Escape.tech, Ranger AI Code Bugs, OX Security, CVE-2025-48757, Fortune/Register (Replit), ACM SIGACCESS, CWE Top 25, OWASP Top 10, WCAG 2.2

### B. Commandes lecture seule
```bash
git log -p --all | grep -iE "sk_[a-z]*_|api[_-]?key|secret|password|token|bearer" | head -100
git log --all --full-history -- "**/.env*"
npm audit --json > npm-audit.json
pip-audit --format json > pip-audit.json
npx depcheck
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.py" \) | wc -l
```

---

**Fin CORE — v3.2 DÉFINITIVE**
