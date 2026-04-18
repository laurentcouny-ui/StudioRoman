# Scriptor Desktop V2 — Brique 5 : Le Correcteur de la Mort

**Document complet** : CDC + instructions d’implémentation séquencées.  
**Prérequis** : Briques 1, 2, 3, 4 terminées — voir [`CDC-BRIQUE-4.md`](./CDC-BRIQUE-4.md).  
**Validation** : [`CDC-BRIQUE-5-CHECKLIST.md`](./CDC-BRIQUE-5-CHECKLIST.md) (**76 critères** + test final obligatoire).

---

## Instructions de travail (implémentation)

La Brique 5 est divisée en **4 séquences**. Implémenter chaque séquence **jusqu’au bout** avant la suivante. Ne pas s’arrêter en milieu de séquence.

À la fin de chaque séquence, annoncer : **« SÉQUENCE [N] TERMINÉE — prêt pour la suivante. »**

| Séquence | Contenu |
|----------|---------|
| **1** | Infrastructure (triple moteur, base de données, WAL) |
| **2** | Modes d’affichage, correcteur temps réel, Journal des Silencieuses |
| **3** | Analyse à la demande, détection style, Bible, Mémoire d’Intention |
| **4** | UI complète, onboarding, guide, certificat, test final |

---

## Philosophie fondamentale

- Le correcteur corrige les **fautes objectives**. Il **n’écrit jamais** à la place de l’auteur.
- Il **encourage**, il ne décourage pas. Il **protège le flow créatif**.
- Il **préfère le silence au doute**. Il **apprend le style** de l’auteur.
- **Mieux vaut ne rien dire que dire faux.**

> **Antidote est un juge généraliste. Scriptor est le co-pilote qui a lu ton livre.**

---

## Règle d’interface absolue

L’auteur en **Mode Simple** ne voit **jamais** quelque chose qu’il n’a pas demandé.

Avant tout ajout d’interface : *« Est-ce que l’auteur en Mode Simple voit quelque chose de nouveau ? »*  
Si oui → **couche cachée**, options avancées, **jamais** l’interface principale.

---

## Niveaux de certitude (règle dure)

| Plage | Mode Simple / commun | Ton |
|-------|----------------------|-----|
| **98–100 %** | Soulignement **net** | « Erreur détectée. » |
| **90–97 %** | Micro-point gris **limité** (Simple) / pointillé (Expert) | « À vérifier — est-ce volontaire ? » |
| **&lt; 90 %** | **Rien** (Simple) / couche d’ombre sans message (Expert) | — |
| **Style** | **Rien** (Simple) / « Style : [type] » (Expert) | — |
| **Bible** | Soulignement **violet** discret (sauf Mode Simple Strict) | — |

**Limiteur de densité (obligatoire)**  
- Max **1** micro-point gris **par phrase**  
- Max **3** micro-points gris **par paragraphe**  
- Si plusieurs incertitudes proches → **fusion** en un seul point  
- Priorisation : **grammaire &gt; ponctuation &gt; style potentiel**

---

# Séquence 1 — Infrastructure

## 1. Moteur 1 — LanguageTool (local)

- Intégrer **LanguageTool** open source, **entièrement sur la machine** via Tauri (**zéro appel réseau**).
- Rôle : corrections mécaniques et règles grammaticales strictes.
- Vitesse cible : **~50 ms** par paragraphe.
- Zéro coût, zéro compte.

## 2. Moteur 2 — Base de données maison (local)

- Arborescence : `src/corrector/database/` (voir sources domaine public / licences dans [`README_SOURCES.md`](../src/corrector/database/README_SOURCES.md) si présent).

Sources visées (domaine public / licences compatibles) :

- Grammaire Brachet & Dussouchet (1901)  
- Dictionnaire Académie française 5e éd. (1798)  
- Dictionnaire abrégé Académie (Verger)  
- Bally — stylistique ; Fontanier — tropes  
- Lexique 4.0 (lexique.org, GPL)  
- LVF (Dubois) — conjugaison JSON  
- Dicollecte — orthographe libre  

**Filtre de modernité** : conflit ancien / moderne → **règle moderne** gagne pour la correction ; l’ancienne peut apparaître dans « Pourquoi ? / Note stylistique ». Rectifications **1990** appliquées systématiquement.

**Option « Respecter l’Archaïsme »** (par projet) : fantasy, historique, classique — puise 1798 / Brachet ; **l’ancienne prime**, la moderne en note (inverse du défaut).

## 3. Moteur 3 — IA arbitre (90–97 % uniquement)

- Appelée **uniquement** pour **90–97 %** de confiance.
- **Jamais** de correction directe — **piste** sur demande (« Voir une piste »), **jamais** visible par défaut.

Premium optionnel (clé API personnelle) : **Claude**, **Gemini**, **ChatGPT** — explication, arbitrage, piste non engageante ; **jamais** correction auto.

**Clés API** : Desktop (`isDesktop()`) → **Keychain Windows** ; Web → **AES** chiffré local.

## 4. Moteur contextuel — CamemBERT ONNX (`ContextualEngine.js`)

- Modèle **CamemBERT ONNX** via **Transformers.js / Xenova** ; JS natif (Tauri + navigateur).
- **Analyse à la demande uniquement** (pas de temps réel continu sur ce moteur).
- **Web Worker dédié obligatoire** — jamais sur le thread principal.

**Performances** : latence de frappe **&lt; 16 ms** garantie côté UI (worker isolé) ; batch max **2000 mots** ; **timeout 5 s** → **fallback LanguageTool** ; mémoire de travail = entités explicites ; si doute → **silence absolu**.

**Smart throttling** : si CPU **&gt; 70 %** pendant **3 s** **ou** batterie **&lt; 20 %** → ne pas dégrader la qualité ; passer en **« fin de paragraphe uniquement »** ; message transparent : *« Mode économie d’énergie : analyse à la fin de chaque paragraphe. »* ; retour normal après **30 s** stables.

## 5. Règle du consensus multi-moteurs

- Mécanique pure → LanguageTool seul à 100 %.  
- Contexte fort → base maison seule si **≥ 98 %**.  
- Cas standard → LanguageTool **et** base d’accord **≥ 98 %**.  
- Ambigus (90–97 %) → arbitrage IA, piste sur demande.  
- **&lt; 90 %** → ombre (Expert) ou rien (Simple).

## 6. WAL + dirty bit

- Respect du **WAL** Brique 2 ; corrections acceptées via **`storageAdapter`**.  
- Autosave dirty bit **toutes les 5 s** ; heartbeat save sur **suspension** système.

---

# Séquence 2 — Modes et correcteur temps réel

## A. Les trois modes

- **Mode Simple (défaut)** : texte + **icône plume** discrète en bas + bouton **« Analyser »** — **c’est tout**.  
- **Mode Simple Strict** : **zéro** signal visuel avant **« Analyser »** (aucun micro-point, violet, icône active).  
- **Mode Expert** : tout activé — ombre &lt; 90 %, « Style : », inspection, lecture littéraire assistée, mémoire de style visible, niveaux de confiance.

## B. Correcteur temps réel — Mode 1

- **LanguageTool uniquement** en temps réel.
- **Délai de grâce** : pas de signal pendant frappe active ; après **X s** d’inactivité ou changement de paragraphe ; **X** réglable.

**Corrections automatiques silencieuses** (liste du CDC : doubles espaces, maj après point, insécables, guillemets, tirets, suspension, apostrophes, fin de ligne, nombres, etc.) — **jamais** de popup ni signal.

**Mode Fantôme — homophones** : états `pending` → `auto_applied` / `reverted`. **Les 4 conditions** sont **toutes** obligatoires :

1. Mot dans dictionnaire français de base  
2. CamemBERT **&gt; 99 %**  
3. Mot **absent** de la Bible du projet  
4. **Zone de sécurité phonétique** : si ressemblance phonétique avec un terme Bible → fantôme **désactivé** ; **l’univers prime**.

Correction fantôme rejetée → **jamais** réappliquée automatiquement.

## C. Journal des Silencieuses (`SilentJournal.js`)

- Icône plume en bas (Mode Simple) ; max **100** entrées FIFO ; catégories ; filtres « Voir tout » / « Corrections critiques ».  
- **« Tout valider sauf… »** — granularité par catégorie.  
- **« Rétablir ce paragraphe »** en marge.  
- **Règle de l’Indignation** : micro-bulle « Erreur ou style ? » → **Style** alimente **Mémoire d’Intention** ; **Erreur** conserve correction et améliore le moteur.  
- **Badge de session** dans le Journal.

## D. Soulignement progressif + ligne temporelle

- Cf. tableau niveaux de certitude + Bible violette.  
- **Connecteurs temporels** (« Jadis », « Plus tard », …) → **suspension** de la règle de rupture pour **3 phrases** ; flashbacks / analepses **jamais** signalés comme erreurs.

---

# Séquence 3 — Analyse, style, Bible, mémoire

## A. Analyse à la demande — Mode 2

- Moteurs : LanguageTool + base + CamemBERT (+ IA premium si connectée).  
- Périmètre : **chapitre actif** uniquement.  
- Pipeline **streaming** : blocs **3–5 phrases** ; progression affichée (messages du CDC).

## B. Détection / classification du style (CamemBERT)

- Narration / dialogue / pensée / style indirect libre / hybride ; si incertitude → **aucun** changement de seuil.  
- Seuils adaptatifs (dialogue plus permissif, etc.) ; **fallback** manuel « Forcer dialogue / narration ».  
- **Filtre point de vue** : liberté stylistique **jamais** sans confirmation.  
- **Rythme séquentiel** : suite de phrases courtes sans verbe → silence Simple ; Expert « Style : Rythme haché » — **pas** une faute.  
- **Répétitions intelligentes** : fenêtres 50 / 100 mots, mots rares, anaphore → Style en Expert, silence en Simple.  
- **Mode Inspection** (Expert) : carte thermique, **aucune** correction injectée.  
- **Lecture littéraire assistée** (Expert) : Fontanier / Bally — signal **sans** corriger ; invisible en Simple.

## C. Bible (`BibleSync.js`)

- Injection auto personnages / lieux ; majuscules ; jamais fautes.  
- **Cohérence nominale** : deux orthographes → violet + message.  
- **Zone sécurité phonétique** (cf. Séquence 2).  
- **Renommage** Bible → scan silencieux + notification discrète dans le Journal.

## D. Dictionnaire personnel (`PersonalDictionary.js`)

- Isolé par projet ; alimenté par la Bible.  
- Types : nom propre ; nom commun ; **radical (≥ 5 caractères, pas de collision)** — déclinaisons projet uniquement.

## E. Mémoire d’Intention (`IntentionMemory.js`)

- Déclencheurs : « C’est mon style » ; ignores répétés ; « Style » à l’Indignation.  
- Stockage **fichier projet** (Brique 2) ; UI **« Mon profil de style »** ; supprimable.  
- Indicateur « Règle mémorisée » **Expert uniquement**.  
- **Statistique de liberté** (certificat).  
- **UX adaptative** ; désactivation règle si &gt; 80 % ignore + &gt; 1000 occurrences + validation ; bouton **« Signaler une erreur non détectée »**.

## F. Mode Confiance absolue + certificat

- LT + base à **100 %** uniquement ; pas d’arbitre IA.  
- **Certificat de Propreté Mécanique** avec message **obligatoire** de limitation (cf. CDC) + statistique de liberté.

---

# Séquence 4 — UI, onboarding, guide, test final

## A. Boutons par suggestion

**Corriger** | **Ignorer** | **C’est mon style** (micro-bulle portée livre / dialogues + intention) | **Voir une piste** (90–97 %, **sur demande** uniquement) | **Pourquoi ?** (Mentor / Expert + sources) | **Signaler une erreur non détectée**

## B. Quatre mécaniques d’analyse

1. Une faute à la fois — flèches gauche/droite  
2. **Score** sur fautes **certaines** uniquement ; si &lt; 50 % → afficher « Inférieur à 50 % »  
3. **Par chapitre** uniquement  
4. **Mode Focus** : Grammaire / Orthographe / Ponctuation / Répétitions / Tout

## C. Onboarding — 9 étapes

À la **première ouverture** uniquement ; rejouable depuis le menu **Guide**. Visite **interactive** sur l’UI réelle (pas slides statiques). Étapes 1–9 conformes au CDC (modes, délai de grâce, soulignements, promesse, Journal, premium optionnel, analyse profonde, Bible, mémoire). Fin : **« C’est parti — commençons à écrire »**.

## D. Guide intégré — onglet **Guide** existant

**7 sections obligatoires** : (1) Comprendre le correcteur (2) Personnaliser (3) Bible (4) Analyse profonde (5) IA premium + tuto clés (6) Mode Expert (7) FAQ.

## E. Test final obligatoire

**Page de référence** : extrait de *La Horde du Contrevent* (A. Damasio), style expérimental.

- **Mode Simple** : **aucun** soulignement ni signal.  
- **Mode Expert** : **« Style : Expérimental »**, informatif uniquement, **aucune** correction de style.  
- **Les deux** : cohérence des noms avec la **Bible** du projet.

Si échec → revoir seuils et règles de style.

**Phrase de clôture implémentation** (quand tout est validé) :

> **BRIQUE 5 TERMINÉE — 76 critères validés. TEST FINAL PASSÉ.**

---

## Architecture des composants (référence)

| Composant | Fichier / dossier | Rôle |
|-----------|-------------------|------|
| Triple moteur | `src/corrector/engines/` | LanguageTool + base maison + IA arbitre |
| Contextuel | `src/corrector/ContextualEngine.js` | CamemBERT, Web Worker |
| Journal | `src/corrector/SilentJournal.js` | Silencieuses + Indignation |
| Bible | `src/corrector/BibleSync.js` | Sync personnages / lieux |
| Dictionnaire perso | `src/corrector/PersonalDictionary.js` | Vocabulaire projet |
| Mémoire d’intention | `src/corrector/IntentionMemory.js` | Style appris |

---

## Hors périmètre Brique 5

- Analyse stylistique **complète** « roman entier » → **IA Scriptor** (autre périmètre)  
- Cohérence narrative **globale** → **IA Scriptor**  
- **Suggestion de réécriture** → **jamais**  
- Correction auto des **accords complexes** → **signal** uniquement  

---

## Prompts Cursor (séquences 1–4)

Les blocs *copier-coller* détaillés pour Cursor reprennent le même ordre que ci-dessus ; pour l’implémentation, **ce fichier CDC fait foi**. Les prompts longs peuvent être recollés depuis l’historique de spécification ou régénérés à partir des sections 1–4.

---

*Document : Brique 5 — Le Correcteur de la Mort. Dernière intégration : CDC complet dans le dépôt.*
