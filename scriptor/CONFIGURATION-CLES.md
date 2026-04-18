# Configuration des clés — Sauvegarde Google Drive et Dropbox

Ce guide explique **étape par étape** comment obtenir les clés pour connecter Scriptor à votre Google Drive ou Dropbox. Une seule des deux suffit si vous ne voulez qu’un service.

---

## C’est gratuit — pas de paiement

- **Google Cloud Console** : créer un projet, activer l’API Drive et créer un « ID client OAuth » est **gratuit**. Aucune carte bancaire, aucun abonnement. Vous n’utilisez pas les services payants de Google Cloud (machines, stockage cloud, etc.) : vous créez juste une clé pour que Scriptor puisse envoyer des fichiers **vers votre propre Google Drive** (votre espace gratuit 15 Go).
- **Dropbox (App Console)** : créer une application Dropbox est **gratuit**. La clé sert uniquement à envoyer des sauvegardes **vers votre Dropbox personnel** (votre espace gratuit).

Vous ne payez rien à Google ni à Dropbox pour cette configuration.

---

## Avant de commencer

**Important — Port fixe :** Scriptor est configuré pour **toujours** tourner sur le port **5173**. Vous devez donc utiliser **uniquement** **`http://localhost:5173`** et **`http://localhost:5173/`** dans Google Cloud et Dropbox (pas 5174, 5175, etc.). Si vous aviez configuré un autre port (par ex. 5175) parce que l’app s’ouvrait dessus avant, **modifiez** les URI dans Google et Dropbox pour mettre **5173** à la place, puis réessayez.

Vous allez créer un petit fichier texte nommé **`.env`** dans le dossier **`scriptor`**. Ce fichier contiendra vos clés (Google et/ou Dropbox). L’application les lit au démarrage. **Sans ce fichier, les boutons « Connecter Google Drive » et « Connecter Dropbox » ne peuvent pas fonctionner.**

---

# Créer le fichier .env — Pas à pas pour débutant

Le fichier **`.env`** est un **fichier texte ordinaire**. Son nom est exactement : point puis env (`.env`), sans rien après. Il doit se trouver **dans le dossier `scriptor`** (celui où il y a `package.json` et le dossier `src`).

## Méthode 1 — Avec Cursor (recommandé)

1. Dans Cursor, dans la **barre de gauche** (explorateur de fichiers), cliquez sur le dossier **`scriptor`** pour être sûr d’être au bon endroit.
2. **Clic droit** sur le dossier **`scriptor`** (ou dans la zone vide sous la liste des fichiers).
3. Choisissez **« Nouveau fichier »** (ou « New File »).
4. Tapez **exactement** ce nom (sans espace, sans .txt à la fin) :  
   **`.env`**
5. Appuyez sur **Entrée**. Le fichier `.env` est créé et s’ouvre dans l’éditeur.
6. Le fichier est vide. Vous y mettrez vos clés plus tard (voir les étapes 5 de la partie A et 6 de la partie B). Pour l’instant vous pouvez y coller ces deux lignes (vous remplacerez les valeurs après avoir créé vos clés) :
   ```
   VITE_GOOGLE_CLIENT_ID=
   VITE_DROPBOX_APP_KEY=
   ```
7. Enregistrez avec **Ctrl+S**.

**Vérification :** dans l’explorateur de gauche, vous devez voir un fichier nommé **`.env`** dans le dossier `scriptor`. Si vous voyez `.env.txt` ou autre chose, le nom n’est pas bon : supprimez le fichier et recommencez en tapant bien `.env` sans rien après.

## Méthode 2 — En copiant le fichier d’exemple

1. Dans l’explorateur de fichiers de **Windows** (pas Cursor), allez dans le dossier de votre projet, puis ouvrez le dossier **`scriptor`**.
2. Cherchez le fichier **`.env.example`** (ou `env.example`). Si vous ne le voyez pas, affichez les fichiers cachés : menu **Affichage** → cochez **« Extensions de noms de fichiers »** et **« Éléments masqués »**.
3. **Copiez** ce fichier (clic droit → Copier), puis **Collez** au même endroit (clic droit → Coller). Vous obtenez une copie, par exemple **`.env.example - Copie`**.
4. **Renommez** cette copie : clic droit sur la copie → **Renommer**. Supprimez tout le nom et tapez **exactement** :  
   **`.env`**  
   puis Entrée. Si Windows vous demande de confirmer (« L’extension pourrait devenir non reconnue »), confirmez **Oui**.
5. Ouvrez le fichier **`.env`** avec **Cursor** ou le **Bloc-notes** : dedans vous verrez des lignes avec `VITE_GOOGLE_CLIENT_ID=` et `VITE_DROPBOX_APP_KEY=`. Vous remplirez ces valeurs après avoir créé vos clés (parties A et B ci-dessous).
6. Enregistrez avec **Ctrl+S**.

**Résumé :** le fichier s’appelle **`.env`**, il est **dans le dossier `scriptor`**, et il contient des lignes du type `VITE_GOOGLE_CLIENT_ID=votre_cle_ici`. Une fois ce fichier créé et rempli, vous redémarrerez l’application (`npm run dev`) pour que Scriptor prenne en compte les clés.

---

# Partie A — Clé Google Drive

**Rappel :** Aucun paiement, aucune carte bancaire. On crée juste une clé gratuite pour accéder à *votre* Drive.

## Étape 1 — Aller sur Google Cloud Console

1. Ouvrez votre navigateur et allez sur : **https://console.cloud.google.com/**
2. Connectez-vous avec votre compte Google (celui dont vous voulez utiliser le Drive).
3. Si Google propose d’« activer la facturation » ou d’ajouter une carte : **vous pouvez refuser / ignorer** pour ce projet. La création de projet et l’API Drive avec OAuth restent gratuites.

## Étape 2 — Créer un projet (ou en choisir un)

1. En haut de la page, à gauche du titre « Google Cloud », cliquez sur le **menu déroulant du projet** (il peut afficher « Sélectionner un projet » ou le nom d’un projet).
2. Cliquez sur **« Nouveau projet »**.
3. Donnez un nom (par ex. **Scriptor**).
4. Cliquez sur **« Créer »**.
5. Attendez quelques secondes, puis **sélectionnez ce projet** dans le menu déroulant en haut (pour être sûr que c’est bien lui qui est actif).

## Étape 3 — Activer l’API Google Drive

1. Dans le menu de gauche (les 3 traits ou « Menu »), ouvrez **« APIs et services »** → **« Bibliothèque »** (ou allez sur **https://console.cloud.google.com/apis/library**).
2. Dans la barre de recherche, tapez : **Google Drive API**.
3. Cliquez sur **« Google Drive API »** dans les résultats.
4. Cliquez sur le bouton bleu **« Activer »**.
5. Une fois activé, vous revenez sur la fiche de l’API (pas besoin d’autre chose ici).

## Étape 4 — Créer des identifiants (ID client)

1. Dans le menu de gauche, allez dans **« APIs et services »** → **« Identifiants »** (ou **https://console.cloud.google.com/apis/credentials**).
2. En haut, cliquez sur **« + Créer des identifiants »**.
3. Choisissez **« ID client OAuth »** (et non « Clé API »).
4. Si on vous demande de **configurer l’écran de consentement** :
   - Cliquez sur **« Configurer l’écran de consentement »**.
   - Type d’application : **Externe** → **« Créer »**.
   - Remplissez uniquement le **Nom de l’application** (ex. : **Scriptor**).
   - Cliquez sur **« Enregistrer et continuer »** jusqu’à la fin (vous pouvez laisser le reste par défaut).
   - Revenez ensuite dans **« Identifiants »** et recliquez sur **« + Créer des identifiants »** → **« ID client OAuth »**.
5. Dans **« Type d’application »**, sélectionnez **« Application Web »**.
6. Donnez un nom (ex. : **Scriptor Backup**).
7. Dans **« URI de redirection autorisés »**, cliquez sur **« + Ajouter un URI »** et ajoutez **exactement** :
   - `http://localhost:5173`
   - puis **« + Ajouter un URI »** à nouveau et ajoutez aussi :
   - `http://localhost:5173/`
8. Dans **« Origines JavaScript autorisées »**, cliquez sur **« + Ajouter un élément »** et ajoutez :
   - `http://localhost:5173`
9. Cliquez sur **« Créer »**.
10. Une fenêtre s’ouvre avec **Votre ID client** et **Votre code secret**. Vous n’avez besoin **que de l’ID client** (une longue chaîne se terminant par `.apps.googleusercontent.com`).
11. **Copiez l’ID client** (bouton « Copier » à côté ou sélectionnez tout et Ctrl+C).

## Étape 5 — Mettre la clé dans le fichier .env

**Ce que vous allez faire :** coller **l’ID client Google** que vous venez de copier à l’étape 4 (la longue chaîne qui se termine par `.apps.googleusercontent.com`) dans le fichier `.env`, sur la ligne qui commence par `VITE_GOOGLE_CLIENT_ID=`.

**Où coller :** dans le fichier `.env`, **juste après le signe =** de la ligne `VITE_GOOGLE_CLIENT_ID=`. Il ne doit pas y avoir d’espace avant ni après le `=`.

**Pas à pas :**

1. Dans Cursor : dans la barre de gauche, **double-cliquez** sur le fichier **`.env`** (dans le dossier `scriptor`) pour l’ouvrir. S’il n’existe pas encore, suivez la section **« Créer le fichier .env »** plus haut.

2. Dans le fichier ouvert, repérez la ligne qui contient **`VITE_GOOGLE_CLIENT_ID=`**.  
   - Si la ligne est vide après le `=` (par ex. `VITE_GOOGLE_CLIENT_ID=`), **cliquez avec la souris juste après le `=`** (à la fin de la ligne), puis **collez** avec **Ctrl+V** : c’est l’ID client que vous avez copié à l’étape 4.  
   - S’il n’y a pas encore cette ligne, tapez exactement : `VITE_GOOGLE_CLIENT_ID=` puis **collez** tout de suite après avec **Ctrl+V** (sans espace, sans retour à la ligne entre le `=` et la clé).

3. **Résultat attendu :** après collage, la ligne doit ressembler à ceci (avec *votre* ID à la place de l’exemple) :
   ```
   VITE_GOOGLE_CLIENT_ID=123456789012-abcdefghijklmnop.apps.googleusercontent.com
   ```
   Une seule ligne, pas d’espace autour du `=`, pas de guillemets. La partie après le `=` est votre ID client Google.

4. Enregistrez le fichier avec **Ctrl+S**.

## Étape 6 — Redémarrer l’application

1. Dans le terminal où tourne `npm run dev`, arrêtez avec **Ctrl+C**.
2. Relancez : **`npm run dev`**.
3. Dans Scriptor, allez dans **Sauvegarde & sécurité** et cliquez sur **« Connecter Google Drive »** : une fenêtre Google doit s’ouvrir pour vous connecter et autoriser l’accès.

---

# Partie B — Clé Dropbox

**Rappel :** Aucun paiement. On crée une application Dropbox gratuite pour envoyer des sauvegardes vers *votre* Dropbox.

## Étape 1 — Aller sur la console développeur Dropbox

1. Ouvrez votre navigateur et allez sur : **https://www.dropbox.com/developers/apps**
2. Connectez-vous avec votre compte Dropbox (celui dont vous voulez utiliser l’espace de stockage).

## Étape 2 — Créer une application

1. Cliquez sur le bouton **« Create app »** (ou « Créer une application »).
2. **Choose an API** : sélectionnez **« Scoped access »** (Accès avec périmètre).
3. **Choose the type of access** : choisissez **« Full Dropbox »** (accès complet à votre Dropbox) ou **« App folder »** (un seul dossier dédié à Scriptor). Les deux conviennent ; « App folder » est un peu plus restreint.
4. **Name your app** : donnez un nom, par ex. **Scriptor** (si « Scriptor » est déjà pris, essayez **Scriptor Backup** ou **Scriptor-sauvegarde**).
5. Cochez la case pour accepter les conditions d’utilisation.
6. Cliquez sur **« Create app »**.

## Étape 3 — Récupérer la clé (App key)

1. Vous arrivez sur la page de votre application. En haut, onglet **« Settings »** (Paramètres), vous voyez :
   - **App key** : une chaîne de caractères (ex. `abc123xyz456`)
2. **Copiez** cette **App key** (bouton « Copy » à côté ou sélectionnez-la et Ctrl+C). C’est cette valeur que vous mettrez dans le fichier `.env`.

## Étape 4 — Ajouter l’URI de redirection (obligatoire)

1. Toujours dans **Settings**, descendez jusqu’à la section **« OAuth 2 »**.
2. Sous **« Redirect URIs »**, cliquez sur **« Add »** (Ajouter).
3. Saisissez **exactement** cette adresse, **sans espace, avec le slash final** :
   - **`http://localhost:5173/`**
   - Pas de `https`, pas de chemin en plus, pas de slash en trop : uniquement `http://localhost:5173/`.
4. Cliquez sur **« Add »** puis **« Submit »** (Enregistrer) en bas de la page si nécessaire.

**En cas d’erreur « Invalid redirect_uri »** : Dropbox compare l’URI caractère pour caractère. Vérifiez dans **Redirect URIs** que vous avez bien **`http://localhost:5173/`** (avec le **/** à la fin). Si vous aviez mis `http://localhost:5173` sans slash, supprimez-la et ajoutez **`http://localhost:5173/`**.

## Étape 5 — Activer l’accès implicite (token) si demandé

1. Dans la même section **OAuth 2**, vérifiez s’il existe une option du type **« Access type »** ou **« Allow implicit grant »**.
2. Si vous voyez **« Allow implicit grant »** (Autoriser l’octroi implicite), **cochez-la** et enregistrez. Cela permet à Scriptor de recevoir un jeton directement après la connexion (sans serveur). Si cette option n’apparaît pas, Dropbox peut l’autoriser par défaut pour les redirect URI ; dans ce cas, ne rien changer.

## Étape 6 — Vérifier les permissions (Permissions)

1. Cliquez sur l’onglet **« Permissions »** (Autorisations).
2. Cochez au minimum :
   - **files.metadata.write** (écriture des métadonnées de fichiers)
   - **files.content.write** (écriture du contenu des fichiers)
3. Cliquez sur **« Submit »** pour enregistrer.

## Étape 7 — Mettre la clé dans le fichier .env

**Ce que vous allez faire :** coller **l’App key Dropbox** que vous avez copiée à l’étape 3 dans le fichier `.env`, sur la ligne qui commence par `VITE_DROPBOX_APP_KEY=`.

**Où coller :** dans le fichier `.env`, **juste après le signe =** de la ligne `VITE_DROPBOX_APP_KEY=`. Pas d’espace avant ni après le `=`.

**Pas à pas :**

1. Dans Cursor : dans la barre de gauche, **double-cliquez** sur le fichier **`.env`** (dans le dossier `scriptor`) pour l’ouvrir.

2. Repérez la ligne **`VITE_DROPBOX_APP_KEY=`**.  
   - **Cliquez** avec la souris **juste après le `=`** (à la fin de la ligne), puis **collez** avec **Ctrl+V** l’App key Dropbox que vous avez copiée à l’étape 3.  
   - S’il n’y a pas encore cette ligne, tapez : `VITE_DROPBOX_APP_KEY=` puis **collez** tout de suite après avec **Ctrl+V** (sans espace entre le `=` et la clé).

3. **Résultat attendu :** la ligne doit ressembler à ceci (avec *votre* clé) :
   ```
   VITE_DROPBOX_APP_KEY=abc123xyz456def
   ```
   Une seule ligne, pas d’espace autour du `=`, pas de guillemets.

4. Enregistrez le fichier avec **Ctrl+S**.

## Étape 8 — Redémarrer l’application

1. Dans le terminal : **Ctrl+C** pour arrêter, puis **`npm run dev`** pour relancer.
2. Dans Scriptor, allez dans **Sauvegarde & sécurité** et cliquez sur **« Connecter Dropbox »** : vous êtes redirigé vers Dropbox pour vous connecter et autoriser l’accès, puis renvoyé dans Scriptor une fois connecté. Le fichier de sauvegarde sera envoyé dans votre Dropbox (à la racine ou dans le dossier de l’app selon le type d’accès choisi).

---

# Dropbox — Autoriser tout le monde (app en ligne, production)

Une fois Scriptor déployé (ex. sur Vercel ou Netlify), pour que **n’importe qui** puisse cliquer sur « Connecter Dropbox » avec **son** compte, suivez ce pas à pas dans la **console développeur Dropbox** (interface actuelle).

## Prérequis

- Vous avez déjà une app **Scriptor** créée (Partie B ci-dessus).
- Vous avez l’**URL de production** de votre app (ex. `https://votre-scriptor.vercel.app`). On utilisera toujours la version **avec le slash final** : `https://votre-scriptor.vercel.app/`.

---

## Étape 1 — Ouvrir la console et votre app

1. Allez sur : **https://www.dropbox.com/developers/apps**
2. Connectez-vous avec votre compte Dropbox si besoin.
3. Cliquez sur le nom de votre application **Scriptor** (dans la liste « My apps » / « Mes applications ») pour ouvrir sa page.

---

## Étape 2 — Onglet « Settings » (Paramètres)

1. En haut de la page de l’app, vous voyez plusieurs onglets : **Settings**, **Permissions**, etc.
2. Cliquez sur **« Settings »** (ou « Paramètres ») pour rester sur la configuration générale.

---

## Étape 3 — Section « OAuth 2 »

1. Dans la page **Settings**, faites défiler jusqu’à la section **« OAuth 2 »**.
2. Vous y voyez notamment :
   - **App key** (déjà utilisée dans votre `.env`)
   - **App secret** (Scriptor ne l’utilise pas en production, inutile de le copier)
   - **Redirect URIs** (liste des adresses autorisées après connexion Dropbox)

---

## Étape 4 — Ajouter l’URI de redirection de production

1. Dans **Redirect URIs**, cliquez sur **« Add »** (ou le bouton pour ajouter une URI).
2. Saisissez **exactement** l’URL de votre app en ligne, **avec le slash final** :
   - Exemple : **`https://votre-scriptor.vercel.app/`**
   - Pas d’espace, pas de chemin en plus (pas `/scriptor/` sauf si votre app est vraiment à cette adresse), pas de slash en trop : juste l’URL de la page d’accueil + **`/`**.
3. Validez (bouton **Add** / **Ajouter**).
4. En bas de la page **Settings**, cliquez sur **« Submit »** (ou **« Enregistrer »**) pour sauvegarder les changements.

**Important :** Si votre app est à `https://mon-site.netlify.app`, l’URI doit être **`https://mon-site.netlify.app/`** (avec le `/` final). Dropbox compare caractère par caractère ; une faute = erreur « Invalid redirect_uri ».

---

## Étape 5 — « Allow implicit grant » (si l’option est visible)

1. Toujours dans la section **OAuth 2**, cherchez une option du type **« Allow implicit grant »** (Autoriser l’octroi implicite).
2. **Scriptor utilise le flux « token » (implicite)** pour recevoir le jeton directement dans l’URL après connexion (sans serveur). Si cette case existe, **cochez-la**.
3. Si vous avez cliqué ailleurs, refaites **Submit** en bas de la page.

Si vous ne voyez pas cette option, l’interface peut l’autoriser par défaut pour les apps avec Redirect URI ; dans ce cas, ne rien changer.

---

## Étape 6 — Onglet « Permissions » (Autorisations)

1. Cliquez sur l’onglet **« Permissions »** (en haut de la page de l’app).
2. Vérifiez que les permissions nécessaires pour **écrire** un fichier dans Dropbox sont cochées. En général, dans la catégorie **Files and folders** (Fichiers et dossiers) :
   - **files.metadata.write** — écriture des métadonnées
   - **files.content.write** — écriture du contenu des fichiers
3. Si une case n’est pas cochée, cochez-la.
4. En bas de la page, cliquez sur **« Submit »** pour enregistrer.

---

## Étape 7 — Statut de l’app (Development / Production)

1. Dans **Settings** (ou sur la page d’accueil de l’app), cherchez une mention du type **« App status »**, **« Status »** ou **« Development »** / **« Production »**.
2. Pour que **tout le monde** puisse se connecter (et pas seulement vous en test), l’app doit être en **Production** (ou équivalent). Si vous voyez **« Development »** ou **« In development »** avec un bouton pour **publier** ou **passer en production**, cliquez dessus et validez.
3. Sauvegardez si un **Submit** est demandé.

*(L’emplacement exact peut varier selon les mises à jour du site Dropbox ; si vous ne trouvez pas, l’app est souvent utilisable par défaut une fois les Redirect URIs et Permissions corrects.)*

---

## Étape 8 — Variables d’environnement en production

Sur votre hébergeur (Vercel, Netlify, etc.) :

1. Dans les **paramètres du projet** (Project settings / Paramètres du site), ouvrez la section **Variables d’environnement** (Environment variables).
2. Ajoutez **`VITE_DROPBOX_APP_KEY`** avec la valeur de votre **App key** Dropbox (la même que dans votre `.env` local).
3. Redéployez l’app une fois la variable enregistrée (souvent automatique).

Sans cette variable, le bouton « Connecter Dropbox » ne pourra pas lancer la connexion sur la version en ligne.

---

## Récapitulatif — Checklist

- [ ] **Settings** → **OAuth 2** → **Redirect URIs** : URI de production ajoutée **avec slash final** (ex. `https://votre-scriptor.vercel.app/`), puis **Submit**.
- [ ] **OAuth 2** : **Allow implicit grant** coché si l’option existe.
- [ ] **Permissions** : **files.metadata.write** et **files.content.write** cochées, puis **Submit**.
- [ ] Statut de l’app en **Production** (si l’option est proposée).
- [ ] Hébergeur : variable **VITE_DROPBOX_APP_KEY** définie et déploiement à jour.

Après ça, tout utilisateur ouvrant votre lien Scriptor peut cliquer sur « Connecter Dropbox » et autoriser **son** compte Dropbox.

---

# Si vous distribuez Scriptor à d’autres personnes

**Oui, l’API est intégrée directement** : vous créez les clés **une seule fois** et vous les mettez dans l’application. Les personnes qui utilisent le logiciel n’ont **rien à configurer**.

## Comment ça marche

- **Vous** (celui qui donne le logiciel) : vous créez **un** projet Google et **une** app Dropbox, vous récupérez **vos** clés, vous les mettez dans le fichier **`.env`** du projet Scriptor.
- **Les utilisateurs** (ceux qui reçoivent Scriptor) : ils ouvrent l’app, cliquent sur « Connecter Google Drive » ou « Connecter Dropbox », et se connectent avec **leur propre** compte Google ou Dropbox. Aucune clé à créer de leur côté : c’est **votre** application OAuth qui est déjà dans le logiciel, ils autorisent juste cette app à accéder à **leur** Drive ou Dropbox.

Donc une seule intégration de votre part, et tout le monde peut utiliser la sauvegarde cloud avec son compte.

## Ce que vous devez faire pour distribuer

1. **Créer les clés** (une fois) comme dans les parties A et B ci-dessus, et les mettre dans **`.env`**.
2. **Construire l’app** : dans le dossier `scriptor`, lancez `npm run build`. Le dossier **`dist/`** contient l’application avec vos clés intégrées (elles sont incluses dans le build par Vite).
3. **Publier** : déployez le contenu de `dist/` sur un hébergeur (Vercel, Netlify, etc.) ou donnez le dossier / le lien à vos utilisateurs.
4. **Ajouter l’URL publique** dans Google et Dropbox :
   - **Google Cloud** → Identifiants → votre ID client OAuth → ajoutez dans « Origines JavaScript autorisées » et « URI de redirection » l’URL de votre app (ex. `https://mon-scriptor.vercel.app` et `https://mon-scriptor.vercel.app/`).
   - **Dropbox** → votre app → Settings → OAuth 2 → Redirect URIs → ajoutez l’URL de votre app (ex. `https://mon-scriptor.vercel.app/`).

Après ça, les gens ouvrent votre lien, cliquent sur « Connecter Google Drive » ou « Connecter Dropbox », se connectent avec leur compte, et c’est tout.

**Important :** ne commitez pas le fichier **`.env`** sur un dépôt public (il contient vos clés). Ajoutez **`.env`** dans **`.gitignore`**. Pour un déploiement (ex. Vercel), vous renseignez les variables `VITE_GOOGLE_CLIENT_ID` et `VITE_DROPBOX_APP_KEY` dans les paramètres du projet sur le site de l’hébergeur.

---

## Autoriser tout le monde (pour des vrais utilisateurs)

Actuellement, si tu vois des erreurs du style **“en cours de test / test users”** (Google) ou des blocages côté Dropbox, c’est parce que l’application OAuth n’est pas encore en mode **Production**.

### Google Drive (Google Cloud)

1. Va sur **https://console.cloud.google.com/** et ouvre ton projet **Scriptor**.
2. Ouvre **APIs et services → Écran de consentement OAuth**.
3. Cherche le statut **« In testing » / « In production »**.
4. Passe en **« In production »**.
5. Si Google te demande une **vérification de l’app** (à cause des permissions demandées), fais la procédure de vérification (ça peut prendre un peu de temps).  
6. Ajoute aussi l’URL de ton site **en production** (ex. `https://ton-scriptor.vercel.app`) dans :
   - **Origines JavaScript autorisées**
   - **URI de redirection**

Après ça, n’importe quel utilisateur pourra cliquer “Connecter Google Drive” et autoriser son propre Drive.

### Dropbox

1. Va sur **https://www.dropbox.com/developers/apps**.
2. Ouvre ton application **Scriptor**.
3. Dans **Settings**, vérifie le statut de l’app (souvent “Development” vs “Production”) et passe en **production** si disponible.
4. Dans **OAuth 2 → Redirect URIs**, ajoute l’URL en production (ex. `https://ton-scriptor.vercel.app/`) exactement (slash final inclus).
5. Vérifie aussi les **Permissions / scopes**.

Après ça, n’importe quel utilisateur pourra cliquer “Connecter Dropbox” et autoriser son propre Dropbox.

---

# Résumé — Contenu du fichier .env

À la fin, votre fichier **`.env`** dans le dossier **`scriptor`** peut ressembler à ceci (avec vos vraies valeurs) :

```
VITE_GOOGLE_CLIENT_ID=123456789-xxx.apps.googleusercontent.com
VITE_DROPBOX_APP_KEY=votre_cle_dropbox
```

- Vous pouvez ne mettre **qu’une seule** des deux lignes si vous n’utilisez qu’un service.
- Pas d’espaces autour du **=**, pas de guillemets.
- Après toute modification du `.env`, il faut **toujours** redémarrer avec **`npm run dev`**.

---

# Dépannage rapide

- **« J’avais configuré le port 5175 (ou un autre), maintenant ça ne marche plus »** : Scriptor est réglé pour utiliser **toujours le port 5173**. Dans **Google Cloud** (Identifiants → votre ID client → Origines et URI de redirection) et dans **Dropbox** (Settings → OAuth 2 → Redirect URIs), remplacez tout ce qui contient `localhost:5175` (ou 5174, etc.) par **`http://localhost:5173`** et **`http://localhost:5173/`**. Enregistrez, puis relancez Scriptor avec `npm run dev` et réessayez.
- **« Google Cloud / Dropbox est payant »** : pour *notre* usage (une clé OAuth + envoi vers *votre* Drive ou Dropbox), tout est gratuit. N’activez pas la facturation si on vous le propose ; vous n’en avez pas besoin.
- **« Clé Google / Dropbox manquante »** : le fichier s’appelle bien **`.env`** (avec le point au début), il est dans le dossier **`scriptor`**, et vous avez redémarré `npm run dev` après l’avoir modifié.
- **Google : « Erreur 400: redirect_uri_mismatch »** : l’URI dans Google Cloud doit être exactement `http://localhost:5173` (et éventuellement `http://localhost:5173/`) ; pas de faute de frappe, pas de https.
- **Google : « Erreur 403 : access_denied » / « L’appli est en cours de test, seuls les testeurs approuvés… »** : votre application Google est en mode **Test**. Seuls les comptes que vous ajoutez comme **testeurs** peuvent se connecter. Pour corriger :
  1. Allez sur **https://console.cloud.google.com/** et sélectionnez votre projet (Scriptor).
  2. Menu **APIs et services** → **Écran de consentement OAuth** (ou **OAuth consent screen**).
  3. Descendez jusqu’à la section **« Utilisateurs de test »** (ou **Test users**).
  4. Cliquez sur **« + ADD USERS »** (ou **Ajouter des utilisateurs**).
  5. Saisissez **l’adresse e-mail du compte Google** avec lequel vous (ou la personne concernée) voulez vous connecter à Scriptor (ex. `votre.email@gmail.com`), puis **Enregistrer**.
  6. Réessayez dans Scriptor : **Sauvegarde & sécurité** → **Connecter Google Drive**. La connexion doit fonctionner pour ce compte. Vous pouvez ajouter jusqu’à 100 utilisateurs de test. Pour une utilisation uniquement personnelle, ajouter votre propre adresse suffit.
- **Dropbox : « Invalid redirect_uri »** : dans la console Dropbox (votre app → **Settings** → **OAuth 2** → **Redirect URIs**), vous devez avoir **exactement** **`http://localhost:5173/`** (avec le **/** à la fin). Pas `http://localhost:5173` sans slash, pas de faute de frappe. Modifiez ou ajoutez cette URI, enregistrez, puis réessayez « Connecter Dropbox ».
- **Dropbox : la page ne revient pas dans Scriptor** : vérifiez que l’URI de redirection dans Dropbox (Settings → OAuth 2 → Redirect URIs) est bien **`http://localhost:5173/`** (avec le slash final).
