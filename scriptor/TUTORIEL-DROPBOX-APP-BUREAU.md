# Tutoriel — Connecter Dropbox depuis l’application bureau (Studio Roman / Scriptor)

Ce tutoriel explique comment relier **Dropbox** à l’app **Windows** lancée avec Tauri (`npm run dev:tauri` ou l’installateur), y compris quand vous vous connectez à Dropbox avec **Google** (« Continuer avec Google »).

Pour tout ce qui se passe **sur le site Dropbox** (créer l’app, copier l’App key, ajouter les Redirect URIs dans la console), utilisez le pas à pas **[TUTORIEL-SITE-DROPBOX.md](./TUTORIEL-SITE-DROPBOX.md)**. Vous pouvez aussi vous appuyer sur la partie **B** de **[CONFIGURATION-CLES.md](./CONFIGURATION-CLES.md)**. Ici, on suppose que vous avez déjà une **App key** et un fichier **`.env`** dans le dossier `scriptor`.

---

## 1. Pourquoi une étape en plus pour l’app bureau ?

Dans la fenêtre intégrée de l’application (**WebView**), Google bloque souvent le bouton **« Se connecter avec Google »** sur le site Dropbox.  
L’app ouvre donc la connexion Dropbox dans votre **navigateur par défaut** (Chrome, Edge, etc.), où cette connexion fonctionne.  
Après autorisation, Dropbox renvoie le navigateur vers une petite adresse locale : **`http://127.0.0.1:17863/`**. Il faut que cette adresse soit **autorisée** dans la console Dropbox.

---

## 2. Ajouter les adresses de redirection (Redirect URIs) dans Dropbox

1. Ouvrez **[Dropbox — Applications](https://www.dropbox.com/developers/apps)** et connectez-vous.
2. Cliquez sur **votre application** Scriptor / Studio Roman.
3. Allez dans l’onglet **Settings** (Paramètres).
4. Descendez jusqu’à la section **OAuth 2**.
5. Sous **Redirect URIs**, ajoutez **chaque** ligne ci-dessous avec le bouton **Add** (une URI par ajout), puis enregistrez avec **Submit** en bas de page.

| URI à ajouter | À quoi ça sert |
|---------------|----------------|
| `http://localhost:5173/` | Développement dans le **navigateur seul** (`npm run dev`). |
| `http://localhost:14230/` | Ancienne redirection possible depuis la **fenêtre** de l’app en dev Tauri. |
| **`http://127.0.0.1:17863/`** | **Connexion Dropbox ouverte dans le navigateur** depuis l’app bureau (flux actuel avec Google). |

**Important :** la chaîne doit être **exactement** comme ci-dessus, avec le **`/`** à la fin pour ces exemples. Dropbox est sensible à la moindre différence (`http` vs `https`, `localhost` vs `127.0.0.1`, port, slash final).

---

## 3. Vérifier le fichier `.env`

Dans le dossier **`scriptor`**, votre fichier **`.env`** doit contenir au minimum :

```env
VITE_DROPBOX_APP_KEY=votre_app_key_ici
```

Sans valeur après `=`, la connexion est refusée. Après toute modification du `.env`, **redémarrez** la commande `npm run dev:tauri`.

---

## 4. Lancer l’app et connecter Dropbox

1. Dans un terminal, à la racine du projet (ou depuis `scriptor` selon votre README), lancez :  
   `npm run dev:tauri`  
   (ou la commande équivalente indiquée pour Studio Roman.)
2. Dans l’application, ouvrez **Sauvegarde & sécurité** (ou l’onglet équivalent).
3. Cliquez sur **Connecter Dropbox**.

**Ce qui se passe :**

- Une fenêtre du **navigateur par défaut** s’ouvre sur la page Dropbox / OAuth.
- Connectez-vous à Dropbox (**e-mail + mot de passe** ou **Continuer avec Google** — ce dernier fonctionne ici, dans le navigateur).
- Acceptez les autorisations demandées par Dropbox.
- Le navigateur affiche une courte page **« Connexion réussie »** sur `127.0.0.1:17863`. Vous pouvez fermer cet onglet.
- Revenez dans **Studio Roman** : le statut Dropbox doit passer à **connecté**.

---

## 5. Si ça ne fonctionne pas

### Message **Invalid redirect_uri** (Dropbox)

- Vérifiez dans la console Dropbox que **`http://127.0.0.1:17863/`** est bien ajouté (voir section 2).
- Vérifiez qu’il n’y a pas d’espace en trop copié-collé.

### Le navigateur ne revient pas ou erreur sur le port

- Un autre programme peut occuper le port **17863**. Fermez les autres instances de l’app ou redémarrez le PC si besoin, puis réessayez.
- Relancez `npm run dev:tauri` après avoir corrigé le `.env`.

### La fenêtre « Connexion réussie » s’affiche mais l’app reste déconnectée

- Attendez quelques secondes ; si rien ne change, fermez l’app et rouvrez-la, puis refaites **Connecter Dropbox**.
- Regardez la console de l’app (outils de développement si disponibles) pour un message d’erreur OAuth.

### Vous préférez ne pas utiliser Google sur Dropbox

- Sur la page Dropbox dans le navigateur, utilisez **e-mail et mot de passe Dropbox** si votre compte le permet (compte créé avec e-mail, ou mot de passe défini dans les paramètres Dropbox).

---

## 6. Aller plus loin

- **Google Drive** dans la même app : voir **[CONFIGURATION-CLES.md](./CONFIGURATION-CLES.md)** (URI `localhost:14230`, clé Google, etc.).
- **Sauvegarde uniquement dans le navigateur** (`npm run dev` sans Tauri) : pas besoin de `127.0.0.1:17863` pour Dropbox si vous n’utilisez que le flux web classique ; les URI `localhost:5173` suffisent en général.

---

*Dernière mise à jour : tutoriel aligné sur le flux OAuth Dropbox « navigateur système » + callback `http://127.0.0.1:17863/` pour l’app Tauri.*
