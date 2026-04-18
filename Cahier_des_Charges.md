SCRIPTOR IA
Cahier des charges — Module Intelligence Artificielle
Version 1.0 — Issu de la session de brainstorming

Sommaire
1.  Vision produit
2.  Principe fondateur
3.  Philosophie de l'IA
4.  Contraintes dures
5.  Architecture technique
6.  Moteur LLM — stratégie multi-provider
7.  Les quatre déclencheurs valides
8.  Modules fonctionnels
9.  Fiche de reprise automatique
10. Analyse narrative
11. Défis et contraintes lexicales
12. Liste de priorités — 24 tâches ordonnées
13. Ce qui a été explicitement exclu
 
1. Vision produit
Scriptor et son IA sont devenus la référence absolue des outils pour écrivains.

–	L'IA est un assistant qui connaît l'univers de l'auteur sur le bout des doigts.
–	Elle ne parle que quand on lui demande.
–	Elle cite ses sources quand c'est factuel.
–	Elle pose des questions plutôt qu'elle n'écrit quand c'est créatif.
–	Le logiciel doit être absolument facile à maintenir dans le temps.


2. Principe fondateur
Rien ne s'exécute pendant que l'auteur écrit. L'éditeur est sacré.

Ce principe s'applique à chaque ligne de code du projet, sans exception.

Jamais pendant l'écriture
•	Détection de personnages dans la scène
•	Appels LLM automatiques de toute nature
•	Analyse de rythme ou de style
•	Vérification de cohérence
•	Indexation ou mise à jour de la bible
•	Calcul fréquentiel des mots

Toujours sur un déclencheur explicite
•	Sauvegarde manuelle — Ctrl+S
•	Fin de scène marquée manuellement par l'auteur
•	Ouverture du panneau IA par l'auteur
•	Bouton dédié actionné explicitement

3. Philosophie de l'IA
Ce que l'IA fait
•	Elle pose des questions pour relancer l'auteur face au syndrome de la page blanche
•	Elle cite ses sources à chaque réponse factuelle — nom de la fiche, section, numéro de paragraphe
•	Elle propose, suggère, interroge
•	Elle s'adapte au ton choisi par l'auteur : co-auteur, éditeur ou lecteur curieux
•	Elle apprend progressivement l'univers au fil des sessions

Ce que l'IA ne fait jamais
•	Elle ne rédige pas à la place de l'auteur
•	Elle ne s'active jamais seule pendant l'écriture
•	Elle n'invente aucune information sur l'univers — si l'élément est absent de la bible, elle le dit
•	Elle ne mélange jamais une réponse factuelle avec une suggestion créative
•	Elle n'expose jamais les notions techniques (LLM, token, provider) à l'auteur

4. Contraintes dures — zéro compromis
–	Zéro hallucination sur les requêtes bible / personnage / carte — réponse issue des fichiers ou silence.
–	Si l'élément n'existe pas dans la source demandée, l'IA le dit clairement sans déduire ni inventer.
–	Les clés API ne quittent jamais la machine de l'auteur — chiffrement AES-256 obligatoire.
–	Tous les appels LLM tournent sur un thread séparé — jamais sur le thread UI.
–	La fenêtre de contexte est limitée — jamais toute la bible envoyée d'un coup.
–	L'IA ne s'active jamais seule — toujours à la demande explicite de l'auteur.


5. Architecture technique
Couches
•	Couche UI — React / Vite : affichage uniquement, zéro logique métier, versionnée indépendamment
•	API Java — services métier : orchestration, validation, cohérence. Aucun appel LLM direct dans cette couche
•	Modules indépendants : chaque module est remplaçable sans toucher aux autres
•	Fichiers de configuration : prompts.yml, providers.yml, style-profiles.json, map-data.json — jamais dans le code
•	Connecteurs LLM : chacun implémente LLMProvider, ajout sans modifier le reste

Modules indépendants
•	Module IA — interface LLMProvider seule
•	Module bible — index JSON, lecture seule
•	Module personnages — fiches JSON, détection en fin de scène
•	Module carte — map-data.json, cohérence géographique
•	Module défis — générateur de contraintes narratives

Règles de maintenabilité
•	Tout ce qui change souvent vit hors du code — fichiers .yml et .json éditables sans recompilation
•	Ajouter un nouveau LLM = écrire une seule classe Java qui implémente LLMProvider
•	Chaque module est testable indépendamment des autres
•	L'interface React ne connaît que ce que l'API Java lui expose

6. Moteur LLM — stratégie multi-provider
Modèle par défaut — gratuit
•	Ollama local : Mistral 7B ou Llama 3.2 3B selon la RAM disponible
•	Tourne en local, zéro frais, zéro données envoyées à l'extérieur
•	Démarre en daemon au lancement de Scriptor, s'arrête avec lui
•	Si Ollama est absent : dégradation gracieuse avec message clair, jamais de crash silencieux

Providers premium connectables par l'auteur
•	OpenAI — GPT-4o, GPT-4.1 — clé API fournie par l'auteur
•	Anthropic — Claude Sonnet / Opus — clé API fournie par l'auteur
•	Google — Gemini 2.0 / 2.5 — clé API fournie par l'auteur

Interface LLMProvider — Java
Chaque provider implémente une interface unique :
String getName() | boolean isAvailable() | String complete(prompt) | void stream(prompt, onToken, onDone)

Paramètres utilisateur
•	Sélection du provider actif — radio button simple
•	Saisie des clés API par provider — masquées, stockées en AES-256 local
•	Bouton 'Tester la connexion' — ping minimal pour valider la clé
•	Estimation du coût visible pour les providers payants
•	Option mode hors-ligne total — force Ollama uniquement, bloque tout trafic réseau

7. Les quatre déclencheurs valides
Tout traitement de l'IA ou d'analyse du texte ne peut être déclenché que par l'un de ces quatre événements.

–	Sauvegarde manuelle — Ctrl+S ou bouton dédié
–	Fin de scène — marquage explicite par l'auteur
–	Ouverture du panneau IA — action volontaire
–	Bouton explicite de l'auteur — demande directe


8. Modules fonctionnels
8.1 Syndrome de la page blanche — priorité absolue
C'est le besoin n°1 identifié en interview. Toute la philosophie du module y est concentrée.
•	L'IA analyse les dernières lignes, la chronologie et la bible pour diagnostiquer le contexte
•	Elle propose 2-3 questions ciblées pour relancer l'auteur — jamais de rédaction à sa place
•	Le ton des questions est sélectionnable : co-auteur / éditeur / lecteur curieux
•	Le sélecteur de ton est accessible directement dans le panneau IA, pas dans les préférences

8.2 Requêtes sur la bible, les personnages et la carte
•	Mode anti-hallucination strict : réponse issue des fichiers uniquement
•	Chaque réponse affiche sa source exacte : nom de la fiche, section, numéro de paragraphe
•	Si l'élément est absent de la source demandée : message clair 'introuvable', zéro déduction
•	Trois sources interrogeables séparément : bible, fiches personnages, carte (map-data.json)

8.3 Annotations en temps réel
•	Déclenchement : sélection de texte par l'auteur
•	Trois tags disponibles : 'pas satisfait' / 'à développer' / 'idée ici'
•	Visualisation : underline discret coloré selon le tag — aucun panneau supplémentaire
•	Stockage : objet JSON minuscule {début, fin, tag, timestamp} dans un fichier local
•	Injection automatique : les annotations sont transmises en contexte au prochain appel IA
•	Double rôle : outil d'expression pendant l'écriture + signal de reprise après une pause

8.4 Module géographique
•	Éditeur de données associé à la carte visuelle (JPEG ou Inkarnate)
•	Saisie des lieux, distances, modes de déplacement et temps de trajet selon l'univers
•	Stockage dans map-data.json — format structuré, éditable manuellement
•	Vérificateur de cohérence : détecte les trajets impossibles et contradictions temporelles
•	Toute vérification se fait à la demande — jamais pendant l'écriture

8.5 Apprentissage progressif
•	Pas d'onboarding obligatoire — l'IA commence sans contexte et apprend au fil des sessions
•	Le comportement lui-même indique la progression : au début l'IA pose plus de questions générales, puis de plus en plus précises
•	Aucun indicateur de progression visible — c'est la qualité des réponses qui le trahit

9. Fiche de reprise automatique
Affichée automatiquement à la réouverture du projet si la dernière session date de plus de 24 heures.

Cinq blocs — pas un de plus
•	Dernières lignes écrites : les 3 dernières phrases de la session précédente
•	Personnage actif : nom + état émotionnel détecté — ex. 'Aldric · sous tension · isolé'
•	Prochaine étape : toggle Chronologie / Bible — une seule ligne, source affichée
•	Annotations ouvertes : toutes les annotations laissées en suspens avant la pause
•	Question de l'IA : une seule question dans le ton choisi par l'auteur pour relancer

Sélecteur de ton intégré
•	Co-auteur : question intime, liée à l'état émotionnel du personnage
•	Éditeur : question structurelle, liée à l'enjeu dramatique du chapitre
•	Lecteur curieux : question naïve, liée à ce qui donne envie de lire la suite

10. Analyse narrative — à la demande uniquement
–	L'IA analyse, visualise et suggère. Elle ne modifie jamais le texte directement.
–	Toute action de restructuration reste une proposition que l'auteur accepte explicitement.

Courbe des scènes d'action
•	Répartition des pics d'action sur l'ensemble du tome
•	Identifie les déserts narratifs et les surcharges

Longueur des scènes
•	Scène trop longue → suggestion de découpe en deux chapitres
•	Scène trop courte → suggestion de fusion avec la suivante
•	L'auteur accepte ou ignore — aucune modification automatique

Changements de POV
•	Détection et cartographie de chaque switch de point de vue
•	Alerte sur les concentrations inhabituelles

Résumé de chapitre automatique
•	Généré à la sauvegarde, dans le style d'une fiche de bible
•	Proposition d'intégration dans la documentation — acceptation manuelle

Bilan de fin de tome
•	Déclenché manuellement par l'auteur
•	Session de questions générées par l'IA : voix narrative, arcs, incohérences restantes
•	Détection des personnages absents depuis X chapitres

11. Défis et contraintes lexicales
Pas de points, pas de badges, pas de streaks. Chaque défi vient de l'univers lui-même.

Quatre types de défis générés depuis la bible
•	Personnage oublié : un personnage absent depuis N chapitres — 15-20 minutes de scène solo
•	Lacune de bible : un lieu, une règle ou un lien non documenté — invitation à le créer
•	Contrainte stylistique : écris cette scène sans adverbes, depuis les sensations uniquement, etc.
•	Défi express : 5 à 10 minutes, une seule image forte, la première phrase du prochain chapitre

Contraintes lexicales
•	Mots interdits : détection automatique des mots surutilisés avec leur fréquence
•	Mots imposés : suggestion de mots du lexique de l'univers absents du chapitre actuel
•	Contraintes personnalisées : l'auteur crée ses propres interdictions ou impositions
Règle : La contrainte n'est jamais punitive. Elle est toujours au service de la voix de l'auteur.

 
12. Liste de priorités — 24 tâches ordonnées
À réaliser dans l'ordre de phase. Au sein de chaque phase, les tâches sont indépendantes.

Phase 1 — Socle  Ce qui doit exister avant tout le reste
Sans ça, rien d'autre ne tient
□	Interface LLMProvider — architecture modulaire
L'interface Java unique que tous les connecteurs LLM implémentent.	Java 
□	Connecteur Ollama local — modèle par défaut
Mistral 7B ou Llama 3. Dégradation gracieuse si absent.	Java LLM 
□	Thread séparé pour tous les appels LLM
Zéro appel LLM sur le thread UI. L'éditeur ne freeze jamais.	Java 
□	Chiffrement des clés API — AES-256
Clés jamais en clair. Ne quittent jamais la machine.	Java 
□	Limite de contexte — fenêtre glissante
2000 tokens autour du curseur + extraits pertinents.	Java LLM 
□	Prompts dans des fichiers .yml
Modifier un prompt = éditer un fichier texte. Zéro recompilation.	Config 

Phase 2 — Cœur IA  Les fonctions que l'auteur utilisera chaque jour
La valeur principale du produit
□	Mode questions pour le syndrome de la page blanche
L'IA analyse le contexte et pose 2-3 questions. Jamais de rédaction.	LLM React 
□	Requête bible — mode anti-hallucination strict
Réponse issue des fichiers uniquement, source affichée.	Java LLM 
□	Détection des personnages en fin de scène
Déclenchée à la sauvegarde ou au marquage manuel. Jamais en temps réel.	Java Data 
□	Sélecteur de ton — co-auteur / éditeur / lecteur
Widget rapide dans le panneau IA. Accessible en un clic.	React UX 
□	Fiche de reprise automatique
Affichée après 24h d'absence. 5 blocs fixes.	React LLM 
□	Annotations en temps réel sur le texte
Sélection + 3 tags. Underline discret. Contexte injecté au prochain appel.	React Data 
□	Connecteurs LLM premium
OpenAI, Anthropic, Gemini. Clés chiffrées, estimation de coût visible.	Java LLM 

Phase 3 — Cohérence et analyse  Ce qui fait de Scriptor un outil de référence
Les features qui n'existent nulle part ailleurs
□	Module géographique — éditeur de données carte
Lieux, distances, modes de déplacement. Lié à map-data.json.	Java React 
□	Vérificateur de cohérence géo et temporelle
Détecte les trajets impossibles, contradictions de timing.	Java LLM 
□	Résumé de chapitre automatique
Généré à la sauvegarde. Proposition d'intégration dans la bible.	LLM Java 
□	Analyse de rythme narratif
Courbe d'action, longueur des scènes, suggestions découpe/fusion, POV.	React LLM 
□	Détection des personnages oubliés
Personnages absents depuis X chapitres. À la demande uniquement.	Java Data 
□	Bilan de fin de tome
Session rituelle. Questions IA sur voix, arcs, incohérences.	LLM UX 

Phase 4 — Finition  Ce qui rend le produit désirable
La couche qui transforme un outil en expérience
□	Défis narratifs générés depuis la bible
4 types de défis. Minuteur intégré. Zéro points, zéro badges.	LLM React 
□	Contraintes lexicales — mots interdits et imposés
Fréquence des mots, lexique de l'univers, contraintes personnalisées.	Java React 
□	Profil de ton narratif
3-5 extraits de prose de l'auteur. Référence de style pour toutes les suggestions.	LLM Config 
□	Mode silencieux — IA en veille
Toggle qui suspend tout appel réseau sans désactiver le module.	React UX 
□	Mode hors-ligne total
Force Ollama uniquement. Bloque tout trafic réseau. Confidentialité absolue.	Java UX 

13. Ce qui a été explicitement exclu
–	Fine-tuning du modèle sur la prose de l'auteur — trop coûteux, le profil de ton suffit.
–	Base vectorielle embarquée (ChromaDB, Qdrant) — un index JSON simple fait 90% du travail.
–	Synchronisation cloud des fiches — introduit backend, auth, CGU. Hors scope outil local.
–	IA proactive automatique pendant l'écriture — brise le flux. Toujours à la demande.
–	Gamification (points, badges, streaks) — infantilisant pour un auteur architecte.
–	Rédaction automatique à la place de l'auteur — contraire à la philosophie du produit.


Scriptor IA — Cahier des charges v1.0
Issu de la session de brainstorming — méthode interview + équipe projet
