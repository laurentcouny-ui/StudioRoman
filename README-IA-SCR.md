# 🖋️ SCRIPTOR IA

**Le sanctuaire de l'écrivain, augmenté par l'Intelligence Artificielle.**

SCRIPTOR IA n'est pas un outil de génération de texte. C'est un **coach littéraire interactif, local et respectueux de votre processus créatif**. L'IA n'écrira jamais à votre place, elle se contentera de vous questionner, d'analyser vos rythmes, de vérifier la cohérence de votre univers et de vous lancer des défis pour vaincre la page blanche.

### 🚀 Principes Fondamentaux
1. **L'éditeur est sacré** : Aucune intervention de l'IA pendant la frappe.
2. **Zéro Hallucination** : L'IA lit votre "Bible" et cite ses sources. Si elle ne sait pas, elle le dit.
3. **Local-First & Confidentialité** : Le modèle par défaut (Ollama) tourne localement. Les clés API premium sont chiffrées en AES-256.
4. **Zéro Recompilation** : Tous les prompts et le comportement de l'IA sont modifiables à chaud via des fichiers de configuration.

---

## 🏗️ Architecture du Projet

* **`/backend`** : API REST en Java 21 (Spring Boot). Gère la logique métier, la sécurité et l'orchestration asynchrone des modèles IA.
* **`/frontend`** : Interface Utilisateur en React (Vite, TypeScript, Tailwind CSS).
* **`/config`** : Dossier central contenant les instructions de l'IA (`prompts.yml`) et les données de votre univers (`/data/*.json`).

---

## 🛠️ Prérequis

Avant de lancer Scriptor IA, assurez-vous d'avoir installé les outils suivants :
* **Java JDK 21+** : Pour le serveur Backend.
* **Maven** : Pour compiler le Backend.
* **Node.js (v18+)** : Pour exécuter le Frontend React/Vite.
* **Ollama** : Pour faire tourner l'IA locale (Modèle par défaut gratuit).

---

## ⚙️ Installation & Lancement

### 1. Préparer l'IA locale (Ollama)
SCRIPTOR IA utilise le modèle `mistral` (ou `llama3`) par défaut.
Ouvrez un terminal et téléchargez le modèle :
```bash
ollama run mistral
```
*Laissez Ollama tourner en arrière-plan.*

### 2. Démarrer le Backend (API Java)
Ouvrez un nouveau terminal, placez-vous dans le dossier racine du projet, puis naviguez vers le backend :
```bash
cd backend
mvn spring-boot:run
```
*Le serveur démarrera sur `http://localhost:8080`. Il créera/lira automatiquement le dossier de configuration `../config`.*

### 3. Démarrer le Frontend (Interface React)
Ouvrez un troisième terminal, placez-vous dans le dossier racine, puis naviguez vers le frontend :
```bash
cd frontend
npm install
npm run dev
```
*L'interface utilisateur sera accessible sur `http://localhost:5173`.*

---

## 📖 Utilisation des Outils

Ouvrez `http://localhost:5173` dans votre navigateur. Vous y trouverez votre éditeur central et le Panneau IA sur la droite.

* **Syndrome de la page blanche** : Cliquez pour obtenir des questions de relance adaptées au ton choisi (co-auteur, éditeur, lecteur).
* **Mode Anti-Hallucination** : Interrogez l'IA sur votre univers. Elle cherchera exclusivement dans votre fichier `bible.json`.
* **Annotations** : Surlignez du texte dans l'éditeur pour l'annoter. Ces notes seront lues par l'IA lors de vos prochaines requêtes.
* **Rythme & Contraintes** : Analysez instantanément vos tics de langage ou les pics d'action de votre scène.
* **Défis Narratifs** : Lancez le minuteur et relevez des défis générés organiquement à partir de votre liste de personnages.

---

## 🔒 Sécurité et Paramètres Globaux

Depuis le panneau IA, le composant **Paramètres Globaux** vous permet de :
* **Changer de modèle** : Passer d'Ollama à des modèles premium (OpenAI, Gemini, Anthropic). *Note : vos clés API seront chiffrées localement.*
* **Mode Hors-Ligne Total** : Force l'utilisation d'Ollama et coupe physiquement toute requête vers l'extérieur. Confidentialité garantie.
* **Mode Silencieux** : Désactive temporairement toutes les réponses de l'IA pour écrire en paix.

---

## 📝 Fichiers de Configuration

Vous pouvez modifier le "cerveau" de SCRIPTOR IA à la volée. Les modifications prennent effet **instantanément** sans redémarrer le serveur.

* `config/prompts.yml` : Contient toutes les directives et les tons de l'IA.
* `config/data/bible.json` : Vos fiches d'univers (Lieux, Lore, Magie...).
* `config/data/characters.json` : Vos fiches de personnages.
* `config/data/lexicon.json` : Vos tics de langage à bannir et votre lexique à imposer.
* `config/data/map-data.json` : Les distances et temps de trajet de votre univers.

---

*Développé avec passion pour les Architectes de mondes et les Jardiniers des mots.*