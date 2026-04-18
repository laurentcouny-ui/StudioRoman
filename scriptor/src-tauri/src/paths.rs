//! Chemins disque : dossier principal **Scriptor**, repli **BookNote** (installations existantes).

use std::path::{Path, PathBuf};

pub const DIR_SCRIPTOR: &str = "Scriptor";
pub const DIR_LEGACY: &str = "BookNote";

/// `Documents/Scriptor` si présent ou à créer ; sinon `Documents/BookNote` si déjà utilisé (migration).
pub fn documents_app_subdir(document_dir: &Path) -> PathBuf {
    let primary = document_dir.join(DIR_SCRIPTOR);
    let legacy = document_dir.join(DIR_LEGACY);
    if primary.exists() {
        primary
    } else if legacy.exists() {
        legacy
    } else {
        primary
    }
}

pub fn temp_docs_fallback() -> PathBuf {
    std::env::temp_dir().join(DIR_SCRIPTOR)
}

pub fn temp_appdata_fallback() -> PathBuf {
    std::env::temp_dir().join(DIR_SCRIPTOR)
}
