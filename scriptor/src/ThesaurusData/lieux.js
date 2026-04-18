const lieux = [
  {
    id: "maison-enfance",
    label: "Maison d'enfance",
    type: "lieu-symbolique",
    chargeNarrative: "haute",
    definitionCourte:
      "Lieu des premières empreintes, où le monde a été découvert pour la première fois. Il est rarement neutre : il porte tout ce qui a fondé ou blessé.",
    fonctionsNarratives: [
      "révéler l'origine d'une blessure ou d'une force",
      "ancrer un retour impossible ou douloureux",
      "contraster le passé idéalisé avec le présent",
      "déclencher des souvenirs involontaires",
      "incarner la perte de l'innocence",
    ],
    variantes: [
      { type: "maison heureuse retrouvée", effet: "mélancolie douce, nostalgie bienveillante" },
      { type: "maison traumatique", effet: "angoisse, refus du corps à entrer" },
      { type: "maison détruite ou transformée", effet: "deuil d'identité, sentiment d'effacement" },
      { type: "maison de l'autre", effet: "fascination, envie, sentiment d'exclusion" },
    ],
    piègesToEviter: [
      "La décrire comme simplement 'belle' ou 'triste' sans ancrage sensoriel",
      "Oublier que la maison a vieilli : les personnages la voient plus petite qu'ils ne s'en souviennent",
    ],
    notesEditoriales: [
      "La maison d'enfance fonctionne mieux quand elle est décalée — un détail a changé, et c'est ce détail qui porte tout.",
      "Le personnage qui refuse d'y retourner dit quelque chose d'essentiel sur ce qu'il refuse d'affronter.",
    ],
  },
  {
    id: "ville-natale",
    label: "Ville natale",
    type: "lieu-symbolique",
    chargeNarrative: "haute",
    definitionCourte:
      "La ville ou le village d'où l'on vient — territoire identitaire chargé d'appartenance, d'étouffement ou de honte selon le trajet du personnage.",
    fonctionsNarratives: [
      "révéler d'où vient vraiment le personnage, au-delà du biographique",
      "confronter l'identité construite avec l'identité d'origine",
      "exposer les jugements de l'entourage d'enfance",
      "incarner l'impossibilité de repartir à zéro",
      "servir de contraste avec le lieu de vie actuel",
    ],
    variantes: [
      { type: "retour après le succès", effet: "ambivalence entre fierté et malaise" },
      { type: "retour après l'échec", effet: "honte, regard des autres pesant" },
      { type: "fuite sans retour", effet: "deuil silencieux, identité fracturée" },
      { type: "ville idéalisée à distance", effet: "nostalgie protectrice qui résiste à la réalité" },
    ],
    piègesToEviter: [
      "Réduire à la province vs. la capitale — la tension peut être subtile et moins binaire",
      "Oublier que les autres personnages de ce lieu ont aussi vieilli et changé",
    ],
    notesEditoriales: [
      "La ville natale est souvent plus présente dans les non-dits que dans les descriptions.",
      "Elle existe dans la façon dont le personnage parle — ou évite de parler — de ses origines.",
    ],
  },
  {
    id: "lieu-crime",
    label: "Lieu d'un crime ou d'un accident",
    type: "lieu-charge",
    chargeNarrative: "haute",
    definitionCourte:
      "Espace où s'est produit un événement violent ou traumatisant. Il conserve une charge que les personnages qui l'ont vécu ne peuvent pas ignorer, même après des années.",
    fonctionsNarratives: [
      "forcer un retour sur l'événement passé",
      "matérialiser un trauma impossible à verbaliser",
      "créer une tension entre l'ordinaire du lieu et ce qui s'y est passé",
      "révéler comment chaque personnage traite le même événement différemment",
      "servir de déclencheur à un effondrement ou une révélation",
    ],
    variantes: [
      { type: "lieu transformé en mémorial", effet: "solennité, impossibilité d'oublier" },
      { type: "lieu banalisé par le temps", effet: "choc de l'indifférence du monde" },
      { type: "lieu habité par quelqu'un d'autre", effet: "sentiment d'irréalité, de profanation" },
      { type: "lieu que le personnage ne reconnaît plus", effet: "dissociation, perte de référence" },
    ],
    piègesToEviter: [
      "Traiter le lieu comme un simple décor au lieu d'une présence active",
      "Trop souligner le symbolisme — laisser la charge émerger du concret",
    ],
    notesEditoriales: [
      "Le lieu d'un crime fonctionne mieux en décalage : un détail banal (une fenêtre ouverte, une odeur) porte plus que la description de l'événement lui-même.",
    ],
  },
  {
    id: "lieu-travail-use",
    label: "Lieu de travail usé",
    type: "lieu-quotidien",
    chargeNarrative: "moyenne",
    definitionCourte:
      "Bureau, atelier, cuisine ou chantier où un personnage passe la majeure partie de sa vie sans l'avoir vraiment choisi — ou en l'ayant choisi mais en y perdant quelque chose.",
    fonctionsNarratives: [
      "incarner la routine comme enfermement ou comme sécurité",
      "montrer l'identité professionnelle qui déborde sur l'identité personnelle",
      "révéler les relations de pouvoir dans un groupe restreint",
      "servir de cadre à une crise qui ne peut plus être évitée",
      "contraster avec ce que le personnage voulait faire de sa vie",
    ],
    variantes: [
      { type: "lieu qu'on aime malgré tout", effet: "attachement silencieux, fierté discrète" },
      { type: "lieu qu'on déteste mais qu'on ne quitte pas", effet: "résignation, peur du dehors" },
      { type: "lieu perdu (licenciement, fermeture)", effet: "deuil d'identité, perte de cadre" },
    ],
    piègesToEviter: [
      "Le décrire de façon purement fonctionnelle — il doit dire quelque chose sur le personnage qui l'occupe",
    ],
    notesEditoriales: [
      "Le bureau d'un personnage révèle ce qu'il cache autant que ce qu'il montre — une photo retournée, un tiroir fermé à clé.",
    ],
  },
  {
    id: "lieu-rupture",
    label: "Lieu d'une rupture",
    type: "lieu-charge",
    chargeNarrative: "haute",
    definitionCourte:
      "L'endroit exact où une relation amoureuse, une amitié ou un lien familial s'est brisé. Il garde cette empreinte pour le personnage qui l'a vécu.",
    fonctionsNarratives: [
      "forcer le personnage à revivre sans le vouloir",
      "empêcher une réconciliation ou en rendre une possible",
      "matérialiser l'absence de l'autre",
      "servir de déclencheur involontaire à la mémoire émotionnelle",
      "révéler l'asymétrie du souvenir entre deux personnages",
    ],
    variantes: [
      { type: "lieu devenu banal pour l'autre", effet: "blessure de l'asymétrie émotionnelle" },
      { type: "lieu évité depuis des années", effet: "pouvoir du trauma, cartographie intérieure de la ville" },
      { type: "lieu revisité volontairement", effet: "tentative de clôture ou de compréhension tardive" },
    ],
    piègesToEviter: [
      "En faire un lieu dramatique en soi — la rupture peut avoir eu lieu dans un endroit absolument ordinaire, ce qui renforce sa puissance",
    ],
    notesEditoriales: [
      "L'endroit d'une rupture s'incruste souvent dans des détails absurdes : la chanson qui passait, l'odeur du café froid, la pluie contre la vitre.",
    ],
  },
  {
    id: "frontiere-passage",
    label: "Frontière ou poste de passage",
    type: "lieu-transition",
    chargeNarrative: "haute",
    definitionCourte:
      "Seuil symbolique autant que physique — douane, porte de prison, pont entre deux pays, portail d'hôpital. Le personnage qui le franchit n'est plus tout à fait le même de l'autre côté.",
    fonctionsNarratives: [
      "marquer un avant et un après dans le récit",
      "incarner l'irréversibilité d'une décision",
      "créer de la tension entre l'envie de passer et la peur de ce qui attend",
      "révéler qui passe librement et qui ne peut pas",
      "symboliser l'accès ou l'exclusion selon le statut du personnage",
    ],
    variantes: [
      { type: "franchissement réussi", effet: "soulagement mêlé de perte de ce qu'on laisse derrière" },
      { type: "franchissement refusé", effet: "humiliation, impuissance, rage froide" },
      { type: "retour en arrière depuis l'autre côté", effet: "nostalgie inversée, regret du passage" },
    ],
    piègesToEviter: [
      "Rendre le symbolisme trop explicite — la frontière fonctionne mieux quand elle est concrète d'abord",
    ],
    notesEditoriales: [
      "Les files d'attente aux frontières sont narrativement puissantes : elles créent un temps suspendu où tout peut arriver.",
      "La frontière intérieure — celle que le personnage ne franchit pas — est souvent plus intéressante que la frontière physique.",
    ],
  },
  {
    id: "cimetiere",
    label: "Cimetière",
    type: "lieu-symbolique",
    chargeNarrative: "haute",
    definitionCourte:
      "Lieu de la mort organisée et du deuil institutionnalisé. Il concentre l'absence et force chaque personnage à se confronter à sa propre finitude.",
    fonctionsNarratives: [
      "forcer une confrontation avec une perte",
      "révéler comment un personnage traite le deuil — ou l'évite",
      "servir de lieu de confidence : on parle parfois plus librement aux morts",
      "marquer un avant et un après dans un arc émotionnel",
      "incarner le temps long qui dépasse les individus",
    ],
    variantes: [
      { type: "cimetière abandonné", effet: "oubli, mémoire qui s'efface, mélancolie particulière" },
      { type: "cimetière d'enfants", effet: "insupportabilité amplifiée, injustice de la mort" },
      { type: "cimetière de guerre", effet: "culpabilité collective, poids de l'histoire" },
      { type: "visite de la tombe d'un ennemi", effet: "ambivalence complexe, impossible clôture" },
    ],
    piègesToEviter: [
      "Le réduire à un décor gothique — le cimetière ordinaire, de banlieue, sous la pluie froide, est souvent plus puissant",
    ],
    notesEditoriales: [
      "Ce qu'un personnage dit — ou ne dit pas — sur une tombe révèle plus que n'importe quelle scène de dialogue.",
    ],
  },
  {
    id: "hopital-service",
    label: "Service hospitalier (séjour prolongé)",
    type: "lieu-contrainte",
    chargeNarrative: "haute",
    definitionCourte:
      "Espace de dépendance et de vulnérabilité imposée — le personnage y perd le contrôle sur son corps, son temps et son espace personnel.",
    fonctionsNarratives: [
      "forcer un personnage à l'immobilité et à la réflexion",
      "inverser les rapports de force — le fort devient dépendant",
      "révéler qui vient rendre visite et qui n'y va pas",
      "créer un huis clos temporaire avec des inconnus forcés",
      "permettre une confession ou une révélation que la vie normale interdit",
    ],
    variantes: [
      { type: "personnage soignant", effet: "épuisement, attachement interdit, distance professionnelle" },
      { type: "personnage soigné", effet: "perte d'identité, régression, dépendance" },
      { type: "personnage visiteur", effet: "impuissance, culpabilité du bien-portant" },
    ],
    piègesToEviter: [
      "Réduire l'hôpital à l'urgence dramatique — le quotidien hospitalier long et ennuyeux est narrativement très riche",
    ],
    notesEditoriales: [
      "La chambre d'hôpital est l'un des rares espaces où les personnages ne peuvent pas fuir une conversation difficile.",
    ],
  },
  {
    id: "prison",
    label: "Prison (espace intérieur)",
    type: "lieu-contrainte",
    chargeNarrative: "haute",
    definitionCourte:
      "Espace de punition et de temps suspendu. La prison transforme ceux qui y entrent — gardiens comme détenus — par l'effet cumulatif de la contrainte institutionnelle.",
    fonctionsNarratives: [
      "priver un personnage de liberté pour révéler ce qui reste quand tout est enlevé",
      "explorer les hiérarchies informelles dans un espace fermé",
      "montrer ce que le temps long sans liberté fait à l'intérieur d'un être",
      "incarner la justice comme institution imparfaite et humaine",
      "servir de cadre à des alliances ou des trahisons extrêmes",
    ],
    variantes: [
      { type: "premier jour d'incarcération", effet: "choc du passage, perte de repères" },
      { type: "long séjour", effet: "adaptation inquiétante, désensibilisation progressive" },
      { type: "sortie après une longue peine", effet: "inadaptation au dehors, monde devenu étranger" },
    ],
    piègesToEviter: [
      "Ne montrer que la violence — l'ennui, la routine, la perte de sens sont souvent plus dévastateurs",
    ],
    notesEditoriales: [
      "La cellule partagée est un outil narratif puissant : deux personnes sans rien en commun, forcées à cohabiter.",
    ],
  },
  {
    id: "pays-etranger",
    label: "Pays étranger",
    type: "lieu-dépaysement",
    chargeNarrative: "moyenne",
    definitionCourte:
      "Territoire où les codes sont inconnus, où le personnage ne peut pas se fondre dans le décor — ce qui révèle ce qu'il est quand ses habitudes habituelles ne le soutiennent plus.",
    fonctionsNarratives: [
      "dépouiller le personnage de ses certitudes culturelles",
      "créer un isolement propice aux révélations et aux prises de risque",
      "incarner la solitude linguistique ou culturelle",
      "permettre une identité nouvelle, provisoire ou libératrice",
      "servir de miroir inversé sur son propre pays d'origine",
    ],
    variantes: [
      { type: "exil subi (guerre, politique)", effet: "deuil, désorientation, reconstruction forcée" },
      { type: "voyage volontaire", effet: "ouverture, mais aussi confrontation à ses propres limites" },
      { type: "expatrié installé depuis longtemps", effet: "appartenance à nul endroit, regard étranger sur tout" },
    ],
    piègesToEviter: [
      "Réduire au tourisme ou à l'exotisme — la profondeur narrative vient du dedans, pas du dehors",
    ],
    notesEditoriales: [
      "Le personnage qui ne parle pas la langue est dans une vulnérabilité constante — à exploiter narrativement.",
      "L'étranger est toujours aussi un état intérieur : certains personnages sont étrangers partout, même chez eux.",
    ],
  },
  {
    id: "lieu-secret",
    label: "Lieu secret personnel",
    type: "lieu-intime",
    chargeNarrative: "haute",
    definitionCourte:
      "Endroit que le personnage est seul à connaître, ou presque — un repli du monde où il s'est réfugié à des moments décisifs de sa vie.",
    fonctionsNarratives: [
      "révéler l'intériorité du personnage sans dialogue explicatif",
      "incarner le besoin de se cacher ou de se retrouver",
      "servir de refuge au moment d'une crise",
      "créer une tension quand ce lieu est découvert par un autre",
      "marquer la perte d'un refuge quand ce lieu disparaît",
    ],
    variantes: [
      { type: "lieu de l'enfance retrouvé", effet: "retour à une version antérieure de soi" },
      { type: "lieu construit à l'âge adulte", effet: "besoin de contrôle, résistance au monde" },
      { type: "lieu partagé avec un seul autre", effet: "lien d'une intensité particulière" },
    ],
    piègesToEviter: [
      "Le rendre trop romanesque — un placard sous l'escalier peut être un lieu secret aussi puissant qu'une grotte au bord de la mer",
    ],
    notesEditoriales: [
      "Ce que le personnage conserve ou fait dans son lieu secret dit l'essentiel de ce qu'il ne peut montrer nulle part ailleurs.",
    ],
  },
  {
    id: "cafe-du-quartier",
    label: "Café de quartier habituel",
    type: "lieu-quotidien",
    chargeNarrative: "moyenne",
    definitionCourte:
      "Tiers-lieu entre le chez-soi et le monde, ni privé ni vraiment public — espace de la routine et des habitudes, qui dit quelque chose de la vie ordinaire du personnage.",
    fonctionsNarratives: [
      "ancrer le personnage dans un quotidien concret",
      "créer des rencontres récurrentes sans forcer la coïncidence",
      "révéler la sociabilité ou l'isolement du personnage",
      "servir de lieu de confidence neutre",
      "marquer le temps qui passe dans la répétition",
    ],
    variantes: [
      { type: "café de la première fois", effet: "nostalgie d'un début, marqueur temporel fort" },
      { type: "café qu'on ne peut plus fréquenter", effet: "perte d'un ancrage, rupture de routine" },
      { type: "café inconnu d'une ville étrangère", effet: "solitude voyageuse, absence de repères" },
    ],
    piègesToEviter: [
      "Le décrire comme simple fond de scène — même un café ordinaire a un patron, des habitués, une lumière particulière à une certaine heure",
    ],
    notesEditoriales: [
      "La table habituelle d'un personnage est un détail révélateur : face à la porte ou dos au mur, vers la rue ou vers l'intérieur.",
    ],
  },
];

export default lieux;
