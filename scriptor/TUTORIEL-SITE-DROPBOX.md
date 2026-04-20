# Tutoriel — Utiliser le site Dropbox pour préparer la sauvegarde Scriptor

Ce guide décrit **uniquement ce que vous faites sur le site Dropbox** (console développeur), pas dans Studio Roman. À la fin, vous aurez une **application Dropbox** avec une **App key** et les **adresses de redirection** nécessaires.

**Adresse à retenir :** [https://www.dropbox.com/developers/apps](https://www.dropbox.com/developers/apps)

---

## Avant de commencer

- Utilisez le **compte Dropbox** dans lequel vous voulez stocker les sauvegardes (souvent votre compte personnel gratuit).
- Tout est **gratuit** côté Dropbox pour créer une app et utiliser OAuth ; vous ne payez pas la console développeur.
- Gardez un **bloc-notes** ouvert : vous allez copier une **clé** (App key) plus tard.

---

## Déjà tout configuré sur un autre PC de dev ?

Si la connexion Dropbox **marchait déjà** sur une autre machine avec le **même projet** :

- **Ne recréez pas** une nouvelle application Dropbox : la même **App** côté site suffit.
- Copiez le fichier **`scriptor/.env`** de l’ancien PC vers le nouveau (au minimum la ligne **`VITE_DROPBOX_APP_KEY=`** avec la **même** valeur). Sans ce fichier ou avec une clé vide, l’app ne peut pas se connecter.
- Sur [dropbox.com/developers/apps](https://www.dropbox.com/developers/apps), ouvrez **la même app** → **Settings** → **OAuth 2** → **Redirect URIs**. Vous n’avez rien à changer **si** toutes les URI dont vous avez besoin sur ce PC y sont déjà listées. Sinon, **ajoutez uniquement celles qui manquent** (ex. `http://127.0.0.1:17863/` pour la connexion Dropbox ouverte dans le navigateur depuis l’app bureau, ou `http://localhost:14230/` si vous ne l’aviez pas encore), puis **Submit**.
- Redémarrez la commande de dev (`npm run dev` ou `npm run dev:tauri`) après avoir copié ou modifié le `.env`.

Les étapes ci-dessous (créer une app, etc.) ne concernent que ceux qui **partent de zéro**.

---

## Étape 1 — Ouvrir la console et se connecter

1. Dans votre navigateur, ouvrez : **https://www.dropbox.com/developers/apps**
2. Si vous n’êtes pas connecté, Dropbox vous demande **votre e-mail et mot de passe** (ou **Continuer avec Google** si vous utilisez ce mode pour votre compte Dropbox).
3. Vous arrivez sur la liste **« Your apps »** (Vos applications) — vide si c’est la première fois.

---

## Étape 2 — Créer une nouvelle application

1. Cliquez sur le bouton **« Create app »** (Créer une application), en haut à droite ou au centre selon la version du site.
2. **Choose an API** : choisissez **« Scoped access »** (accès avec périmètre / scopes). C’est le mode standard pour OAuth moderne.
3. **Choose the type of access** :
   - **« App folder »** : l’app ne voit qu’**un dossier** dédié (ex. `/Apps/Scriptor/…`). Plus limité, souvent suffisant.
   - **« Full Dropbox »** : l’app peut accéder à **tout** votre Dropbox (comme le client officiel). À choisir si vous préférez déposer les sauvegardes à la racine ou partout.
4. **Name your app** : tapez un nom unique, par ex. **Scriptor**, **StudioRoman Backup**, etc. Si le nom est déjà pris, Dropbox vous le dira — changez légèrement le nom.
5. Cochez la case d’acceptation des conditions (Terms of Service).
6. Cliquez sur **« Create app »**.

Vous êtes redirigé vers la **page de votre application** : c’est votre « tableau de bord » pour cette app.

---

## Étape 3 — Repérer les onglets de l’application

En haut de la page de l’app, vous voyez en général des onglets du type :

| Onglet (souvent en anglais) | À quoi ça sert |
|-----------------------------|----------------|
| **Settings** | Clé de l’app, OAuth 2, redirections — **le plus important pour Scriptor** |
| **Permissions** | Autorisations (lecture/écriture de fichiers) |
| **Branding** (optionnel) | Logo, nom affiché — pas obligatoire pour nos tests |

Cliquez sur **Settings** si ce n’est pas déjà l’onglet affiché.

---

## Étape 4 — Copier l’App key (clé à mettre dans le `.env`)

1. Dans **Settings**, section du haut ou **« App key »** :
   - Vous voyez **App key** : une longue chaîne de caractères (ex. alphanumérique).
   - À côté, un bouton **« Copy »** ou une icône de copie — cliquez pour **copier** la clé.
2. Cette valeur est celle que vous placerez dans le fichier **`.env`** du projet, sous la forme :
   ```env
   VITE_DROPBOX_APP_KEY=collage_de_la_clé_ici
   ```
   (Sans espace autour du `=`.)

**Note :** L’**App secret** sert à des flux serveur ; pour Scriptor en mode public + PKCE, on utilise surtout l’**App key** dans la doc fournie avec le projet. Ne partagez pas votre App secret publiquement.

---

## Étape 5 — Configurer OAuth 2 — Redirect URIs (indispensable)

Sans cette étape, Dropbox affichera **Invalid redirect_uri** quand vous cliquerez sur « Connecter Dropbox » dans Scriptor.

1. Toujours dans **Settings**, faites défiler jusqu’à la section **« OAuth 2 »**.
2. Repérez **« Redirect URIs »** (ou « Redirect URIs for OAuth 2 »).
3. Cliquez sur **« Add »** pour chaque adresse à autoriser. Collez **une URI par ligne**, puis validez selon l’interface (parfois un petit **Add** à côté du champ).

Ajoutez au minimum selon votre usage :

| URI | Usage typique |
|-----|----------------|
| `http://localhost:5173/` | Développement web (`npm run dev` dans le navigateur) |
| `http://localhost:14230/` | Application bureau en développement (Tauri) |
| `http://127.0.0.1:17863/` | Connexion Dropbox ouverte dans le **navigateur** depuis l’app bureau (connexion Google sur dropbox.com) |

**Règles d’or :**

- Dropbox compare **caractère par caractère** : `http` vs `https`, `localhost` vs `127.0.0.1`, le **port** (5173, 14230, 17863), et souvent le **slash final** `/`.
- Si une ligne ne « prend » pas, vérifiez qu’il n’y a pas d’espace en trop ou de guillemets.

4. En bas de la page **Settings**, cliquez sur **« Submit »** (ou **Save**) pour **enregistrer** les changements. **Sans Submit, les URI ne sont pas enregistrées.**

---

## Étape 6 — Permissions (écriture des fichiers)

1. Cliquez sur l’onglet **« Permissions »**.
2. Cochez au minimum les autorisations liées aux fichiers, par exemple :
   - **files.metadata.write** (métadonnées)
   - **files.content.write** (contenu des fichiers)
3. Enregistrez avec **« Submit »** si le site le propose.

Sans ces permissions, l’app pourrait se connecter mais **échouer** à l’envoi du fichier de sauvegarde.

---

## Étape 7 — Accès implicite (optionnel)

Toujours dans **Settings**, section **OAuth 2**, si vous voyez une option du type **« Allow implicit grant »** :

- Pour les flux décrits dans la doc Scriptor / Studio Roman, vous pouvez l’**activer** si la doc du projet le recommande ; sinon laissez par défaut et testez d’abord sans.

---

## Étape 8 — Vérifier que tout est enregistré

1. Rechargez la page **Settings** (F5) et vérifiez que vos **Redirect URIs** sont toujours listées.
2. Ouvrez votre **`.env`** dans le projet `scriptor` et vérifiez **`VITE_DROPBOX_APP_KEY=`** avec la bonne App key.
3. Redémarrez l’app (`npm run dev` ou `npm run dev:tauri` selon votre cas), puis testez **Connecter Dropbox** dans **Sauvegarde & sécurité**.

---

## Dépannage sur le site Dropbox

| Problème | Piste |
|----------|--------|
| Je ne vois pas **Create app** | Connectez-vous ; essayez un autre navigateur ou désactivez les bloqueurs de pub le temps de la config. |
| **Invalid redirect_uri** | Une URI manque ou diffère (slash, port, `127.0.0.1` vs `localhost`). Reprenez l’étape 5. |
| Le nom d’app est refusé | Le nom est déjà pris ; ajoutez un suffixe (ex. `Scriptor-2026`). |
| J’ai modifié les URI mais ça ne change rien | Avez-vous cliqué sur **Submit** en bas de **Settings** ? |

---

## Liens utiles

- Liste de vos apps : [https://www.dropbox.com/developers/apps](https://www.dropbox.com/developers/apps)
- Documentation **OAuth 2** Dropbox (anglais) : [https://www.dropbox.com/developers/documentation/http/documentation#authorization](https://www.dropbox.com/developers/documentation/http/documentation#authorization)

Pour le détail **Studio Roman** (fichier `.env`, ports, app Tauri), voir aussi **[CONFIGURATION-CLES.md](./CONFIGURATION-CLES.md)** et, pour le flux bureau + navigateur, **[TUTORIEL-DROPBOX-APP-BUREAU.md](./TUTORIEL-DROPBOX-APP-BUREAU.md)**.
