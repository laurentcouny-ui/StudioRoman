CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom VARCHAR(255),
    role VARCHAR(255),
    description TEXT,
    statut VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS bible_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fiche VARCHAR(255),
    section VARCHAR(255),
    paragraphe INTEGER NOT NULL,
    contenu TEXT
);
