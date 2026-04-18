# Tests du correcteur — Brique 5 (référence à jour)

Ce document **complète** le cahier `CDC-BRIQUE-5.md` : comportement réel du code, procédure de validation manuelle, et écart par rapport aux tableaux de test initiaux.

## Prérequis

- LanguageTool **local** joignable sur `http://127.0.0.1:8010` (voir `npm run lt:server` dans le projet).
- Pour les cas Bible : noms / lieux présents dans les **fiches personnages**, entrées **Bible** (titres) et **lieux** (carte), comme en production.

## Comportements implémentés (résumé)

| Mécanisme | Rôle |
|------------|------|
| `findNominalCoherenceIssues` | Deux graphies **distinctes dans le même texte** pour une même clé phonétique Bible → alertes violettes (tous les tokens concernés). |
| `findBibleCanonOrthographyIssues` | Une seule graphie dans le texte, **différente** des entrées Bible enregistrées (même famille phonétique) → alerte violette. |
| `inferExperimentalStyle` | Heuristique « prose fragmentée / dense » (longueur + ratio de phrases courtes, ou passage court très découpé). |
| **Masquage mécanique** | Si style expérimental **et** (`inferChoppedRhythm` **ou** `inferAnaphoraStyle`), le rapport d’analyse **ne liste plus** les alertes hors Bible ; champ `experimentalStyleMute: true`. |
| Hints Expert | `Expérimental`, `Rythme haché`, `Anaphore`, `Ellipse` — informatifs, pas des corrections imposées. |

## Texte 1 — Sans fautes

| Attente produit | Détail |
|-----------------|--------|
| Après **Analyser**, peu ou pas d’alertes | Dépend de **LanguageTool** (faux positifs possibles). En **Mode Simple**, le surlignage masque les alertes &lt; 0,9 (sauf Bible). |
| Noms Bible | Doivent être dans le projet ; sinon LT peut proposer une « correction » sur un nom propre. |

**Validation :** coller le texte dans une scène, lancer **Analyser**, vérifier l’absence de bruit inacceptable.

## Texte 2 — Fautes volontaires

| Zone | Comportement code |
|------|-------------------|
| Accents Bible (`Seides` vs `Séides`, `Ethriel` vs `Éthriel`) | **Violet** via `findBibleCanonOrthographyIssues` si la forme canon est dans la Bible du projet. |
| Tiret `-` / double espace / majuscule après point | Traités par le flux **correcteur silencieux** (grâce / paragraphe) **et** peuvent apparaître dans le **rapport LT** selon les règles — les deux canaux sont distincts. |
| Niveau « CERTAIN 98 %+ » | Les **confidences** viennent du pipeline LT + consensus ; elles ne sont pas figées à 98 % pour chaque ligne sans mesure sur votre LT. |

**Validation :** vérifier la **liste** des alertes et les **violet Bible** avec une Bible de test remplie (voir prérequis).

## Texte 3 — Style expérimental (Damasiennes)

| Mode | Attente |
|------|---------|
| Simple | Pas de surlignement **&lt; 0,9** ; après analyse, si `experimentalStyleMute`, **aucune** alerte mécanique dans le rapport (sauf Bible si conflit). |
| Expert | Hints **Expérimental**, **Rythme haché**, **Anaphore**, **Ellipse** selon heuristiques ; **pas** de correction imposée par ces hints. |

Si le masquage expérimental ne s’active pas (texte trop « lisse » pour les seuils), LT peut encore remonter des alertes : ajuster le passage ou les heuristiques dans `sequence3Analyzer.js`.

## Tableau récapitulatif (révisé)

| Texte | Résultat attendu côté produit |
|-------|------------------------------|
| 1 propre | Idéalement silence ; sinon vérifier faux positifs LT et dictionnaires. |
| 2 fautes | Détection des erreurs **grammariales / orthographiques** attendues + **violet Bible** si Bible renseignée ; silencieux pour typo « micro » selon réglages. |
| 3 Damasio | Hints Expert informatifs ; **pas** d’erreurs mécaniques listées lorsque `experimentalStyleMute` est actif. |

**La brique est considérée comme validée** lorsque ces trois scénarios sont vérifiés **dans l’application** avec votre LT local et une Bible de test cohérente — pas seulement par lecture du code.

## Phrase de clôture (inchangée)

> **BRIQUE 5 TERMINÉE — 76 critères validés. TEST FINAL PASSÉ.**

À utiliser lorsque la validation manuelle ci-dessus et la checklist projet sont bouclées.
