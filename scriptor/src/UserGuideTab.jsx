/**
 * Notice utilisateur : vue d’ensemble des fonctionnalités Scriptor.
 * (Contenu rédigé pour un auteur, pas pour un développeur.)
 */
export default function UserGuideTab() {
  return (
    <div className="user-guide">
      <header className="user-guide-hero">
        <h1 className="user-guide-title">Guide d&apos;utilisation</h1>
        <p className="user-guide-lead">
          Scriptor est un <strong>studio pour sagas romanesques</strong> : structure (tomes, chapitres,
          scènes), fiches personnages, bible narrative, chronologie, carte, exports pour éditeur,
          sauvegardes et outils d&apos;aide à l&apos;écriture. Vos textes sont enregistrés dans le
          navigateur ; pensez aux sauvegardes cloud et fichiers pour ne rien perdre.
        </p>
        <p className="user-guide-hero-actions">
          <button
            type="button"
            className="user-guide-replay-tour-btn"
            onClick={() =>
              window.dispatchEvent(new CustomEvent('scriptor-replay-corrector-tour'))
            }
          >
            Rejouer la visite guidée du correcteur
          </button>
        </p>
      </header>

      <nav className="user-guide-toc" aria-label="Sommaire">
        <h2 className="user-guide-toc-title">Sommaire</h2>
        <ol className="user-guide-toc-list">
          <li>
            <a href="#guide-sidebar">Panneau gauche : sagas et navigation</a>
          </li>
          <li>
            <a href="#guide-dashboard">Tableau de bord</a>
          </li>
          <li>
            <a href="#guide-writing">Écriture</a>
          </li>
          <li>
            <a href="#guide-ia">Scriptor IA — installation, Ollama, multi-utilisateurs</a>
          </li>
          <li>
            <a href="#guide-bible">Bible</a>
          </li>
          <li>
            <a href="#guide-characters">Personnages</a>
          </li>
          <li>
            <a href="#guide-timeline">Chronologie</a>
          </li>
          <li>
            <a href="#guide-worldmap">Carte du monde</a>
          </li>
          <li>
            <a href="#guide-publisher">Export</a>
          </li>
          <li>
            <a href="#guide-import">Import</a>
          </li>
          <li>
            <a href="#guide-backup">Sauvegardes</a>
          </li>
          <li>
            <a href="#guide-pwa">Installer l&apos;application (PWA)</a>
          </li>
          <li>
            <a href="#guide-options">Options avancées (.env)</a>
          </li>
          <li>
            <a href="#guide-corrector-1">Correcteur — Comprendre</a>
          </li>
          <li>
            <a href="#guide-corrector-2">Correcteur — Personnaliser</a>
          </li>
          <li>
            <a href="#guide-corrector-3">Correcteur — Bible</a>
          </li>
          <li>
            <a href="#guide-corrector-4">Correcteur — Analyse profonde</a>
          </li>
          <li>
            <a href="#guide-corrector-5">Correcteur — IA premium et clés API</a>
          </li>
          <li>
            <a href="#guide-corrector-6">Correcteur — Mode Expert</a>
          </li>
          <li>
            <a href="#guide-corrector-7">Correcteur — FAQ</a>
          </li>
        </ol>
      </nav>

      <section id="guide-sidebar" className="user-guide-section">
        <h2>Panneau gauche : sagas et navigation</h2>
        <ul>
          <li>
            <strong>Sagas</strong> : liste de vos sagas. Cliquez pour en sélectionner une ; le bouton{' '}
            <strong>+ Nouvelle saga</strong> en crée une autre.
          </li>
          <li>
            <strong>Saga en cours</strong> : titre éditable directement dans le champ. Le bouton rouge
            supprime <em>toute</em> la saga (action irréversible après confirmation).
          </li>
          <li>
            <strong>Tomes</strong> : chaque ligne est le titre d&apos;un tome ; cliquez une ligne pour
            travailler dans ce tome (structure des chapitres à l&apos;écran Écriture). Ajoutez un tome
            avec <strong>+ Nouveau tome</strong> ; supprimez le tome sélectionné si besoin (avec
            confirmation).
          </li>
          <li>
            Les <strong>onglets</strong> sous ces blocs ouvrent les modules (Tableau de bord, Écriture,
            Bible, etc.).
          </li>
          <li>
            En bas : pastille <strong>Sauvegarde</strong> (OK / dégradée / critique) — cliquez pour
            ouvrir <strong>Sauvegarde &amp; sécurité</strong>. À côté : total des <strong>mots</strong>{' '}
            de la saga en cours.
          </li>
        </ul>
      </section>

      <section id="guide-dashboard" className="user-guide-section">
        <h2>Tableau de bord</h2>
        <p>Résumé de la saga sélectionnée :</p>
        <ul>
          <li>
            <strong>Statistiques</strong> : mots totaux, nombre de tomes, chapitres, scènes, personnages.
          </li>
          <li>
            <strong>Progression par tome</strong> : barres comparatives du volume de texte par tome.
          </li>
          <li>
            <strong>Objectif de mots</strong> : fixez un objectif global pour la saga ; une barre
            indique la progression.
          </li>
          <li>
            <strong>Temps d&apos;écriture</strong> : compteur du jour ; boutons pour démarrer / arrêter
            une session (le temps de la session s&apos;ajoute au total du jour, stocké localement).
          </li>
        </ul>
      </section>

      <section id="guide-writing" className="user-guide-section">
        <h2>Écriture</h2>
        <p>L&apos;écran est divisé en trois zones principales (quatre avec le panneau latéral ouvert).</p>

        <h3>Structure (colonne de gauche)</h3>
        <ul>
          <li>Arborescence <strong>Tome → Chapitres → Scènes</strong>.</li>
          <li>
            <strong>Glisser-déposer</strong> (poignées ⋮⋮) : réordonner chapitres et scènes dans le
            tome courant.
          </li>
          <li>
            Titres de chapitres et de scènes modifiables ; boutons pour supprimer chapitre ou scène
            (avec confirmation).
          </li>
          <li>
            <strong>+ Nouveau chapitre</strong> et <strong>+ Nouvelle scène</strong> (scène ajoutée au
            chapitre où vous vous trouvez).
          </li>
        </ul>

        <h3>Éditeur central</h3>
        <ul>
          <li>
            <strong>Titre de la scène</strong>, <strong>point de vue</strong> (qui « narre »),
            <strong> statut</strong> (brouillon, à réviser, terminé).
          </li>
          <li>
            <strong>Compteur de mots</strong> pour la scène affichée.
          </li>
          <li>
            <strong>Personnages présents dans la scène</strong> : liste déroulante pour en ajouter ;
            pastilles cliquables pour ouvrir la fiche personnage ; × pour retirer de la scène.
          </li>
          <li>
            <strong>Résumé interne</strong> : notes pour vous, <em>non incluses</em> dans les exports
            manuscrit standards.
          </li>
          <li>
            <strong>Barres d&apos;outils</strong> : mise en forme (gras, italique, souligné,
            alignements, couleur du texte), taille de police, interligne, choix de police (Lora /
            Crimson / EB Garamond).
          </li>
          <li>
            <strong>Correcteur (LanguageTool)</strong> : clic droit sur un mot pour propositions de
            correction, ajout au dictionnaire personnel si besoin. Nécessite une connexion Internet
            (service externe).
          </li>
          <li>
            <strong>Correcteur avancé (modes + analyse)</strong> : dans la barre « Correcteur silencieux »,
            choisissez un mode (Simple, Simple strict, Expert), lancez <strong>Analyser</strong>, puis
            appliquez une correction ciblée ou « suggestions sûres ». Après une modification du texte,
            <strong>Réanalyser</strong> met à jour le rapport et l&apos;empreinte utilisée pour détecter les
            suggestions obsolètes.
          </li>
          <li>
            <strong>Raccourcis corrections d&apos;analyse</strong> :{' '}
            <code>Ctrl + Alt + Z</code> annule la dernière application issue du rapport,{' '}
            <code>Ctrl + Alt + Y</code> la rétablit (historique par scène, pendant la session).
          </li>
          <li>
            Le choix <strong>Masquer / afficher les suggestions obsolètes</strong> est mémorisé sur cet
            appareil (stockage local du navigateur).
          </li>
        </ul>

        <h3>Mode focus</h3>
        <p>
          Masque le panneau de structure pour vous concentrer sur le texte. Un bouton permet d&apos;en
          sortir. Le panneau latéral IA / thésaurus est aussi masqué en mode focus.
        </p>

        <h3>Panneau « IA / Thésaurus » (droite)</h3>
        <ul>
          <li>
            Bouton <strong>Panneau</strong> dans l&apos;en-tête de l&apos;éditeur pour ouvrir ou fermer.
          </li>
          <li>
            <strong>Thésaurus narratif</strong> (local, sans serveur) : recherche par phrase libre ;
            pistes par familles (émotions, conflits, lieux, etc.) ; cartes dépliables. Option « Pas la
            bonne famille ? » pour recadrer la recherche.
          </li>
          <li>
            <strong>Iframe thésaurus externe</strong> (optionnel) : si une URL est configurée, elle
            s&apos;affiche au-dessus du thésaurus intégré.
          </li>
          <li>
            <strong>SCRIPTOR IA</strong> : outils connectés à une <strong>API locale</strong> (résumé,
            page blanche, défis, carte, style, etc.). Tout le détail — installation, Ollama, messages
            d&apos;erreur, usage à plusieurs — est dans le chapitre{' '}
            <a href="#guide-ia">Scriptor IA — installation, Ollama, multi-utilisateurs</a>.
          </li>
        </ul>
      </section>

      <section id="guide-ia" className="user-guide-section">
        <h2>Scriptor IA — installation, Ollama, multi-utilisateurs</h2>
        <p>
          Ce chapitre explique <strong>comment l&apos;intelligence artificielle est branchée</strong> dans
          Scriptor, ce que vous devez installer sur <strong>votre</strong> machine, et ce qu&apos;il faut
          retenir si vous travaillez seul, en équipe ou si vous distribuez l&apos;application.
        </p>

        <h3>Ce que fait l&apos;IA dans Scriptor</h3>
        <p>
          Les outils du panneau <strong>SCRIPTOR IA</strong> (côté écriture) s&apos;appuient sur un{' '}
          <strong>programme séparé</strong> : l&apos;API Scriptor (backend Java). Cette API assemble les
          consignes, lit vos données de projet lorsque c&apos;est nécessaire, et envoie des requêtes à un{' '}
          <strong>moteur de langage</strong> (souvent <strong>Ollama</strong> en local, ou un service
          cloud si vous y avez configuré des clés). Scriptor <strong>ne remplace pas</strong> votre
          créativité : il propose des relances, analyses ou synthèses selon les modules.
        </p>

        <h3>Les trois briques (à avoir en tête)</h3>
        <ol>
          <li>
            <strong>L&apos;interface Scriptor</strong> (navigateur ou PWA) — ce que vous voyez à
            l&apos;écran ; elle stocke surtout le projet dans le navigateur.
          </li>
          <li>
            <strong>L&apos;API Scriptor</strong> (application Java, port <code>8080</code> par défaut) —
            pont entre l&apos;interface et l&apos;IA ; gère aussi une petite base locale (personnages,
            bible côté serveur, etc.) selon la version.
          </li>
          <li>
            <strong>Le moteur IA</strong> — en mode « gratuit local », c&apos;est{' '}
            <strong>Ollama</strong> sur votre PC (<code>localhost</code>, port <code>11434</code> en
            général). Sans Ollama démarré, vous verrez des messages du type « Ollama local non démarré ».
          </li>
        </ol>
        <p>
          En développement, la commande <code>npm run dev</code> redirige les appels{' '}
          <code>/api/…</code> vers cette API sur <code>127.0.0.1:8080</code>. Si l&apos;API est arrêtée,
          le navigateur peut afficher des erreurs réseau ou un bandeau d&apos;indisponibilité ; le reste
          de Scriptor (écriture, exports, sauvegardes) fonctionne souvent quand même.
        </p>

        <h3>IA gratuite locale : installer et lancer Ollama</h3>
        <p>
          Ollama exécute des <strong>modèles open source</strong> sur votre machine (pas d&apos;abonnement
          obligatoire côté Ollama pour l&apos;usage de base). Chaque utilisateur qui veut ce mode doit
          l&apos;avoir sur <strong>son</strong> ordinateur.
        </p>
        <ol>
          <li>
            Téléchargez Ollama sur <strong>https://ollama.com/download</strong> et installez-le (Windows,
            macOS ou Linux).
          </li>
          <li>
            Lancez Ollama (au démarrage de Windows, une icône peut rester près de l&apos;horloge ; le
            service doit être actif).
          </li>
          <li>
            Ouvrez un terminal et installez au moins un modèle — le projet est souvent réglé sur{' '}
            <strong>mistral</strong> par défaut : <code>ollama pull mistral</code>
          </li>
          <li>
            Test rapide : <code>ollama run mistral</code> puis quittez ; si cela répond, le daemon
            fonctionne.
          </li>
        </ol>
        <p>
          Tant qu&apos;Ollama ne tourne pas ou que le modèle demandé n&apos;est pas téléchargé, les
          fonctionnalités IA peuvent échouer avec un message explicite — ce n&apos;est pas un bug de
          Scriptor à proprement parler, mais une étape d&apos;installation manquante.
        </p>

        <h3>Installer et lancer l&apos;API Scriptor (backend Java)</h3>
        <p>
          L&apos;interface seule ne suffit pas : il faut démarrer l&apos;API une fois par session de
          travail (sauf si votre distributeur vous fournit un raccourci ou un installateur tout-en-un).
        </p>
        <ol>
          <li>
            Installez un <strong>JDK</strong> (Java) récent et <strong>Maven</strong> si vous compilez
            depuis les sources (voir la documentation du dépôt ou votre administrateur).
          </li>
          <li>
            Dans un terminal, placez-vous dans le dossier <code>backend</code> du projet et lancez :{' '}
            <code>mvn spring-boot:run</code>
          </li>
          <li>
            Attendez la ligne indiquant que l&apos;application a <strong>démarré</strong> (souvent «
            Started … » sur le port 8080). Le terminal <strong>reste occupé</strong> : c&apos;est normal,
            le serveur tourne. Utilisez un <strong>autre</strong> terminal pour <code>npm run dev</code>{' '}
            ou pour d&apos;autres commandes. Pour arrêter l&apos;API : <kbd>Ctrl</kbd>+<kbd>C</kbd> dans
            ce terminal.
          </li>
          <li>
            Vérification : dans le navigateur, ouvrez{' '}
            <code>http://127.0.0.1:8080/api/health</code> — vous devriez voir le texte <code>ok</code>.
          </li>
        </ol>
        <p>
          Une <strong>base SQLite</strong> et des fichiers de configuration peuvent être créés automatiquement
          au premier lancement (chemins décrits dans la doc technique du dépôt). En cas d&apos;erreur au
          démarrage liée à la base, consultez les logs indiqués dans la console.
        </p>

        <h3>« Les autres se connectent-ils à mon PC pour l&apos;IA ? »</h3>
        <p>
          <strong>Non, pas dans la configuration standard.</strong> Ollama et l&apos;API Scriptor écoutent en
          général sur <strong>votre machine uniquement</strong> (<code>localhost</code>). Une autre
          personne, ailleurs, <strong>n&apos;utilise pas automatiquement</strong> votre Ollama ni votre
          API : pour l&apos;IA locale gratuite, <strong>chaque utilisateur</strong> doit installer Ollama
          (et le modèle) sur <strong>son</strong> poste et lancer <strong>son</strong> instance de l&apos;API
          si vous travaillez chacun depuis les sources.
        </p>
        <p>
          Partager votre IA depuis chez vous sur Internet exigerait une infrastructure dédiée, sécurisée
          et maintenue — ce n&apos;est <strong>pas</strong> ce que le mode développeur local fournit par
          défaut.
        </p>

        <h3>Autres modes : clés API (cloud)</h3>
        <p>
          Selon la version de Scriptor, les paramètres IA peuvent permettre de configurer des{' '}
          <strong>fournisseurs cloud</strong> (clés API). Dans ce cas, le modèle tourne chez le prestataire
          ; les conditions (coût, confidentialité, mentions légales) sont celles du fournisseur. Lisez
          toujours leur politique avant d&apos;y envoyer des extraits de manuscrit.
        </p>

        <h3>Dépannage rapide</h3>
        <ul>
          <li>
            <strong>« Ollama local non démarré »</strong> — Lancez Ollama ; vérifiez{' '}
            <code>ollama pull mistral</code> (ou le modèle configuré chez vous).
          </li>
          <li>
            <strong>Erreur réseau / API indisponible</strong> — L&apos;API Java est-elle lancée ? Test{' '}
            <code>/api/health</code>. Avec <code>npm run dev</code>, un code 502 indique souvent « rien
            n&apos;écoute sur le port 8080 ».
          </li>
          <li>
            <strong>Terminal « figé » après <code>mvn spring-boot:run</code></strong> — C&apos;est
            attendu : le serveur reste actif. Ouvrez un autre terminal pour le reste.
          </li>
        </ul>

        <h3>Version empaquetée ou en ligne</h3>
        <p>
          Si vous installez Scriptor via un <strong>installateur</strong> ou un <strong>hébergeur</strong>,
          la procédure peut regrouper l&apos;interface et l&apos;API : suivez alors la notice du
          distributeur. Le principe reste le même : sans moteur IA accessible (Ollama local ou service
          cloud configuré), les boutons IA ne pourront pas répondre.
        </p>
      </section>

      <section id="guide-bible" className="user-guide-section">
        <h2>Bible</h2>
        <p>
          Base de connaissance de votre univers : <strong>catégories</strong>, éventuellement{' '}
          <strong>sous-catégories</strong>, et <strong>entrées</strong> détaillées (texte, images).
          Création, édition et suppression d&apos;éléments ; navigation par pagination si la liste est
          longue. Tout est lié à la <strong>saga en cours</strong>.
        </p>
      </section>

      <section id="guide-characters" className="user-guide-section">
        <h2>Personnages</h2>
        <ul>
          <li>Fiches personnages avec champs éditables (selon le modèle choisi : standard, etc.).</li>
          <li>
            <strong>Photo</strong> : import d&apos;image ; possibilité de la retirer.
          </li>
          <li>Liste paginée si vous avez beaucoup de fiches.</li>
          <li>
            Les personnages peuvent être <strong>associés aux scènes</strong> depuis l&apos;onglet
            Écriture.
          </li>
        </ul>
      </section>

      <section id="guide-timeline" className="user-guide-section">
        <h2>Chronologie</h2>
        <p>
          Liste d&apos;<strong>événements</strong> datés ou ordonnés pour votre intrigue : ajout,
          modification, suppression. Liée à la saga en cours.
        </p>
      </section>

      <section id="guide-worldmap" className="user-guide-section">
        <h2>Carte du monde</h2>
        <ul>
          <li>
            Import d&apos;une <strong>image de carte</strong> pour votre monde.
          </li>
          <li>
            <strong>Lieux</strong> : fiches (nom, notes, etc.) rattachées à la saga ; ajout /
            suppression comme pour la chronologie.
          </li>
        </ul>
      </section>

      <section id="guide-publisher" className="user-guide-section">
        <h2>Export</h2>
        <ul>
          <li>
            <strong>Word (.docx)</strong> : manuscrit avec titres saga / tome / chapitre / scène et texte des
            scènes ; ouverture dans Word pour la mise en forme finale.
          </li>
          <li>
            <strong>HTML / .txt</strong> : mêmes contenus, pour conversion ou archivage.
          </li>
          <li>
            <strong>PDF</strong> : document A4 structuré ; <strong>couverture</strong> optionnelle en
            première page ; filigrane optionnel sur les pages suivantes.
          </li>
          <li>
            <strong>EPUB 3</strong> : livre numérique avec table des matières ; même couverture que le PDF
            si vous l’avez chargée ; filigrane optionnel sur les chapitres (pas sur la page couverture).
          </li>
          <li>
            <strong>Dossier éditeur</strong> : lettre, synopsis, note d&apos;intention, bio (sauvegardés
            par saga), plus export dossier complet en un .txt ; zone prévue pour brancher une base
            contraintes éditeur.
          </li>
        </ul>
      </section>

      <section id="guide-import" className="user-guide-section">
        <h2>Import</h2>
        <ul>
          <li>
            Collez du texte ou chargez un fichier <strong>.txt</strong>.
          </li>
          <li>
            <strong>Analyser la structure</strong> : détection des chapitres (lignes du type « Chapitre 1
            », « Chapitre : Titre », « ## Titre », etc.).
          </li>
          <li>
            L&apos;import crée un <strong>nouveau tome</strong> dans la <strong>saga en cours</strong> avec
            les chapitres détectés — vérifiez la prévisualisation avant de valider.
          </li>
        </ul>
      </section>

      <section id="guide-backup" className="user-guide-section">
        <h2>Sauvegardes</h2>

        <h3>Sauvegarde locale (onglet dédié)</h3>
        <ul>
          <li>
            <strong>Télécharger</strong> un fichier JSON complet du projet.
          </li>
          <li>
            <strong>Restaurer</strong> depuis un fichier — remplace le projet actuel dans le navigateur.
          </li>
          <li>
            Renvoie vers <strong>Sauvegarde &amp; sécurité</strong> pour la stratégie complète.
          </li>
        </ul>

        <h3>Sauvegarde &amp; sécurité</h3>
        <ul>
          <li>
            <strong>Niveau 1 — Navigateur / bureau</strong> : en dev navigateur, le projet vit surtout dans
            le <strong>localStorage</strong> (quota limité). Dans l&apos;application <strong>Windows
            (Tauri)</strong>, le même flux est <strong>reproduit sur le disque</strong> (dossier de données
            de l&apos;app) : le roman peut dépasser le plafond du cache WebView tout en restant sur le PC.
          </li>
          <li>
            <strong>Niveau 2 — Cloud</strong> : connexion <strong>Google Drive</strong> et/ou{' '}
            <strong>Dropbox</strong> (compte personnel) ; envoi automatique périodique d&apos;une
            sauvegarde complète. Option de <strong>chiffrement</strong> avec une phrase secrète (à ne pas
            oublier). Bouton <strong>Envoyer maintenant</strong> pour forcer l&apos;upload.
          </li>
          <li>
            <strong>Niveau 3 — Fichier</strong> : téléchargement d&apos;un JSON sur votre disque, clé
            USB, etc.
          </li>
          <li>
            <strong>Bandeau d&apos;alerte</strong> en haut de l&apos;écran en cas d&apos;erreur cloud ou
            d&apos;échec d&apos;écriture dans le <strong>localStorage</strong> du navigateur (quota souvent
            ~5–10 Mo par site, indépendant de l&apos;espace disque) ; exportez un JSON puis libérez des
            clés <code>scriptor-*</code> si besoin (F12 → Stockage).
          </li>
          <li>
            <strong>Copie de secours navigateur</strong> : Scriptor maintient aussi une clé interne{' '}
            <code>scriptor-project-v1.last-known-good</code> (copie du dernier projet valide) pour limiter
            les écrasements accidentels par un projet « tout neuf ». Ce n&apos;est pas un substitut aux
            sauvegardes fichier ou cloud : exportez régulièrement un JSON.
          </li>
        </ul>
        <p>
          La configuration des clés API (Google / Dropbox) est décrite dans{' '}
          <strong>CONFIGURATION-CLES.md</strong> à la racine du dossier <code>scriptor</code>.
        </p>
        <p>
          Si tout semble avoir disparu (bible, chapitres, personnages) : vérifiez d&apos;abord le
          fichier cloud <code>scriptor-backup-latest.json</code> (Google Drive / Dropbox) ou un export
          manuel <code>scriptor-backup-… .json</code> à restaurer via <strong>Sauvegarde locale</strong>. En dernier recours, un utilisateur avancé peut ouvrir les
          outils développeur du navigateur (F12) → onglet <strong>Stockage</strong> / <strong>Local
          storage</strong> et chercher les clés commençant par <code>scriptor-project</code> ou une
          sauvegarde <code>…unreadable-raw-backup</code> si une mise à jour a échoué au décodage.
        </p>
      </section>

      <section id="guide-pwa" className="user-guide-section">
        <h2>Installer l&apos;application (PWA)</h2>
        <p>
          Scriptor peut être <strong>installé</strong> comme une application (bureau ou mobile) : selon
          le navigateur, utilisez le menu « Installer l&apos;application » ou l&apos;icône dans la barre
          d&apos;adresse. Utile pour lancer Scriptor sans chercher l&apos;URL à chaque fois. En
          production, déployez l&apos;app en HTTPS pour une installation fiable.
        </p>
      </section>

      <section id="guide-options" className="user-guide-section">
        <h2>Options avancées (fichier .env)</h2>
        <p>
          Pour les personnes qui configurent l&apos;app (développement ou déploiement), un fichier{' '}
          <code>.env</code> peut définir :
        </p>
        <ul>
          <li>
            <code>VITE_ENABLE_AI_PANEL=0</code> — désactiver le bloc IA du panneau latéral.
          </li>
          <li>
            <code>VITE_ENABLE_THESAURUS=0</code> — désactiver le thésaurus narratif intégré.
          </li>
          <li>
            <code>VITE_THESAURUS_IFRAME_URL=…</code> — URL d&apos;un thésaurus externe en iframe.
          </li>
          <li>Clés Google / Dropbox pour la sauvegarde cloud (voir <code>.env.example</code>).</li>
        </ul>
        <p>Les utilisateurs finaux qui utilisent seulement l&apos;app en ligne n&apos;ont souvent pas à y toucher.</p>
      </section>

      <section id="guide-corrector-1" className="user-guide-section">
        <h2>Correcteur — Comprendre</h2>
        <p>
          Le correcteur Scriptor combine <strong>LanguageTool</strong> (ou équivalent local), une{' '}
          <strong>base linguistique maison</strong> (lexique, formes, corpus) et, pour certaines zones
          d&apos;incertitude, un <strong>arbitre</strong> (pistes optionnelles). Il ne réécrit pas votre
          roman : il signale des problèmes mécaniques et de cohérence, avec des modes de discrétion (Simple,
          Simple strict, Expert).
        </p>
        <p>
          Les soulignements après <strong>Analyser</strong> respectent le mode choisi ; en Simple strict,
          aucun surlignement n&apos;apparaît avant l&apos;analyse explicite.
        </p>
      </section>

      <section id="guide-corrector-2" className="user-guide-section">
        <h2>Correcteur — Personnaliser</h2>
        <ul>
          <li>
            <strong>Mode</strong> et <strong>délai de grâce</strong> (barre « Correcteur silencieux » sous
            l&apos;éditeur) : stockage local du navigateur.
          </li>
          <li>
            <strong>Confiance absolue</strong> : n&apos;affiche que les alertes très sûres (pas d&apos;arbitre
            sur le flou).
          </li>
          <li>
            <strong>Dictionnaire utilisateur</strong> (clic droit) et <strong>C&apos;est mon style</strong>{' '}
            (livre ou dialogues) pour alimenter la mémoire d&apos;intention du projet.
          </li>
        </ul>
      </section>

      <section id="guide-corrector-3" className="user-guide-section">
        <h2>Correcteur — Bible</h2>
        <p>
          Les entrées <strong>personnages et lieux</strong> de la Bible du projet nourrissent le dictionnaire
          contextuel. Si deux graphies coexistent pour un même nom, une alerte de cohérence (souvent en
          indicateur visuel distinct) peut apparaître — ce n&apos;est pas une faute de grammaire générique.
        </p>
      </section>

      <section id="guide-corrector-4" className="user-guide-section">
        <h2>Correcteur — Analyse profonde</h2>
        <p>
          Le bouton <strong>Analyser</strong> lance la passe complète sur le <strong>texte de la scène
          courante</strong> : rapports, filtre par focus (grammaire, orthographe, etc.), navigation une
          alerte à la fois, score sur les fautes « certaines », certificat de propreté mécanique avec
          message de limitation obligatoire.
        </p>
      </section>

      <section id="guide-corrector-5" className="user-guide-section">
        <h2>Correcteur — IA premium et clés API</h2>
        <p>
          Les clés <strong>Claude, Gemini ou ChatGPT</strong> (si votre build les prévoit) servent à des{' '}
          <strong>explications ou pistes sur demande</strong>, pas à imposer des corrections automatiques.
        </p>
        <p>
          <strong>Tutoriel (placeholder)</strong> : ajoutez les clés dans les paramètres avancés de votre
          déploiement ; vérifiez que les appels sortants sont autorisés par votre réseau. Les captures
          d&apos;écran peuvent compléter ce paragraphe lorsque l&apos;UI est figée.
        </p>
      </section>

      <section id="guide-corrector-6" className="user-guide-section">
        <h2>Correcteur — Mode Expert</h2>
        <p>
          Le mode <strong>Expert</strong> affiche davantage de niveaux de confiance, d&apos;indices de
          style informatifs et le détail « Pourquoi ? » enrichi (sources, scores). Les alertes de style
          restent <strong>non imposées</strong> : vous décidez des corrections.
        </p>
      </section>

      <section id="guide-corrector-7" className="user-guide-section">
        <h2>Correcteur — FAQ</h2>
        <ul>
          <li>
            <strong>Pourquoi rien ne se souligne avant « Analyser » ?</strong> Selon le mode (ex. Simple
            strict), c&apos;est voulu pour limiter le bruit visuel.
          </li>
          <li>
            <strong>Le texte a changé depuis l&apos;analyse</strong> : relancez <strong>Analyser</strong>{' '}
            pour un rapport à jour.
          </li>
          <li>
            <strong>« Voir une piste » est vide</strong> : les pistes distantes nécessitent une clé API
            configurée ; sinon un message l&apos;indique.
          </li>
        </ul>
      </section>

      <footer className="user-guide-footer">
        <p>
          <strong>Scriptor</strong> — Studio pour sagas romanesques. En cas de blocage, vérifiez la
          connexion réseau (correcteur), l&apos;installation IA (chapitre{' '}
          <a href="#guide-ia">Scriptor IA</a>), l&apos;espace disque du navigateur, et gardez au moins une
          sauvegarde fichier ou cloud à jour.
        </p>
      </footer>
    </div>
  )
}
