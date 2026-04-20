CREATE INDEX IF NOT EXISTS idx_characters_nom ON characters(nom);
CREATE INDEX IF NOT EXISTS idx_characters_role ON characters(role);

CREATE INDEX IF NOT EXISTS idx_bible_entries_fiche ON bible_entries(fiche);
CREATE INDEX IF NOT EXISTS idx_bible_entries_section ON bible_entries(section);
CREATE INDEX IF NOT EXISTS idx_bible_entries_paragraphe ON bible_entries(paragraphe);
