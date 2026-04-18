//! Brique 3 : sessions d’import, préflight disque, nettoyage au démarrage.
//! Les écritures projet finales restent côté webview via `storageAdapter` + WAL (Brique 2).

use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const STALE_SECS: u64 = 30;

#[cfg(windows)]
fn ext_path(path: &Path) -> PathBuf {
    let s = path.to_string_lossy();
    if s.starts_with(r"\\?\") {
        return path.to_path_buf();
    }
    if s.starts_with(r"\\") {
        let trimmed = s.trim_start_matches(r"\\");
        return PathBuf::from(format!(r"\\?\UNC\{trimmed}"));
    }
    PathBuf::from(format!(r"\\?\{}", s))
}

#[cfg(not(windows))]
fn ext_path(path: &Path) -> PathBuf {
    path.to_path_buf()
}

fn now_ts() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn appdata_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| crate::paths::temp_appdata_fallback())
}

fn docs_root(app: &AppHandle) -> PathBuf {
    let base = app
        .path()
        .document_dir()
        .unwrap_or_else(|_| std::env::temp_dir());
    crate::paths::documents_app_subdir(&base)
}

fn ensure_dir(path: &Path) -> Result<(), String> {
    fs::create_dir_all(ext_path(path)).map_err(|e| e.to_string())
}

fn write_integrity_line(app: &AppHandle, line: &str) {
    let p = appdata_dir(app).join("logs").join("integrity.log");
    if let Some(parent) = p.parent() {
        let _ = ensure_dir(parent);
    }
    if let Ok(mut f) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(ext_path(&p))
    {
        let _ = writeln!(f, "{} {}", now_ts(), line);
        let _ = f.sync_all();
    }
}

fn sessions_dir(app: &AppHandle) -> PathBuf {
    appdata_dir(app).join("import-sessions")
}

/// Étape 0 CDC : écrire 1 octet dans `Documents/BookNote|Scriptor/<slug>/.tmp_import/` puis supprimer.
#[tauri::command]
pub fn import_preflight_write(app: AppHandle, project_slug: String) -> Result<(), String> {
    let slug = project_slug.trim();
    if slug.is_empty() {
        return Err("project_slug vide".to_string());
    }
    let tmp = docs_root(&app).join(slug).join(".tmp_import");
    ensure_dir(&tmp)?;
    let probe = tmp.join(".preflight_probe");
    fs::write(ext_path(&probe), [0x01u8]).map_err(|e| {
        if e.raw_os_error() == Some(112) {
            "ENOSPC".to_string()
        } else {
            e.to_string()
        }
    })?;
    let _ = fs::remove_file(ext_path(&probe));
    write_integrity(&app, "import_preflight_ok");
    Ok(())
}

fn write_integrity(app: &AppHandle, msg: &str) {
    write_integrity_line(app, &format!("import_session: {msg}"));
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSession {
    pub import_id: String,
    pub project_id: String,
    pub project_slug: String,
    pub status: String,
    pub created_at: u64,
    pub last_heartbeat: u64,
    pub disk_hash_at_start: String,
    #[serde(default)]
    pub backup_path: Option<String>,
}

#[tauri::command]
pub fn import_session_save(app: AppHandle, session: ImportSession) -> Result<(), String> {
    let dir = sessions_dir(&app);
    ensure_dir(&dir)?;
    let path = dir.join(format!("{}.json", session.import_id));
    let bytes = serde_json::to_vec_pretty(&session).map_err(|e| e.to_string())?;
    fs::write(ext_path(&path), bytes).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn import_session_load(app: AppHandle, import_id: String) -> Result<Option<ImportSession>, String> {
    let path = sessions_dir(&app).join(format!("{import_id}.json"));
    if !path.exists() {
        return Ok(None);
    }
    let mut s = String::new();
    File::open(ext_path(&path))
        .and_then(|mut f| std::io::Read::read_to_string(&mut f, &mut s))
        .map_err(|e| e.to_string())?;
    serde_json::from_str(&s).map_err(|e| e.to_string()).map(Some)
}

#[tauri::command]
pub fn import_session_touch_heartbeat(app: AppHandle, import_id: String) -> Result<(), String> {
    let path = sessions_dir(&app).join(format!("{import_id}.json"));
    if !path.exists() {
        return Ok(());
    }
    let mut s = String::new();
    File::open(ext_path(&path))
        .and_then(|mut f| std::io::Read::read_to_string(&mut f, &mut s))
        .map_err(|e| e.to_string())?;
    let mut session: ImportSession = serde_json::from_str(&s).map_err(|e| e.to_string())?;
    session.last_heartbeat = now_ts();
    let bytes = serde_json::to_vec_pretty(&session).map_err(|e| e.to_string())?;
    fs::write(ext_path(&path), bytes).map_err(|e| e.to_string())?;
    Ok(())
}

/// Au démarrage : sessions non `committed` avec heartbeat > 30 s → fichier supprimé + `.tmp_import` nettoyé.
pub(crate) fn import_cleanup_stale_sessions_internal(app: &AppHandle) -> u32 {
    let dir = sessions_dir(app);
    if !dir.exists() {
        return 0;
    }
    let now = now_ts();
    let Ok(read) = fs::read_dir(ext_path(&dir)) else {
        return 0;
    };
    let mut cleaned = 0u32;
    for e in read.flatten() {
        let p = e.path();
        if p.extension().and_then(|x| x.to_str()) != Some("json") {
            continue;
        }
        let mut s = String::new();
        if File::open(ext_path(&p))
            .and_then(|mut f| std::io::Read::read_to_string(&mut f, &mut s))
            .is_err()
        {
            continue;
        }
        let Ok(session) = serde_json::from_str::<ImportSession>(&s) else {
            continue;
        };
        let committed = session.status.eq_ignore_ascii_case("committed");
        let stale = !committed && now.saturating_sub(session.last_heartbeat) > STALE_SECS;
        if !stale {
            continue;
        }
        let slug = session.project_slug.clone();
        let id = session.import_id.clone();
        let _ = fs::remove_file(ext_path(&p));
        cleaned += 1;
        let tmp_import_id = docs_root(app).join(&slug).join(".tmp_import").join(&id);
        if tmp_import_id.exists() {
            let _ = fs::remove_dir_all(ext_path(&tmp_import_id));
        }
        write_integrity_line(
            app,
            &format!(
                "import_session: stale_cleanup importId={id} slug={slug} status={}",
                session.status
            ),
        );
    }
    if cleaned > 0 {
        log::info!("import_session: nettoyage {cleaned} session(s) stale");
    }
    cleaned
}

#[tauri::command]
pub fn import_cleanup_stale_sessions(app: AppHandle) -> Result<u32, String> {
    Ok(import_cleanup_stale_sessions_internal(&app))
}
