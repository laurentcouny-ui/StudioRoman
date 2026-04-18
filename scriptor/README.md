# Scriptor — Studio pour sagas romanesques

Application web pour écrire des sagas et romans : structure (sagas, tomes, chapitres, scènes), personnages, chronologie, carte du monde, export éditeur (manuscrit, synopsis, dossier complet), sauvegarde locale et cloud (Google Drive, Dropbox).

**Version 1.0.0** — Installable en tant que PWA (Progressive Web App) sur ordinateur et mobile.

---

## Lancer en développement

```bash
cd scriptor
npm install
npm run dev
```

L’app est disponible sur **http://localhost:5173/**.

---

## Application Windows (Tauri, `.exe` / MSI)

Prérequis : **Node** (voir `.nvmrc`), **Rust** (voir `rust-toolchain.toml`), **Windows** avec les outils de build Visual Studio pour le toolchain MSVC.

- **Mode dev (fenêtre native + hot reload Vite)** : `npm run tauri:dev`
- **Build installateur MSI** : `npm run tauri:build`  
  Sortie typique : `src-tauri/target/release/bundle/msi/Scriptor_*_x64_fr-FR.msi` et l’exécutable dans `src-tauri/target/release/`.
- **Cahier des charges stockage (WAL, recovery, grille critères)** : voir **`src-tauri/CDC-BRIQUE-2.md`**.
- **Brique 3 — import manuscrit (.docx, PDF), préflight, sessions** : voir **`src-tauri/CDC-BRIQUE-3.md`**.
- **Brique 4 — mise en page print (PDF/X-4, ePub) + kit média (couverture)** : voir **`src-tauri/CDC-BRIQUE-4.md`**.

### LanguageTool (correcteur local, port 8010) — bureau plug-and-play

**Pour l’utilisateur final (MSI / build release)** : aucune installation de Java ni copie manuelle du JAR. Avant `npm run tauri:build`, exécutez une fois :

```bash
cd scriptor
npm run vendor:languagetool-bundled
```

Ce script télécharge un **JRE Eclipse Temurin** et **LanguageTool** (serveur) dans `src-tauri/resources/languagetool/` (hors dépôt Git : voir `.gitignore`). L’installateur embarque ces fichiers ; au lancement, Book Note démarre le serveur sur **8010** sans rien demander à l’auteur.

Si le JAR est embarqué mais le JRE du bundle est absent ou cassé, une boîte de dialogue (Windows) signale l’incohérence ; un lien Temurin est proposé en **secours** pour installer Java à la main.

**Développement sans vendor** : vous pouvez placer `languagetool-server.jar` sous les données locales (`%LOCALAPPDATA%\fr.scriptor.desktop\languagetool\` sur Windows, etc.) ou définir `SCRIPTOR_LANGUAGETOOL_JAR`, avec **Java sur le PATH**.

**Commandes utiles** :

```bash
java -jar chemin/vers/languagetool-server.jar --port 8010
cd scriptor && npm run lt:server
```

Variables d’environnement : `SCRIPTOR_LANGUAGETOOL_JAR`, `BOOKNOTE_LANGUAGETOOL_JAR`, `LANGUAGETOOL_JAR`, `SCRIPTOR_LANGUAGETOOL_PORT` (défaut **8010**), `SCRIPTOR_SKIP_LANGUAGETOOL_AUTOSTART=1` pour désactiver l’auto-démarrage.

L’interface reste la même que la version web ; la couche **`src/platform/`** isole le code spécifique bureau (logs, shell, plein écran, splash, vérif. de mise à jour GitHub). Le guide **`src-tauri/UPDATER-NOTES.md`** décrit une migration future vers le **Tauri Updater** natif (signatures, deltas).

### Windows SmartScreen (installation non signée)

Lors de l’installation, Windows peut afficher un message d’avertissement. Cela arrive avec tous les logiciels indépendants qui ne disposent pas encore d’un certificat de signature — un document officiel qui coûte plusieurs centaines d’euros par an. Scriptor est un projet créé pour les auteurs, pas pour les grandes entreprises. Nous avons fait le choix de ne pas répercuter ce coût sur vous. Votre ordinateur est en sécurité. Pour continuer l’installation, cliquez sur « Informations complémentaires » puis « Exécuter quand même ».

---

## Construire pour la production

```bash
cd scriptor
npm install
npm run build
```

Le dossier **`dist/`** contient l’application prête à être déployée (fichiers statiques). Vous pouvez l’héberger sur n’importe quel hébergeur (Vercel, Netlify, GitHub Pages, serveur web).

---

## Mettre l’app en ligne (déploiement)

Pour que vous ou d’autres puissiez ouvrir Scriptor via une adresse web (et l’installer en PWA), il faut **déployer** le contenu du dossier **`dist/`** sur un hébergeur. Voici deux méthodes **gratuites** et simples.

### Étape 0 — Faire le build

Dans le dossier **`scriptor`**, ouvrez un terminal et lancez :

```bash
npm run build
```

Le dossier **`dist/`** est créé (ou mis à jour) avec tous les fichiers à mettre en ligne.

---

### Méthode 1 — Vercel (recommandé, sans compte Git obligatoire)

1. Allez sur **https://vercel.com** et créez un compte (gratuit, avec e-mail ou GitHub).
2. Sur la page d’accueil, cliquez sur **« Add New… »** → **« Project »**.
3. Si on vous propose d’importer un dépôt Git, cherchez une option du type **« Upload »** ou **« Deploy without Git »** (ou utilisez la CLI ci-dessous).
4. **Alternative : déploiement par glisser-déposer**
   - Allez sur **https://vercel.com/new**.
   - Glissez-déposez **tout le contenu** du dossier **`dist/`** (pas le dossier `dist` lui-même : ouvrez `dist`, sélectionnez tout ce qu’il y a dedans, glissez dans la zone prévue).
   - Vercel déploie et vous donne une adresse du type **`https://votre-projet-xxx.vercel.app`**. C’est votre lien à partager.

**Avec la ligne de commande (optionnel)** : installez Vercel CLI (`npm i -g vercel`), puis dans le dossier `scriptor` lancez `vercel` et suivez les questions. Indiquez que le dossier de build est **`dist`** (ou `./dist`).

---

### Méthode 2 — Netlify (glisser-déposer)

1. Allez sur **https://app.netlify.com** et créez un compte (gratuit).
2. Sur le tableau de bord, cliquez sur **« Add new site »** → **« Deploy manually »** (ou « Drag and drop »).
3. Une zone s’affiche : **glissez-déposez tout le contenu** du dossier **`dist/`** (les fichiers et dossiers *à l’intérieur* de `dist`, pas le dossier `dist` lui-même).
4. Netlify déploie et affiche une adresse du type **`https://nom-aleatoire-123.netlify.app`**. Vous pouvez la personnaliser dans les paramètres du site. C’est votre lien à partager.

---

### Après la mise en ligne

- **Lien à partager** : envoyez l’URL fournie par Vercel ou Netlify (ex. `https://scriptor-xxx.vercel.app`) à toute personne qui doit utiliser ou installer Scriptor.
- **Google Drive et Dropbox** : si vous utilisez la sauvegarde cloud, ajoutez cette URL dans les paramètres OAuth (origines et URI de redirection). Voir **`CONFIGURATION-CLES.md`**, section « Si vous distribuez Scriptor ».

---

## Comment un tiers installe l’app (en 3 étapes)

**Vous** (le développeur), vous mettez l’app en ligne une fois (voir « Déployer » ci-dessus). Ensuite, **n’importe qui** peut l’installer comme une vraie application sur son ordinateur ou son téléphone.

### Ce que vous faites une seule fois

1. Vous faites **`npm run build`**.
2. Vous uploadez le contenu du dossier **`dist/`** sur un hébergeur (Vercel, Netlify, etc.) pour obtenir une adresse du type **`https://votre-scriptor.vercel.app`** (ou votre propre nom de domaine).
3. Vous donnez **cette adresse** aux personnes à qui vous voulez offrir Scriptor (par e-mail, lien sur un site, etc.).

### Ce que fait la personne qui veut installer Scriptor (le « tiers »)

1. Elle **ouvre le lien** que vous lui avez envoyé (ex. `https://votre-scriptor.vercel.app`) dans son navigateur (**Chrome** ou **Edge** recommandés).
2. Elle **installe l’app** :
   - **Sur ordinateur** : en haut à droite de la barre d’adresse, un bouton peut apparaître (icône ⊕ ou « Installer »). Sinon : clic sur le **menu du navigateur** (les 3 points ⋮) → **« Installer Scriptor »** ou **« Installer l’application »**.
   - **Sur téléphone (Android)** : menu (⋮) du navigateur → **« Ajouter à l’écran d’accueil »** ou **« Installer l’application »**.
   - **Sur iPhone/iPad (Safari)** : bouton **Partager** (carré avec flèche) → **« Sur l’écran d’accueil »**.
3. C’est terminé : une **icône « Scriptor »** apparaît sur le bureau (PC) ou l’écran d’accueil (mobile). En cliquant dessus, l’app s’ouvre comme une application à part, sans la barre d’adresse du navigateur.

**En résumé** : le tiers n’a rien à télécharger ni à configurer. Il ouvre votre lien, clique sur « Installer » (ou « Ajouter à l’écran d’accueil »), et l’app est installée.

---

## Configuration des clés (sauvegarde cloud)

Pour activer la sauvegarde automatique vers Google Drive ou Dropbox, suivez le guide **`CONFIGURATION-CLES.md`** dans ce dossier (création du fichier `.env`, clés Google et Dropbox, URI de redirection).

---

## Panneau IA (intégré à l’écriture)

Le panneau latéral **IA / Thésaurus** charge les outils IA depuis **`src/ia/`** (React + TypeScript + Tailwind, chunk séparé). Ils reçoivent le **texte de la scène courante** automatiquement.

- **Production / déploiement** : une seule URL — le JAR Spring sert aussi le site statique. Voir **`../DEPLOIEMENT.md`** à la racine du dépôt (`docker compose up` ou `java -jar`).
- **Backend Java** : `../backend` (`mvn spring-boot:run`, port **8080**). En dev, Vite redirige **`/api`** vers ce serveur (`vite.config.js`).
- **Désactiver l’IA** : dans `.env`, `VITE_ENABLE_AI_PANEL=0`.
- **Thésaurus (iframe)** : toujours optionnel — `VITE_ENABLE_THESAURUS` + `VITE_THESAURUS_IFRAME_URL` (voir **`.env.example`**).
- Données runtime du backend : dossier **`../config/`** à la racine du monorepo.
- **CSP** (`index.html`) : en production, ajuster `connect-src` / `frame-src` si besoin (API + iframe).

Utilitaires réseau côté app principale : `src/addonRequestUtils.js`.

---

## Prévisualiser le build en local

```bash
npm run preview
```

Ouvre une version de production en local pour tester avant déploiement.

---

## Vérification CDC (commande unique)

Pour valider rapidement l’état global Desktop V2 (frontend + stress + Rust + backend) :

```bash
npm run cdc:gate
```

Cette commande enchaîne :
- lint frontend
- build frontend
- stress suite (`project-store`, `backup-retry`, `global-desktop-data`)
- `cargo check` (Tauri)
- `mvn -q compile -DskipTests` (backend)

Le lint est **non bloquant** par défaut (utile tant que la dette historique existe).  
Pour le rendre bloquant : `CDC_STRICT_LINT=1 npm run cdc:gate`.
