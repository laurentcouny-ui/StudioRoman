# Checklist — Brique 5 : Le Correcteur de la Mort

Document de validation par rapport à [`CDC-BRIQUE-5.md`](./CDC-BRIQUE-5.md).

**Légende** : `[ ]` non fait · `[x]` validé · `[~]` partiel

**Objectif** : **76 critères** (une ligne = un critère) + **test final** passé.

---

## Affichage & densité (1–10)

- [ ] Mode Simple : **texte + icône plume + bouton Analyser** uniquement
- [ ] Mode Simple Strict : **zéro** signal visuel avant « Analyser »
- [ ] Limiteur : **max 1** micro-point gris / phrase
- [ ] Limiteur : **max 3** micro-points gris / paragraphe
- [ ] Fusion des incertitudes proches en **un** seul point
- [ ] Soulignement **net** pour **98–100 %**
- [ ] Micro-point **90–97 %** (Simple gris / Expert pointillé selon CDC)
- [ ] **Rien** affiché pour **&lt; 90 %** en Simple ; ombre Expert sans message
- [ ] Couche d’ombre Expert **sans** injection de correction
- [ ] Règle d’interface : Mode Simple — **aucun** élément non demandé

---

## Moteurs & infra (11–25)

- [ ] LanguageTool **local** ; **zéro** appel réseau
- [ ] LanguageTool : performance cible **~50 ms** / paragraphe
- [ ] Base maison : données et règles dans `src/corrector/database/`
- [ ] Filtre de **modernité** ; rectifications **1990** systématiques
- [ ] Option projet **« Respecter l’Archaïsme »** (comportement inversé documenté)
- [ ] IA arbitre : appel **uniquement** pour **90–97 %**
- [ ] « **Voir une piste** » **jamais** visible par défaut
- [ ] Clés API premium : **Keychain Windows** (desktop) / **AES** (web)
- [ ] CamemBERT ONNX via **ContextualEngine** + **Worker** dédié
- [ ] Analyse CamemBERT : **à la demande** uniquement (pas TR continu)
- [ ] Timeout **5 s** → fallback **LanguageTool**
- [ ] Latence saisie : **&lt; 16 ms** garantie (worker isolé du thread principal)
- [ ] Batch max **2000 mots** (ou équivalent documenté)
- [ ] Smart throttling : **éco** = fin de paragraphe **sans** baisser la qualité d’analyse
- [ ] Smart throttling : retour au fonctionnement habituel après **30 s** stables (CPU / batterie)

---

## WAL & consensus (26–31)

- [ ] Respect **WAL** Brique 2 + écriture via **storageAdapter**
- [ ] Autosave dirty bit **5 s** ; heartbeat sur **suspension**
- [ ] Mécanique pure → **LanguageTool** seul à 100 %
- [ ] Cas standard → LT **et** base d’accord **≥ 98 %**
- [ ] Ambigus 90–97 % → **arbitrage** ; pas de correction auto directe IA
- [ ] &lt; 90 % → silence Simple / ombre Expert

---

## Temps réel & fantôme (32–42)

- [ ] Temps réel : **LanguageTool seul** ; délai de grâce (**aucun** signal pendant frappe active ; après inactivité **X** ou paragraphe) avec **X** configurable
- [ ] Correction silencieuse : doubles espaces
- [ ] Correction silencieuse : majuscules après point
- [ ] Correction silencieuse : espaces insécables (! ? : ;)
- [ ] Correction silencieuse : guillemets français **et** tirets cadratins
- [ ] Correction silencieuse : `...` → `…`
- [ ] Correction silencieuse : apostrophes typographiques
- [ ] Correction silencieuse : espaces fin de ligne
- [ ] Correction silencieuse : nombres (ex. 20000 → 20 000)
- [ ] Fantôme : condition **dictionnaire** + **CamemBERT &gt; 99 %** + **hors Bible** + **zone phonétique**
- [ ] Fantôme rejeté → **jamais** réappliqué automatiquement

---

## Journal & temporalité (43–50)

- [ ] **SilentJournal** : icône plume discrète, **FIFO 100**
- [ ] Journal : **« Tout valider sauf… »** par catégorie
- [ ] **Badge de session** dans le Journal
- [ ] **Rétablir ce paragraphe** + micro-bulle Indignation
- [ ] Indignation **Style** → **Mémoire d’Intention** ; **Erreur** → conserve / apprentissage moteur
- [ ] Ligne temporelle : signal **sauf** si connecteur temporel (suspension 3 phrases)
- [ ] Flashbacks / analepses **jamais** signalés comme fautes
- [ ] Bible : soulignement **violet** (sauf Simple Strict) pour cohérence

---

## Analyse à la demande & style (51–60)

- [ ] Périmètre : **chapitre actif** uniquement
- [ ] Pipeline **streaming** blocs **3–5 phrases**
- [ ] Messages de **progression** affichés pendant l’analyse
- [ ] Détection narration / dialogue / pensée / SIL / hybride
- [ ] Si **incertitude** de détection → **aucun** changement de seuil
- [ ] Filtre point de vue : liberté stylistique **avec** confirmation uniquement
- [ ] Phrases sans verbe : **silence** Simple ; « Style : Rythme haché » Expert
- [ ] Style expérimental : **silence** Simple ; « Style : Expérimental » Expert informatif
- [ ] Mode Inspection (Expert) : **aucune** correction injectée
- [ ] Lecture littéraire (Expert) : **jamais** erreur / jamais bloquant

---

## Bible, dictionnaire, mémoire, certificat (61–70)

- [ ] BibleSync : injection auto noms ; **jamais** faute sur noms Bible
- [ ] Deux orthographes d’un terme Bible → **violet** + message
- [ ] Renommage Bible → scan silencieux + notif **Journal** (pas popup)
- [ ] PersonalDictionary : nom propre / commun / radical (≥ 5, pas collision)
- [ ] IntentionMemory : « C’est mon style » / ignores / Indignation
- [ ] Règles stockées **projet** ; UI **Mon profil de style**
- [ ] Indicateur « Règle mémorisée » **Expert** uniquement
- [ ] Statistique de liberté (certificat + mémoire)
- [ ] Mode **Confiance absolue** : LT + base **100 %** uniquement
- [ ] Certificat : **message légal obligatoire** + liste couverts / non couverts

---

## UI, onboarding, guide (71–76)

- [ ] Chaque suggestion : Corriger / Ignorer / C’est mon style / Voir une piste / Pourquoi ? / Signaler
- [ ] Pourquoi ? : niveaux **Mentor** et **Expert** (+ sources Expert)
- [ ] Score : fautes **certaines** ; si &lt; 50 % → libellé **« Inférieur à 50 % »**
- [ ] Mode Focus + navigation **flèches** + analyse **par chapitre**
- [ ] Onboarding **9 étapes** — **première ouverture** ; reprise menu Guide
- [ ] Guide : **7 sections** obligatoires + tuto clés API (captures)

---

## Test final obligatoire (hors les 76 — passage / échec)

- [ ] Extrait *La Horde du Contrevent* — **Mode Simple** : **silence total**
- [ ] Même extrait — **Mode Expert** : **« Style : Expérimental »** ; **aucune** correction de style
- [ ] **Cohérence Bible** vérifiée dans **les deux** modes

---

## Clôture

Lorsque les **76** critères ci-dessus sont `[x]` **et** le **test final** est passé :

> **BRIQUE 5 TERMINÉE — 76 critères validés. TEST FINAL PASSÉ.**
