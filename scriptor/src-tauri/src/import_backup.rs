//! Sauvegarde pré-import et restauration (Brique 3) — copies dans `backups/pre-import-*`.

use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

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

fn docs_root(app: &AppHandle) -> PathBuf {
    app.path()
        .document_dir()
        .map(|p| crate::paths::documents_app_subdir(&p))
        .unwrap_or_else(|_| crate::paths::temp_docs_fallback())
}

fn appdata_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| crate::paths::temp_appdata_fallback())
}

fn ensure_dir(path: &Path) -> Result<(), String> {
    fs::create_dir_all(ext_path(path)).map_err(|e| e.to_string())
}

fn write_integrity_line(app: &AppHandle, line: &str) {
    let p = appdata_dir(app).join("logs").join("integrity.log");
    if let Some(parent) = p.parent() {
        let _ = ensure_dir(parent);
    }
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(ext_path(&p))
    {
        use std::io::Write;
        let _ = writeln!(f, "{} {}", now_ts(), line);
        let _ = f.sync_all();
    }
}

fn project_dir(app: &AppHandle, slug: &str) -> PathBuf {
    docs_root(app).join(slug.trim())
}

fn copy_file(src: &Path, dst: &Path) -> Result<(), String> {
    if !src.exists() {
        return Ok(());
    }
    if let Some(parent) = dst.parent() {
        ensure_dir(parent)?;
    }
    fs::copy(ext_path(src), ext_path(dst)).map_err(|e| e.to_string())?;
    Ok(())
}

/// Copie les fichiers critiques du projet vers `backups/pre-import-{ts}-{import_id}/`.
#[tauri::command]
pub fn import_pre_import_backup(
    app: AppHandle,
    project_slug: String,
    import_id: String,
) -> Result<String, String> {
    let slug = project_slug.trim();
    if slug.is_empty() || import_id.trim().is_empty() {
        return Err("slug ou import_id vide".to_string());
    }
    let src_root = project_dir(&app, slug);
    if !src_root.exists() {
        return Err("dossier projet introuvable".to_string());
    }
    let ts = now_ts();
    let name = format!("pre-import-{ts}-{}", import_id.trim());
    let dst_root = src_root.join("backups").join(&name);
    ensure_dir(&dst_root)?;

    for f in [
        "projet.json",
        "projet.snapshot.json",
        "metadata.json",
        "manifest.A.json",
        "manifest.B.json",
        "manifest.pointer.json",
        ".sync-state.json",
    ] {
        copy_file(&src_root.join(f), &dst_root.join(f))?;
    }

    let src_scenes = src_root.join("scenes");
    let dst_scenes = dst_root.join("scenes");
    if src_scenes.exists() {
        ensure_dir(&dst_scenes)?;
        let Ok(rd) = fs::read_dir(ext_path(&src_scenes)) else {
            return Err("lecture scenes".to_string());
        };
        for e in rd.flatten() {
            let p = e.path();
            let Some(n) = p.file_name().and_then(|s| s.to_str()) else {
                continue;
            };
            if n.ends_with(".txt") || n.ends_with(".bak") {
                copy_file(&p, &dst_scenes.join(n))?;
            }
        }
    }

    let path_str = dst_root.to_string_lossy().to_string();
    write_integrity_line(
        &app,
        &format!("import_pre_import_backup path={path_str}"),
    );
    Ok(path_str)
}

/// Lit `projet.json` depuis un dossier de sauvegarde pré-import.
#[tauri::command]
pub fn import_read_backup_projet_json(_app: AppHandle, backup_path: String) -> Result<String, String> {
    let p = PathBuf::from(backup_path.trim());
    let f = p.join("projet.json");
    if !f.exists() {
        return Err("projet.json absent du backup".to_string());
    }
    let mut s = String::new();
    File::open(ext_path(&f))
        .and_then(|mut file| file.read_to_string(&mut s))
        .map_err(|e| e.to_string())?;
    Ok(s)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportLogEntry {
    pub import_id: String,
    pub project_slug: String,
    pub saga_id: String,
    pub backup_path: String,
    pub created_at: u64,
    pub volume_id: String,
    pub scene_ids: Vec<String>,
    pub parser_version: String,
}

fn import_logs_dir(app: &AppHandle) -> PathBuf {
    appdata_dir(app).join("import-logs")
}

#[tauri::command]
pub fn import_save_log(app: AppHandle, entry: ImportLogEntry) -> Result<(), String> {
    let dir = import_logs_dir(&app);
    ensure_dir(&dir)?;
    let path = dir.join(format!("{}.json", entry.import_id));
    let bytes = serde_json::to_vec_pretty(&entry).map_err(|e| e.to_string())?;
    fs::write(ext_path(&path), bytes).map_err(|e| e.to_string())?;
    write_integrity_line(
        &app,
        &format!("import_log_saved id={}", entry.import_id),
    );
    Ok(())
}

#[tauri::command]
pub fn import_load_log(app: AppHandle, import_id: String) -> Result<Option<ImportLogEntry>, String> {
    let path = import_logs_dir(&app).join(format!("{import_id}.json"));
    if !path.exists() {
        return Ok(None);
    }
    let mut s = String::new();
    File::open(ext_path(&path))
        .and_then(|mut f| f.read_to_string(&mut s))
        .map_err(|e| e.to_string())?;
    serde_json::from_str(&s).map_err(|e| e.to_string()).map(Some)
}

#[tauri::command]
pub fn import_list_recent_logs(app: AppHandle, limit: u32) -> Result<Vec<ImportLogEntry>, String> {
    let dir = import_logs_dir(&app);
    if !dir.exists() {
        return Ok(vec![]);
    }
    let Ok(rd) = fs::read_dir(ext_path(&dir)) else {
        return Ok(vec![]);
    };
    let mut paths: Vec<PathBuf> = rd.flatten().map(|e| e.path()).collect();
    paths.sort_by(|a, b| b.cmp(a));
    let mut out = Vec::new();
    for p in paths.into_iter().take(limit as usize) {
        if p.extension().and_then(|x| x.to_str()) != Some("json") {
            continue;
        }
        let mut s = String::new();
        if File::open(ext_path(&p))
            .and_then(|mut f| f.read_to_string(&mut s))
            .is_err()
        {
            continue;
        }
        if let Ok(entry) = serde_json::from_str::<ImportLogEntry>(&s) {
            out.push(entry);
        }
    }
    Ok(out)
}

fn staging_scenes_dir(app: &AppHandle, slug: &str, import_id: &str) -> PathBuf {
    project_dir(app, slug)
        .join(".tmp_import")
        .join(import_id.trim())
        .join("staged_scenes")
}

/// Écrit une scène dans `.tmp_import/<importId>/staged_scenes/` avant commit WAL.
#[tauri::command]
pub fn import_stage_scene_text(
    app: AppHandle,
    project_slug: String,
    import_id: String,
    scene_id: String,
    text: String,
) -> Result<(), String> {
    let slug = project_slug.trim();
    if slug.is_empty() || import_id.trim().is_empty() || scene_id.trim().is_empty() {
        return Err("paramètres invalides".to_string());
    }
    let dir = staging_scenes_dir(&app, slug, &import_id);
    ensure_dir(&dir)?;
    let safe_id: String = scene_id
        .trim()
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' => '_',
            c => c,
        })
        .collect();
    let p = dir.join(format!("{safe_id}.txt"));
    fs::write(ext_path(&p), text.as_bytes()).map_err(|e| e.to_string())?;
    write_integrity_line(
        &app,
        &format!(
            "import_stage_scene importId={} scene={}",
            import_id.trim(),
            safe_id
        ),
    );
    Ok(())
}

/// Copie toutes les scènes stagées vers `scenes/` via WAL, puis supprime `.tmp_import/<importId>/`.
#[tauri::command]
pub fn import_commit_staged_scenes(
    app: AppHandle,
    project_slug: String,
    import_id: String,
) -> Result<u32, String> {
    let slug = project_slug.trim();
    if slug.is_empty() || import_id.trim().is_empty() {
        return Err("paramètres invalides".to_string());
    }
    let staging = staging_scenes_dir(&app, slug, &import_id);
    if !staging.exists() {
        return Ok(0);
    }
    let pdir = project_dir(&app, slug);
    if !pdir.exists() {
        return Err("dossier projet introuvable".to_string());
    }
    let mut count = 0u32;
    let rd = fs::read_dir(ext_path(&staging)).map_err(|e| e.to_string())?;
    for e in rd.flatten() {
        let p = e.path();
        let Some(name) = p.file_name().and_then(|s| s.to_str()) else {
            continue;
        };
        if !name.ends_with(".txt") {
            continue;
        }
        let sid = name.trim_end_matches(".txt");
        let mut body = String::new();
        File::open(ext_path(&p))
            .and_then(|mut f| f.read_to_string(&mut body))
            .map_err(|e| e.to_string())?;
        crate::storage_fs::wal_scene_write_project_dir(&pdir, sid, &body)?;
        count += 1;
    }
    let tmp_import_id = project_dir(&app, slug).join(".tmp_import").join(import_id.trim());
    if tmp_import_id.exists() {
        let _ = fs::remove_dir_all(ext_path(&tmp_import_id));
    }
    write_integrity_line(
        &app,
        &format!(
            "import_commit_staged_scenes importId={} count={count}",
            import_id.trim()
        ),
    );
    Ok(count)
}

/// Restaure le disque projet depuis un dossier `pre-import-*` (inverse de `import_pre_import_backup`).
#[tauri::command]
pub fn import_restore_from_pre_import_backup(
    app: AppHandle,
    project_slug: String,
    backup_path: String,
) -> Result<(), String> {
    let slug = project_slug.trim();
    if slug.is_empty() {
        return Err("slug vide".to_string());
    }
    let src_root = PathBuf::from(backup_path.trim());
    if !src_root.join("projet.json").exists() {
        return Err("backup invalide (projet.json manquant)".to_string());
    }
    let dst_root = project_dir(&app, slug);
    ensure_dir(&dst_root)?;
    for f in [
        "projet.json",
        "projet.snapshot.json",
        "metadata.json",
        "manifest.A.json",
        "manifest.B.json",
        "manifest.pointer.json",
        ".sync-state.json",
    ] {
        copy_file(&src_root.join(f), &dst_root.join(f))?;
    }
    let src_scenes = src_root.join("scenes");
    let dst_scenes = dst_root.join("scenes");
    if src_scenes.exists() {
        ensure_dir(&dst_scenes)?;
        let Ok(rd) = fs::read_dir(ext_path(&src_scenes)) else {
            return Err("lecture scenes backup".to_string());
        };
        for e in rd.flatten() {
            let p = e.path();
            let Some(n) = p.file_name().and_then(|s| s.to_str()) else {
                continue;
            };
            if n.ends_with(".txt") || n.ends_with(".bak") {
                copy_file(&p, &dst_scenes.join(n))?;
            }
        }
    }
    write_integrity_line(
        &app,
        &format!(
            "import_restore_from_backup slug={slug} path={}",
            src_root.display()
        ),
    );
    Ok(())
}
