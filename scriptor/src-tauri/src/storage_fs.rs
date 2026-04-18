use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const STORAGE_KEY: &str = "scriptor-project-v1";
const LAST_KNOWN_GOOD_KEY: &str = "scriptor-project-v1.last-known-good";
const SCENE_TEXT_PREFIX: &str = "scriptor-scene-text-";
const SNAPSHOT_OP_INTERVAL: u64 = 50;
const SNAPSHOT_TIME_SECS: u64 = 30 * 60;
const JOURNAL_ROTATE_BYTES: u64 = 1_000_000;
const SAFE_MODE_WINDOW_SECS: u64 = 60;
const SAFE_MODE_ERRORS_THRESHOLD: usize = 3;
/// CDC Brique 2 : sortie Safe Mode automatique après 10 min sans nouvelle fenêtre d'erreur (deadline repoussée à chaque anomalie).
const SAFE_MODE_AUTO_CLEAR_SECS: u64 = 600;
const LOW_DISK_WARN_BYTES: u64 = 100 * 1024 * 1024;
const LOW_DISK_BLOCK_BYTES: u64 = 10 * 1024 * 1024;

#[derive(Default)]
struct RuntimeState {
    readonly: bool,
    safe_mode: bool,
    project_slug: String,
    op_counter: u64,
    last_snapshot_ts: u64,
    anomaly_ts: Vec<u64>,
    /// Fenêtre glissante (s) pour la garde « sync loop » côté invoke `storage_external_mutation`.
    external_mutation_ts: Vec<u64>,
}

static RUNTIME: OnceLock<Mutex<RuntimeState>> = OnceLock::new();
static SCRUB_CURSOR: AtomicUsize = AtomicUsize::new(0);
/// Dernière métadonnée connue par chemin canonique (mtime s, taille) pour éviter un SHA-256 inutile.
static SCRUB_LAST_META: OnceLock<Mutex<HashMap<String, (u64, u64)>>> = OnceLock::new();

const SYNC_LOOP_WINDOW_SECS: u64 = 10;

fn runtime() -> &'static Mutex<RuntimeState> {
    RUNTIME.get_or_init(|| Mutex::new(RuntimeState::default()))
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
struct Hlc {
    p: u64,
    l: u64,
    #[serde(default)]
    node: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ManifestDoc {
    #[serde(rename = "projectId")]
    project_id: String,
    hlc: Hlc,
    state: Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ManifestPointer {
    current: String,
    hlc: Hlc,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct MachineFile {
    #[serde(rename = "machineId")]
    machine_id: String,
    #[serde(rename = "hlcBase")]
    hlc_base: Hlc,
}

fn default_sync_loop_threshold_field() -> f64 {
    0.8
}

#[derive(Debug, Serialize, Deserialize)]
struct PreferencesFile {
    #[serde(rename = "lastProjectSlug")]
    last_project_slug: String,
    #[serde(rename = "safeModeUntilTs", default)]
    safe_mode_until_ts: u64,
    /// CDC : seuil configurable (0,5–1,0], défaut 0,8 — aligné avec `setSyncLoopThreshold` côté webview.
    #[serde(
        rename = "syncLoopThreshold",
        default = "default_sync_loop_threshold_field"
    )]
    sync_loop_threshold: f64,
}

impl Default for PreferencesFile {
    fn default() -> Self {
        Self {
            last_project_slug: "Projet".to_string(),
            safe_mode_until_ts: 0,
            sync_loop_threshold: 0.8,
        }
    }
}

impl PreferencesFile {
    fn sync_loop_threshold_clamped(&self) -> f64 {
        let t = self.sync_loop_threshold;
        if t > 0.5 && t <= 1.0 {
            t
        } else {
            0.8
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct CrashStateFile {
    #[serde(default)]
    starts: Vec<u64>,
    #[serde(default)]
    clean_shutdown: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct SyncStateFile {
    #[serde(rename = "lastSyncedVersion", default)]
    last_synced_version: u64,
    #[serde(rename = "lastSyncTs", default)]
    last_sync_ts: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[allow(non_snake_case)]
struct JournalCheckpointEntry {
    sceneId: String,
    hash: String,
    len: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[allow(non_snake_case)]
struct JournalCheckpointFile {
    ts: u64,
    #[serde(rename = "type")]
    typ: String,
    sceneCount: u64,
    scenes: Vec<JournalCheckpointEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[allow(non_snake_case)]
struct WalEntry {
    ts: u64,
    #[serde(rename = "type")]
    typ: String,
    #[serde(default)]
    sceneId: Option<String>,
    #[serde(default)]
    hash: Option<String>,
    status: String,
    source: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[allow(non_snake_case)]
pub struct StorageInitResponse {
    pub status: String,
    pub readonly: bool,
    pub safeMode: bool,
    pub doubleInstance: bool,
    pub projectSlug: String,
    pub freeBytes: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KvEntry {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageBootstrapResponse {
    pub entries: Vec<KvEntry>,
    pub reconstructed: bool,
    pub reconstruct_source: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[allow(non_snake_case)]
pub struct StorageHealth {
    pub status: String,
    pub freeBytes: u64,
    pub readonly: bool,
    pub safeMode: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StorageModeResult {
    #[serde(rename = "safeMode")]
    pub safe_mode: bool,
    pub readonly: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReconstructResult {
    pub rebuilt: bool,
    pub source: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConflictList {
    pub files: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[allow(non_snake_case)]
pub struct ConflictPayload {
    pub path: String,
    pub kind: String,
    pub sceneId: Option<String>,
    pub localText: String,
    pub conflictText: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[allow(non_snake_case)]
pub struct ScrubTickResult {
    pub checked: u32,
    pub skipped: bool,
    pub sceneId: Option<String>,
}

fn now_ts() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn scrub_last_meta() -> &'static Mutex<HashMap<String, (u64, u64)>> {
    SCRUB_LAST_META.get_or_init(|| Mutex::new(HashMap::new()))
}

/// CDC Brique 2 : baseline globale (mtime s + taille) pour chaque `scene-*.txt` au démarrage / changement de projet.
/// Le scrub incrémental réutilise ce cache et évite un SHA-256 si le fichier n’a pas bougé depuis l’ouverture.
fn warm_scrub_meta_cache(app: &AppHandle, project_dir: &Path) {
    let scenes_dir = project_dir.join("scenes");
    let Ok(rd) = fs::read_dir(ext_path(&scenes_dir)) else {
        write_integrity(app, "startup_scene_meta_warmup scenes=0 (no scenes dir)");
        return;
    };
    let mut n: u32 = 0;
    if let Ok(mut cache) = scrub_last_meta().lock() {
        for e in rd.flatten() {
            let p = e.path();
            let Some(name) = p.file_name().and_then(|s| s.to_str()) else {
                continue;
            };
            if !(name.starts_with("scene-") && name.ends_with(".txt")) {
                continue;
            }
            if let Some(meta) = file_mtime_size(&p) {
                cache.insert(p.to_string_lossy().to_string(), meta);
                n = n.saturating_add(1);
            }
        }
    }
    write_integrity(
        app,
        &format!("startup_scene_meta_warmup scenes={n} mtime+size baseline"),
    );
}

fn file_mtime_size(path: &Path) -> Option<(u64, u64)> {
    let meta = fs::metadata(ext_path(path)).ok()?;
    let len = meta.len();
    let modified = meta.modified().ok()?;
    let secs = modified.duration_since(UNIX_EPOCH).ok()?.as_secs();
    Some((secs, len))
}

fn count_scene_txt_files(project_dir: &Path) -> usize {
    let scenes = project_dir.join("scenes");
    let Ok(rd) = fs::read_dir(ext_path(&scenes)) else {
        return 0;
    };
    rd.flatten()
        .filter(|e| {
            e.path()
                .file_name()
                .and_then(|s| s.to_str())
                .map(|n| n.starts_with("scene-") && n.ends_with(".txt"))
                .unwrap_or(false)
        })
        .count()
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

fn sanitize_project_name(raw: &str) -> String {
    let mut s = raw.trim().replace(['\\', '/', ':', '*', '?', '"', '<', '>', '|', '@'], "-");
    s = s.replace('é', "e").replace('è', "e").replace('ê', "e");
    while s.contains("--") {
        s = s.replace("--", "-");
    }
    let s = s.trim_matches('-').to_string();
    if s.is_empty() {
        "Projet".to_string()
    } else {
        s
    }
}

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

fn ensure_dir(path: &Path) -> Result<(), String> {
    fs::create_dir_all(ext_path(path)).map_err(|e| e.to_string())
}

#[allow(dead_code)]
fn fsync_file(path: &Path) -> Result<(), String> {
    let f = OpenOptions::new()
        .read(true)
        .open(ext_path(path))
        .map_err(|e| e.to_string())?;
    f.sync_all().map_err(|e| e.to_string())
}

fn write_file_fsync(path: &Path, content: &[u8]) -> Result<(), String> {
    let p = ext_path(path);
    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }
    let mut f = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(p)
        .map_err(|e| e.to_string())?;
    f.write_all(content).map_err(|e| {
        if e.raw_os_error() == Some(112) {
            "ENOSPC: disque plein".to_string()
        } else {
            e.to_string()
        }
    })?;
    f.sync_all().map_err(|e| e.to_string())?;
    fsync_parent_dir(path)
}

fn available_bytes(path: &Path) -> u64 {
    fs2::available_space(ext_path(path)).unwrap_or(0)
}

fn ensure_enough_space(path: &Path, needed: u64) -> Result<(), String> {
    let free = available_bytes(path);
    if free < LOW_DISK_BLOCK_BYTES {
        return Err("ENOSPC: moins de 10 Mo disponibles".to_string());
    }
    if free < needed.saturating_add(1024 * 1024) {
        return Err("ENOSPC: espace insuffisant".to_string());
    }
    Ok(())
}

#[cfg(windows)]
fn fsync_parent_dir(_path: &Path) -> Result<(), String> {
    // Windows does not expose a robust cross-version directory fsync via std.
    Ok(())
}

#[cfg(not(windows))]
fn fsync_parent_dir(path: &Path) -> Result<(), String> {
    let Some(parent) = path.parent() else {
        return Ok(());
    };
    let dir = File::open(ext_path(parent)).map_err(|e| e.to_string())?;
    dir.sync_all().map_err(|e| e.to_string())
}

/// Segments du journal après rotations : du plus ancien au plus récent (aligné avec `rotate_journal_if_needed`).
fn journal_segment_paths(project_dir: &Path) -> [PathBuf; 4] {
    [
        project_dir.join("journal.3.log"),
        project_dir.join("journal.2.log"),
        project_dir.join("journal.1.log"),
        project_dir.join("journal.log"),
    ]
}

fn read_journal_chain_text(project_dir: &Path) -> String {
    let mut out = String::new();
    for path in journal_segment_paths(project_dir) {
        if !path.exists() {
            continue;
        }
        let Ok(mut f) = File::open(ext_path(&path)) else {
            continue;
        };
        let mut chunk = String::new();
        if f.read_to_string(&mut chunk).is_err() {
            continue;
        }
        if !out.is_empty() && !chunk.is_empty() && !out.ends_with('\n') {
            out.push('\n');
        }
        out.push_str(&chunk);
    }
    out
}

fn rename_with_retry(from: &Path, to: &Path) -> Result<(), String> {
    let delays = [0_u64, 100, 200, 500, 1000];
    let mut last_err = String::new();
    for d in delays {
        if d > 0 {
            std::thread::sleep(std::time::Duration::from_millis(d));
        }
        match fs::rename(ext_path(from), ext_path(to)) {
            Ok(_) => return Ok(()),
            Err(e) => last_err = e.to_string(),
        }
    }
    Err(format!("rename failed after retries: {last_err}"))
}

fn append_wal(project_dir: &Path, entry: &WalEntry) -> Result<(), String> {
    let journal = project_dir.join("journal.log");
    let mut f = OpenOptions::new()
        .create(true)
        .append(true)
        .open(ext_path(&journal))
        .map_err(|e| e.to_string())?;
    let line = serde_json::to_string(entry).map_err(|e| e.to_string())?;
    f.write_all(line.as_bytes()).map_err(|e| e.to_string())?;
    f.write_all(b"\n").map_err(|e| e.to_string())?;
    f.sync_all().map_err(|e| e.to_string())?;
    fsync_parent_dir(&journal)
}

fn append_wal_raw_line(project_dir: &Path, line: &str) -> Result<(), String> {
    let journal = project_dir.join("journal.log");
    let mut f = OpenOptions::new()
        .create(true)
        .append(true)
        .open(ext_path(&journal))
        .map_err(|e| e.to_string())?;
    f.write_all(line.as_bytes()).map_err(|e| e.to_string())?;
    f.write_all(b"\n").map_err(|e| e.to_string())?;
    f.sync_all().map_err(|e| e.to_string())?;
    fsync_parent_dir(&journal)
}

fn rotate_journal_if_needed(project_dir: &Path) -> Result<(), String> {
    let journal = project_dir.join("journal.log");
    let Ok(meta) = fs::metadata(ext_path(&journal)) else {
        return Ok(());
    };
    if meta.len() < JOURNAL_ROTATE_BYTES {
        return Ok(());
    }
    let checkpoint_path = project_dir.join("journal.checkpoint.json");
    write_journal_checkpoint(project_dir, &checkpoint_path)?;
    let ts = now_ts();
    let intent = json!({
      "ts": ts,
      "type": "ROTATE_JOURNAL",
      "status": "INTENT",
      "source": "internal"
    })
    .to_string();
    let _ = append_wal_raw_line(project_dir, &intent);
    let j1 = project_dir.join("journal.1.log");
    let j2 = project_dir.join("journal.2.log");
    let j3 = project_dir.join("journal.3.log");
    let _ = fs::remove_file(ext_path(&j3));
    if j2.exists() {
        let _ = rename_with_retry(&j2, &j3);
        let _ = fsync_parent_dir(&j3);
    }
    if j1.exists() {
        let _ = rename_with_retry(&j1, &j2);
        let _ = fsync_parent_dir(&j2);
    }
    rename_with_retry(&journal, &j1)?;
    fsync_parent_dir(&j1)?;
    write_file_fsync(&journal, b"")?;
    let commit = json!({
      "ts": now_ts(),
      "type": "ROTATE_JOURNAL",
      "status": "COMMIT",
      "source": "internal"
    })
    .to_string();
    let _ = append_wal_raw_line(project_dir, &commit);
    Ok(())
}

fn write_scene_last_checkpoint(project_dir: &Path, scene_id: &str, content: &[u8]) -> Result<(), String> {
    let dir = project_dir.join("checkpoints").join("scenes");
    ensure_dir(&dir)?;
    let path = dir.join(format!("scene-{scene_id}.last.txt"));
    write_file_fsync(&path, content)
}

fn remove_scene_last_checkpoint(project_dir: &Path, scene_id: &str) -> Result<(), String> {
    let path = project_dir
        .join("checkpoints")
        .join("scenes")
        .join(format!("scene-{scene_id}.last.txt"));
    if path.exists() {
        fs::remove_file(ext_path(&path)).map_err(|e| e.to_string())?;
        fsync_parent_dir(&path)?;
    }
    Ok(())
}

fn write_journal_checkpoint(project_dir: &Path, checkpoint_path: &Path) -> Result<(), String> {
    let scenes_dir = project_dir.join("scenes");
    let mut entries: Vec<Value> = Vec::new();
    if let Ok(rd) = fs::read_dir(ext_path(&scenes_dir)) {
        for e in rd.flatten() {
            let p = e.path();
            let Some(name) = p.file_name().and_then(|s| s.to_str()) else {
                continue;
            };
            if !(name.starts_with("scene-") && name.ends_with(".txt")) {
                continue;
            }
            let mut bytes = Vec::new();
            if File::open(ext_path(&p))
                .and_then(|mut f| f.read_to_end(&mut bytes))
                .is_err()
            {
                continue;
            }
            let scene_id = name
                .trim_start_matches("scene-")
                .trim_end_matches(".txt")
                .to_string();
            entries.push(json!({
                "sceneId": scene_id,
                "hash": sha256_hex(&bytes),
                "len": bytes.len(),
            }));
        }
    }
    entries.sort_by(|a, b| {
        let sa = a
            .get("sceneId")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        let sb = b
            .get("sceneId")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        sa.cmp(sb)
    });
    let payload = json!({
        "ts": now_ts(),
        "type": "SCENE_LAST_STATE_CHECKPOINT",
        "sceneCount": entries.len(),
        "scenes": entries
    });
    let bytes = serde_json::to_vec_pretty(&payload).map_err(|e| e.to_string())?;
    write_file_fsync(checkpoint_path, &bytes)
}

fn wal_atomic_write(
    project_dir: &Path,
    op_type: &str,
    scene_id: Option<String>,
    target: &Path,
    content: &[u8],
    source: &str,
) -> Result<(), String> {
    if let Some(parent) = target.parent() {
        ensure_enough_space(parent, content.len() as u64)?;
    }
    let hash = sha256_hex(content);
    let intent = WalEntry {
        ts: now_ts(),
        typ: op_type.to_string(),
        sceneId: scene_id.clone(),
        hash: Some(hash.clone()),
        status: "INTENT".to_string(),
        source: source.to_string(),
    };
    append_wal(project_dir, &intent)?;

    let tmp = target.with_extension("tmp");
    write_file_fsync(&tmp, content)?;
    rename_with_retry(&tmp, target)?;
    fsync_parent_dir(target)?;

    let commit = WalEntry {
        ts: now_ts(),
        typ: op_type.to_string(),
        sceneId: scene_id,
        hash: Some(hash),
        status: "COMMIT".to_string(),
        source: source.to_string(),
    };
    append_wal(project_dir, &commit)?;
    rotate_journal_if_needed(project_dir)?;
    Ok(())
}

fn wal_scene_write(project_dir: &Path, scene_id: &str, content: &str) -> Result<(), String> {
    let scenes_dir = project_dir.join("scenes");
    ensure_dir(&scenes_dir)?;
    let txt = scenes_dir.join(format!("scene-{scene_id}.txt"));
    let bak = scenes_dir.join(format!("scene-{scene_id}.bak"));
    let tmp = scenes_dir.join(format!("scene-{scene_id}.tmp"));
    let bytes = content.as_bytes();
    ensure_enough_space(&scenes_dir, bytes.len() as u64)?;

    let intent = WalEntry {
        ts: now_ts(),
        typ: "WRITE_SCENE".to_string(),
        sceneId: Some(scene_id.to_string()),
        hash: Some(sha256_hex(bytes)),
        status: "INTENT".to_string(),
        source: "internal".to_string(),
    };
    append_wal(project_dir, &intent)?;

    write_file_fsync(&tmp, bytes)?;
    if txt.exists() {
        let sync_state: SyncStateFile =
            read_json(&project_dir.join(".sync-state.json")).unwrap_or(SyncStateFile {
                last_synced_version: 0,
                last_sync_ts: 0,
            });
        let cloud_seen = sync_state.last_sync_ts > 0;
        let bak_intent = WalEntry {
            ts: now_ts(),
            typ: "WRITE_BAK".to_string(),
            sceneId: Some(scene_id.to_string()),
            hash: None,
            status: "INTENT".to_string(),
            source: "internal".to_string(),
        };
        append_wal(project_dir, &bak_intent)?;
        let _ = fs::remove_file(ext_path(&bak));
        if !cloud_seen {
            // Local-only: essaie hard link pour accélérer la rotation.
            if fs::hard_link(ext_path(&txt), ext_path(&bak)).is_err() {
                let _ = rename_with_retry(&txt, &bak);
            }
        } else {
            let _ = rename_with_retry(&txt, &bak);
        }
        let bak_entry = WalEntry {
            ts: now_ts(),
            typ: "WRITE_BAK".to_string(),
            sceneId: Some(scene_id.to_string()),
            hash: None,
            status: "COMMIT".to_string(),
            source: "internal".to_string(),
        };
        append_wal(project_dir, &bak_entry)?;
    }
    rename_with_retry(&tmp, &txt)?;
    fsync_parent_dir(&txt)?;
    write_scene_last_checkpoint(project_dir, scene_id, bytes)?;

    let commit = WalEntry {
        ts: now_ts(),
        typ: "WRITE_SCENE".to_string(),
        sceneId: Some(scene_id.to_string()),
        hash: Some(sha256_hex(bytes)),
        status: "COMMIT".to_string(),
        source: "internal".to_string(),
    };
    append_wal(project_dir, &commit)?;
    Ok(())
}

/// Écriture scène via WAL pour un dossier projet explicite (import staging → commit Brique 3).
pub(crate) fn wal_scene_write_project_dir(
    project_dir: &Path,
    scene_id: &str,
    content: &str,
) -> Result<(), String> {
    wal_scene_write(project_dir, scene_id, content)
}

fn read_manifest_hlc(path: &Path) -> Option<Hlc> {
    read_json::<ManifestDoc>(path).map(|d| d.hlc)
}

fn choose_latest_manifest(project_dir: &Path) -> String {
    let a = read_manifest_hlc(&project_dir.join("manifest.A.json")).unwrap_or_default();
    let b = read_manifest_hlc(&project_dir.join("manifest.B.json")).unwrap_or_default();
    if b.p > a.p || (b.p == a.p && b.l > a.l) {
        "B".to_string()
    } else {
        "A".to_string()
    }
}

fn reconcile_manifest_pointer(project_dir: &Path) -> Result<(), String> {
    let pointer_path = project_dir.join("manifest.pointer.json");
    let mut pointer = read_json::<ManifestPointer>(&pointer_path).unwrap_or(ManifestPointer {
        current: choose_latest_manifest(project_dir),
        hlc: Hlc::default(),
    });
    if pointer.current != "A" && pointer.current != "B" {
        pointer.current = choose_latest_manifest(project_dir);
    }
    let active_path = project_dir.join(format!("manifest.{}.json", pointer.current));
    if read_json::<ManifestDoc>(&active_path).is_none() {
        pointer.current = if pointer.current == "A" { "B" } else { "A" }.to_string();
    }
    write_json(&pointer_path, &pointer)
}

fn read_snapshot_state(project_dir: &Path) -> Option<Value> {
    let snap = project_dir.join("projet.snapshot.json");
    let v: Value = read_json(&snap)?;
    v.get("state").cloned()
}

fn reconstruct_project_cache(app: &AppHandle, project_dir: &Path) -> ReconstructResult {
    let proj = project_dir.join("projet.json");
    if let Some(v) = read_json::<Value>(&proj) {
        if v.get("sagas").is_some() {
            return ReconstructResult {
                rebuilt: false,
                source: "projet.json".to_string(),
            };
        }
    }

    if let Some(state) = read_snapshot_state(project_dir) {
        if state.get("sagas").is_some() {
            let _ = write_json(&proj, &state);
            write_integrity(
                app,
                "reconstruction: projet.json régénéré depuis projet.snapshot.json (state.sagas)",
            );
            return ReconstructResult {
                rebuilt: true,
                source: "snapshot".to_string(),
            };
        }
    }

    let from_scenes = json!({
        "recoveredScenes": build_project_from_scenes(project_dir)
    });
    let _ = write_json(&proj, &from_scenes);
    write_integrity(
        app,
        "reconstruction: projet.json régénéré depuis scenes/ uniquement (recovery)",
    );
    ReconstructResult {
        rebuilt: true,
        source: "scenes-only".to_string(),
    }
}

fn recover_journal_orphans(app: &AppHandle, project_dir: &Path) {
    let s = read_journal_chain_text(project_dir);
    if s.is_empty() {
        return;
    }
    let mut intents: HashMap<String, usize> = HashMap::new();
    for line in s.lines() {
        let Ok(e) = serde_json::from_str::<WalEntry>(line) else {
            continue;
        };
        let key = format!(
            "{}::{}::{}",
            e.typ,
            e.sceneId.unwrap_or_default(),
            e.hash.unwrap_or_default()
        );
        if e.status == "INTENT" {
            *intents.entry(key).or_insert(0) += 1;
        } else if e.status == "COMMIT" {
            intents.remove(&key);
        }
    }
    if !intents.is_empty() {
        write_integrity(
            app,
            &format!("wal_orphan_intent_count={}", intents.len()),
        );
        record_anomaly(app, "INTENT without COMMIT detected");
    }
}

fn replay_orphan_delete_scene(app: &AppHandle, project_dir: &Path) {
    let s = read_journal_chain_text(project_dir);
    if s.is_empty() {
        return;
    }
    let mut intents: HashMap<String, WalEntry> = HashMap::new();
    for line in s.lines() {
        let Ok(e) = serde_json::from_str::<WalEntry>(line) else {
            continue;
        };
        let key = format!(
            "{}::{}::{}",
            e.typ,
            e.sceneId.clone().unwrap_or_default(),
            e.hash.clone().unwrap_or_default()
        );
        if e.status == "INTENT" {
            intents.insert(key, e);
        } else if e.status == "COMMIT" {
            intents.remove(&key);
        }
    }
    for orphan in intents.values() {
        if orphan.typ != "DELETE_SCENE" {
            continue;
        }
        let Some(scene_id) = orphan.sceneId.clone() else {
            continue;
        };
        let txt = project_dir.join("scenes").join(format!("scene-{scene_id}.txt"));
        let bak = project_dir.join("scenes").join(format!("scene-{scene_id}.bak"));
        let _ = fs::remove_file(ext_path(&txt));
        let _ = fs::remove_file(ext_path(&bak));
        let _ = remove_scene_last_checkpoint(project_dir, &scene_id);
        let _ = fsync_parent_dir(&txt);
        let _ = append_wal(
            project_dir,
            &WalEntry {
                ts: now_ts(),
                typ: "DELETE_SCENE".to_string(),
                sceneId: Some(scene_id.clone()),
                hash: None,
                status: "COMMIT".to_string(),
                source: "recovery".to_string(),
            },
        );
        write_integrity(app, &format!("replay_orphan_delete_scene scene={scene_id}"));
    }
}

fn quarantine_unresolved_orphan_intents(app: &AppHandle, project_dir: &Path) {
    let s = read_journal_chain_text(project_dir);
    if s.is_empty() {
        return;
    }
    let mut intents: HashMap<String, WalEntry> = HashMap::new();
    for line in s.lines() {
        let Ok(e) = serde_json::from_str::<WalEntry>(line) else {
            continue;
        };
        let key = format!(
            "{}::{}::{}",
            e.typ,
            e.sceneId.clone().unwrap_or_default(),
            e.hash.clone().unwrap_or_default()
        );
        if e.status == "INTENT" {
            intents.insert(key, e);
        } else if e.status == "COMMIT" {
            intents.remove(&key);
        }
    }
    let quarantine_dir = project_dir.join("quarantine");
    if ensure_dir(&quarantine_dir).is_err() {
        return;
    }
    for orphan in intents.values() {
        // DELETE_SCENE is handled by deterministic replay path.
        if orphan.typ == "DELETE_SCENE" {
            continue;
        }
        let hash_part = orphan.hash.clone().unwrap_or_else(|| "".to_string());
        let stable_key = format!(
            "{}::{}::{}",
            orphan.typ,
            orphan.sceneId.clone().unwrap_or_default(),
            hash_part
        );
        let fname = format!("orphan-{}.json", sha256_hex(stable_key.as_bytes()));
        let out = quarantine_dir.join(fname);
        if out.exists() {
            continue;
        }
        let payload = json!({
            "detectedTs": now_ts(),
            "status": "UNRESOLVED_INTENT",
            "policy": "quarantined_no_unsafe_replay",
            "entry": {
                "ts": orphan.ts,
                "type": orphan.typ,
                "sceneId": orphan.sceneId,
                "hash": hash_part,
                "status": orphan.status,
                "source": orphan.source
            }
        });
        if write_json(&out, &payload).is_ok() {
            write_integrity(
                app,
                &format!(
                    "quarantine_orphan_intent type={} scene={}",
                    payload["entry"]["type"].as_str().unwrap_or("unknown"),
                    payload["entry"]["sceneId"].as_str().unwrap_or("none")
                ),
            );
            record_anomaly(
                app,
                &format!(
                    "unresolved WAL INTENT quarantined type={} scene={}",
                    payload["entry"]["type"].as_str().unwrap_or("unknown"),
                    payload["entry"]["sceneId"].as_str().unwrap_or("none")
                ),
            );
        }
    }
}

fn recover_scenes_from_journal_checkpoint(app: &AppHandle, project_dir: &Path) {
    let checkpoint_path = project_dir.join("journal.checkpoint.json");
    let Some(cp) = read_json::<JournalCheckpointFile>(&checkpoint_path) else {
        return;
    };
    for entry in cp.scenes {
        let scene_path = project_dir
            .join("scenes")
            .join(format!("scene-{}.txt", entry.sceneId));
        let mut valid_scene = false;
        if scene_path.exists() {
            let mut bytes = Vec::new();
            if File::open(ext_path(&scene_path))
                .and_then(|mut f| f.read_to_end(&mut bytes))
                .is_ok()
            {
                let h = sha256_hex(&bytes);
                valid_scene = h == entry.hash && bytes.len() as u64 == entry.len;
            }
        }
        if valid_scene {
            continue;
        }
        let last_path = project_dir
            .join("checkpoints")
            .join("scenes")
            .join(format!("scene-{}.last.txt", entry.sceneId));
        if !last_path.exists() {
            record_anomaly(
                app,
                &format!("checkpoint recovery missing source for scene {}", entry.sceneId),
            );
            continue;
        }
        let mut cp_bytes = Vec::new();
        if File::open(ext_path(&last_path))
            .and_then(|mut f| f.read_to_end(&mut cp_bytes))
            .is_err()
        {
            record_anomaly(
                app,
                &format!("checkpoint recovery unreadable source for scene {}", entry.sceneId),
            );
            continue;
        }
        let cp_hash = sha256_hex(&cp_bytes);
        if cp_hash != entry.hash || cp_bytes.len() as u64 != entry.len {
            record_anomaly(
                app,
                &format!(
                    "checkpoint recovery hash mismatch for scene {} (expected checkpoint hash)",
                    entry.sceneId
                ),
            );
            continue;
        }
        if write_file_fsync(&scene_path, &cp_bytes).is_ok() {
            write_integrity(
                app,
                &format!(
                    "checkpoint_recover scene={} hash={} len={}",
                    entry.sceneId, entry.hash, entry.len
                ),
            );
        } else {
            record_anomaly(
                app,
                &format!("checkpoint recovery write failed for scene {}", entry.sceneId),
            );
        }
    }
}

fn cleanup_old_conflicts(project_dir: &Path, keep_days: u64) {
    let max_age = keep_days.saturating_mul(24 * 3600);
    let now = now_ts();
    let scenes = project_dir.join("scenes");
    if let Ok(rd) = fs::read_dir(ext_path(&scenes)) {
        for e in rd.flatten() {
            let p = e.path();
            let Some(name) = p.file_name().and_then(|s| s.to_str()) else {
                continue;
            };
            if !name.contains("_CONFLICT_") {
                continue;
            }
            let Ok(meta) = fs::metadata(ext_path(&p)) else {
                continue;
            };
            let Ok(modified) = meta.modified() else {
                continue;
            };
            let ts = modified
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(now);
            if now.saturating_sub(ts) > max_age {
                let _ = fs::remove_file(ext_path(&p));
            }
        }
    }
    if let Ok(rd) = fs::read_dir(ext_path(project_dir)) {
        for e in rd.flatten() {
            let p = e.path();
            let Some(name) = p.file_name().and_then(|s| s.to_str()) else {
                continue;
            };
            if !(name.starts_with("manifest_CONFLICT_") && name.ends_with(".json")) {
                continue;
            }
            let Ok(meta) = fs::metadata(ext_path(&p)) else {
                continue;
            };
            let Ok(modified) = meta.modified() else {
                continue;
            };
            let ts = modified
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(now);
            if now.saturating_sub(ts) > max_age {
                let _ = fs::remove_file(ext_path(&p));
            }
        }
    }
}

fn parse_scene_id_from_conflict_path(path: &str) -> Option<String> {
    let file = Path::new(path).file_name()?.to_str()?;
    if !file.starts_with("scene-") || !file.contains("_CONFLICT_") {
        return None;
    }
    let rest = file.trim_start_matches("scene-");
    let sid = rest.split("_CONFLICT_").next()?.trim_end_matches(".txt");
    if sid.is_empty() {
        None
    } else {
        Some(sid.to_string())
    }
}

fn read_json<T: for<'a> Deserialize<'a>>(path: &Path) -> Option<T> {
    let mut s = String::new();
    let mut f = File::open(ext_path(path)).ok()?;
    f.read_to_string(&mut s).ok()?;
    serde_json::from_str(&s).ok()
}

fn write_json(path: &Path, value: &impl Serialize) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?;
    write_file_fsync(path, &bytes)
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

fn preferences_path(app: &AppHandle) -> PathBuf {
    appdata_dir(app).join("preferences.json")
}

fn machine_path(app: &AppHandle) -> PathBuf {
    appdata_dir(app).join("machine.json")
}

fn crash_state_path(app: &AppHandle) -> PathBuf {
    appdata_dir(app).join("crash-state.json")
}

fn current_project_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let slug = {
        let st = runtime().lock().map_err(|e| e.to_string())?;
        if st.project_slug.is_empty() {
            "Projet".to_string()
        } else {
            st.project_slug.clone()
        }
    };
    Ok(docs_root(app).join(slug))
}

fn ensure_project_structure(project_dir: &Path) -> Result<(), String> {
    ensure_dir(project_dir)?;
    ensure_dir(&project_dir.join("scenes"))?;
    ensure_dir(&project_dir.join("backups"))?;
    ensure_dir(&project_dir.join("checkpoints").join("scenes"))?;
    let pointer = project_dir.join("manifest.pointer.json");
    if !pointer.exists() {
        write_json(
            &pointer,
            &ManifestPointer {
                current: "A".to_string(),
                hlc: Hlc::default(),
            },
        )?;
    }
    for name in ["manifest.A.json", "manifest.B.json"] {
        let p = project_dir.join(name);
        if !p.exists() {
            write_json(
                &p,
                &ManifestDoc {
                    project_id: "project-default".to_string(),
                    hlc: Hlc::default(),
                    state: json!({}),
                },
            )?;
        }
    }
    for name in [
        "metadata.json",
        "projet.json",
        "projet.snapshot.json",
        ".sync-state.json",
        "journal.log",
        "journal.checkpoint.json",
    ] {
        let p = project_dir.join(name);
        if !p.exists() {
            write_file_fsync(&p, b"{}")?;
        }
    }
    let _ = reconcile_manifest_pointer(project_dir);
    Ok(())
}

fn build_project_from_scenes(project_dir: &Path) -> Value {
    let mut map = serde_json::Map::new();
    let scenes_dir = project_dir.join("scenes");
    if let Ok(rd) = fs::read_dir(ext_path(&scenes_dir)) {
        for e in rd.flatten() {
            let p = e.path();
            let Some(name) = p.file_name().and_then(|s| s.to_str()) else {
                continue;
            };
            let name = name.to_string();
            if !(name.starts_with("scene-") && name.ends_with(".txt")) {
                continue;
            }
            let mut s = String::new();
            if let Ok(mut f) = File::open(ext_path(&p)) {
                if f.read_to_string(&mut s).is_ok() {
                    map.insert(name, Value::String(s));
                }
            }
        }
    }
    Value::Object(map)
}

fn update_manifest_shadow(project_dir: &Path, state: &Value, machine_id: &str) -> Result<(), String> {
    let pointer_path = project_dir.join("manifest.pointer.json");
    let pointer: ManifestPointer = read_json(&pointer_path).unwrap_or(ManifestPointer {
        current: "A".to_string(),
        hlc: Hlc::default(),
    });
    let current = if pointer.current == "A" { "A" } else { "B" };
    let next = if current == "A" { "B" } else { "A" };
    let next_file = project_dir.join(format!("manifest.{next}.json"));

    let p = now_ts().max(pointer.hlc.p);
    let l = if p == pointer.hlc.p {
        pointer.hlc.l.saturating_add(1)
    } else {
        0
    };
    let hlc = Hlc {
        p,
        l,
        node: machine_id.to_string(),
    };
    let doc = ManifestDoc {
        project_id: "project-default".to_string(),
        hlc: hlc.clone(),
        state: state.clone(),
    };
    wal_atomic_write(
        project_dir,
        "WRITE_MANIFEST",
        None,
        &next_file,
        &serde_json::to_vec_pretty(&doc).map_err(|e| e.to_string())?,
        "internal",
    )?;
    let new_ptr = ManifestPointer {
        current: next.to_string(),
        hlc,
    };
    wal_atomic_write(
        project_dir,
        "SWITCH_MANIFEST",
        None,
        &pointer_path,
        &serde_json::to_vec_pretty(&new_ptr).map_err(|e| e.to_string())?,
        "internal",
    )?;
    Ok(())
}

/// Charge CPU globale (0–100), alignée sur `storage_cpu_sample` (CDC : suspendre tâches lourdes si ≥ 60 %).
fn global_cpu_usage_percent() -> f32 {
    use std::time::Duration;
    use sysinfo::{CpuRefreshKind, RefreshKind as SysRefreshKind, System};
    let mut sys = System::new_with_specifics(
        SysRefreshKind::nothing().with_cpu(CpuRefreshKind::everything()),
    );
    std::thread::sleep(Duration::from_millis(200));
    sys.refresh_cpu_all();
    sys.global_cpu_usage()
}

/// Arborescence canonique pour le WAL UPDATE_STRUCTURE (scène + parents + ordre + titre).
fn canonical_structure_rows(payload: &Value) -> Vec<Value> {
    let mut rows = Vec::new();
    if let Some(sagas) = payload.get("sagas").and_then(|v| v.as_array()) {
        for saga in sagas {
            let saga_id = saga.get("id").and_then(|v| v.as_str()).unwrap_or("");
            if let Some(volumes) = saga.get("volumes").and_then(|v| v.as_array()) {
                for (vi, vol) in volumes.iter().enumerate() {
                    let vol_id = vol.get("id").and_then(|v| v.as_str()).unwrap_or("");
                    if let Some(chapters) = vol.get("chapters").and_then(|v| v.as_array()) {
                        for (ci, ch) in chapters.iter().enumerate() {
                            let ch_id = ch.get("id").and_then(|v| v.as_str()).unwrap_or("");
                            if let Some(scenes) = ch.get("scenes").and_then(|v| v.as_array()) {
                                for (si, sc) in scenes.iter().enumerate() {
                                    let id = sc.get("id").and_then(|v| v.as_str()).unwrap_or("");
                                    let title = sc.get("title").and_then(|v| v.as_str()).unwrap_or("");
                                    let order = format!("{vi}.{ci}.{si}");
                                    rows.push(json!({
                                        "sagaId": saga_id,
                                        "volumeId": vol_id,
                                        "chapterId": ch_id,
                                        "sceneId": id,
                                        "order": order,
                                        "title": title
                                    }));
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    rows.sort_by(|a, b| {
        let sa = a.get("sceneId").and_then(|v| v.as_str()).unwrap_or("");
        let sb = b.get("sceneId").and_then(|v| v.as_str()).unwrap_or("");
        sa.cmp(sb)
    });
    rows
}

fn wal_log_update_structure_from_project(project_dir: &Path, payload: &Value) -> Result<(), String> {
    let rows = canonical_structure_rows(payload);
    let body = serde_json::to_string(&rows).map_err(|e| e.to_string())?;
    let hash = sha256_hex(body.as_bytes());
    let ts = now_ts();
    append_wal(
        project_dir,
        &WalEntry {
            ts,
            typ: "UPDATE_STRUCTURE".to_string(),
            sceneId: None,
            hash: Some(hash.clone()),
            status: "INTENT".to_string(),
            source: "internal".to_string(),
        },
    )?;
    append_wal(
        project_dir,
        &WalEntry {
            ts: now_ts(),
            typ: "UPDATE_STRUCTURE".to_string(),
            sceneId: None,
            hash: Some(hash),
            status: "COMMIT".to_string(),
            source: "internal".to_string(),
        },
    )?;
    Ok(())
}

fn maybe_snapshot(project_dir: &Path, payload: &Value, machine_id: &str) -> Result<(), String> {
    let proceed = {
        let mut rt = runtime().lock().map_err(|e| e.to_string())?;
        rt.op_counter = rt.op_counter.saturating_add(1);
        let now = now_ts();
        let due_count = rt.op_counter % SNAPSHOT_OP_INTERVAL == 0;
        let due_time = now.saturating_sub(rt.last_snapshot_ts) >= SNAPSHOT_TIME_SECS;
        due_count || due_time
    };
    if !proceed {
        return Ok(());
    }
    if global_cpu_usage_percent() >= 60.0 {
        return Ok(());
    }
    // CDC Safe Mode : pas de snapshot périodique (tâche lourde) — WAL / écritures atomiques inchangés.
    if runtime().lock().map(|r| r.safe_mode).unwrap_or(false) {
        return Ok(());
    }
    let now = now_ts();
    let hash = sha256_hex(payload.to_string().as_bytes());
    let snapshot = json!({
        "ts": now,
        "projectHash": hash,
        "hlc": { "p": now, "l": 0, "node": machine_id },
        "state": payload,
    });
    wal_atomic_write(
        project_dir,
        "SNAPSHOT_CREATE",
        None,
        &project_dir.join("projet.snapshot.json"),
        &serde_json::to_vec_pretty(&snapshot).map_err(|e| e.to_string())?,
        "internal",
    )?;
    let mut rt = runtime().lock().map_err(|e| e.to_string())?;
    rt.last_snapshot_ts = now;
    Ok(())
}

/// CDC : 3 anomalies filesystem en < 1 min → snapshot immédiat + log (alerte douce).
fn auto_heal_snapshot_after_anomalies(app: &AppHandle) -> Result<(), String> {
    if runtime().lock().map(|r| r.readonly).unwrap_or(false) {
        write_integrity(app, "auto_heal: skipped (readonly)");
        return Ok(());
    }
    let pdir = current_project_dir(app)?;
    let machine = read_json::<MachineFile>(&machine_path(app)).unwrap_or(MachineFile {
        machine_id: "node".to_string(),
        hlc_base: Hlc::default(),
    });
    let payload: Value = read_json(&pdir.join("projet.json")).unwrap_or(json!({}));
    let now = now_ts();
    let hash = sha256_hex(payload.to_string().as_bytes());
    let snapshot = json!({
        "ts": now,
        "projectHash": hash,
        "hlc": { "p": now, "l": 0, "node": machine.machine_id },
        "state": payload,
    });
    wal_atomic_write(
        &pdir,
        "SNAPSHOT_CREATE",
        None,
        &pdir.join("projet.snapshot.json"),
        &serde_json::to_vec_pretty(&snapshot).map_err(|e| e.to_string())?,
        "internal",
    )?;
    if let Ok(mut rt) = runtime().lock() {
        rt.last_snapshot_ts = now;
    }
    write_integrity(app, "auto_heal: projet.snapshot.json après 3 anomalies / 60s");
    Ok(())
}

fn read_sync_loop_threshold(app: &AppHandle) -> f64 {
    let path = preferences_path(app);
    read_json::<PreferencesFile>(&path)
        .unwrap_or_default()
        .sync_loop_threshold_clamped()
}

fn external_mutation_sync_loop_guard(app: &AppHandle, project_dir: &Path) {
    let now = now_ts();
    let ratio = read_sync_loop_threshold(app);
    let mut trigger = false;
    let mut log_n = 0usize;
    let mut log_need = 0usize;
    let mut log_tracked = 0usize;
    let mut log_ratio = 0f64;
    if let Ok(mut rt) = runtime().lock() {
        if rt.readonly {
            return;
        }
        rt.external_mutation_ts.push(now);
        rt.external_mutation_ts
            .retain(|t| now.saturating_sub(*t) <= SYNC_LOOP_WINDOW_SECS);
        let n = rt.external_mutation_ts.len();
        let scenes = count_scene_txt_files(project_dir);
        let tracked = scenes.saturating_add(1).max(1);
        let need = ((tracked as f64) * ratio).ceil() as usize;
        let need = need.max(8);
        log_ratio = ratio;
        log_n = n;
        log_need = need;
        log_tracked = tracked;
        if n >= need {
            rt.readonly = true;
            trigger = true;
        }
    }
    if trigger {
        write_integrity(
            app,
            &format!(
                "sync_loop_guard: external_burst n={log_n} need={log_need} tracked={log_tracked} ratio={log_ratio:.2}"
            ),
        );
        record_anomaly(app, "sync loop guard: external burst (readonly)");
    }
}

fn write_integrity(app: &AppHandle, line: &str) {
    let p = appdata_dir(app).join("logs").join("integrity.log");
    if let Some(parent) = p.parent() {
        let _ = ensure_dir(parent);
    }
    if let Ok(mut f) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(ext_path(&p))
    {
        let _ = f.write_all(format!("{} {}\n", now_ts(), line).as_bytes());
        let _ = f.sync_all();
    }
    let _ = fsync_parent_dir(&p);
}

fn record_anomaly(app: &AppHandle, message: &str) {
    let mut should_heal = false;
    if let Ok(mut rt) = runtime().lock() {
        let now = now_ts();
        rt.anomaly_ts.push(now);
        rt.anomaly_ts.retain(|t| now.saturating_sub(*t) <= SAFE_MODE_WINDOW_SECS);
        should_heal = rt.anomaly_ts.len() == SAFE_MODE_ERRORS_THRESHOLD;
        if rt.anomaly_ts.len() >= SAFE_MODE_ERRORS_THRESHOLD {
            rt.safe_mode = true;
        }
        if rt.safe_mode {
            bump_safe_mode_deadline(app);
        }
    }
    write_integrity(app, &format!("anomaly: {message}"));
    if should_heal {
        let _ = auto_heal_snapshot_after_anomalies(app);
    }
}

fn bump_safe_mode_deadline(app: &AppHandle) {
    let path = preferences_path(app);
    let mut pref = read_json::<PreferencesFile>(&path).unwrap_or_default();
    pref.safe_mode_until_ts = now_ts().saturating_add(SAFE_MODE_AUTO_CLEAR_SECS);
    let _ = write_json(&path, &pref);
}

/// Si la deadline Safe Mode est dépassée, désactive le mode (10 min sans nouvelle anomalie repoussant le timer).
fn maybe_clear_safe_mode_by_deadline(app: &AppHandle) {
    let path = preferences_path(app);
    let pref = read_json::<PreferencesFile>(&path).unwrap_or_default();
    if pref.safe_mode_until_ts == 0 {
        return;
    }
    let now = now_ts();
    if now < pref.safe_mode_until_ts {
        return;
    }
    let mut cleared = false;
    if let Ok(mut rt) = runtime().lock() {
        if rt.safe_mode {
            rt.safe_mode = false;
            cleared = true;
        }
    }
    let mut next = read_json::<PreferencesFile>(&path).unwrap_or_default();
    next.safe_mode_until_ts = 0;
    let _ = write_json(&path, &next);
    if cleared {
        write_integrity(app, "safe_mode cleared: 10min window elapsed (auto)");
    }
}

fn update_crash_state_on_start(app: &AppHandle) -> Result<bool, String> {
    let p = crash_state_path(app);
    let now = now_ts();
    let mut cs = if p.exists() {
        read_json::<CrashStateFile>(&p).unwrap_or(CrashStateFile {
            starts: Vec::new(),
            clean_shutdown: true,
        })
    } else {
        CrashStateFile {
            starts: Vec::new(),
            clean_shutdown: true,
        }
    };
    cs.starts.push(now);
    cs.starts.retain(|t| now.saturating_sub(*t) <= 300);
    let safe_mode = cs.starts.len() >= 3 || !cs.clean_shutdown;
    cs.clean_shutdown = false;
    write_json(&p, &cs)?;
    Ok(safe_mode)
}

fn mark_clean_shutdown(app: &AppHandle) {
    let p = crash_state_path(app);
    let mut cs = if p.exists() {
        read_json::<CrashStateFile>(&p).unwrap_or(CrashStateFile {
            starts: Vec::new(),
            clean_shutdown: true,
        })
    } else {
        CrashStateFile {
            starts: Vec::new(),
            clean_shutdown: true,
        }
    };
    cs.clean_shutdown = true;
    let _ = write_json(&p, &cs);
}

#[tauri::command]
pub fn storage_init(app: AppHandle) -> Result<StorageInitResponse, String> {
    let docs = docs_root(&app);
    let appdata = appdata_dir(&app);
    ensure_dir(&docs)?;
    ensure_dir(&appdata)?;
    ensure_dir(&appdata.join("logs"))?;

    let mut readonly = false;
    let test_file = docs.join(".scriptor_test");
    match write_file_fsync(&test_file, b"ok") {
        Ok(_) => {
            let _ = fs::remove_file(ext_path(&test_file));
        }
        Err(_) => readonly = true,
    }

    let machine = machine_path(&app);
    let machine_file = if machine.exists() {
        read_json::<MachineFile>(&machine).unwrap_or(MachineFile {
            machine_id: uuid::Uuid::new_v4().to_string(),
            hlc_base: Hlc::default(),
        })
    } else {
        MachineFile {
            machine_id: uuid::Uuid::new_v4().to_string(),
            hlc_base: Hlc::default(),
        }
    };
    write_json(&machine, &machine_file)?;

    let pref_path = preferences_path(&app);
    let pref = read_json::<PreferencesFile>(&pref_path).unwrap_or_default();
    write_json(&pref_path, &pref)?;

    let project_slug = sanitize_project_name(&pref.last_project_slug);
    let pdir = docs.join(&project_slug);
    ensure_project_structure(&pdir)?;
    recover_scenes_from_journal_checkpoint(&app, &pdir);
    replay_orphan_delete_scene(&app, &pdir);
    quarantine_unresolved_orphan_intents(&app, &pdir);
    cleanup_old_conflicts(&pdir, 30);
    recover_journal_orphans(&app, &pdir);

    let lock_path = pdir.join(".lock");
    let double_instance = lock_path.exists();
    if !double_instance {
        write_file_fsync(&lock_path, format!("pid={}", std::process::id()).as_bytes())?;
    }

    // startup cleanup: remove .tmp
    for dir in [pdir.clone(), pdir.join("scenes"), pdir.join("backups")] {
        if let Ok(rd) = fs::read_dir(ext_path(&dir)) {
            for e in rd.flatten() {
                let p = e.path();
                if p.extension().and_then(|s| s.to_str()) == Some("tmp") {
                    let _ = fs::remove_file(p);
                }
            }
        }
    }

    warm_scrub_meta_cache(&app, &pdir);

    let free_bytes = available_bytes(&pdir);
    if free_bytes < LOW_DISK_BLOCK_BYTES {
        readonly = true;
    }
    let crash_safe_mode = update_crash_state_on_start(&app).unwrap_or(false);
    if let Ok(mut rt) = runtime().lock() {
        rt.readonly = readonly;
        rt.project_slug = project_slug.clone();
        if crash_safe_mode {
            rt.safe_mode = true;
        }
    }
    if crash_safe_mode {
        bump_safe_mode_deadline(&app);
    }
    maybe_clear_safe_mode_by_deadline(&app);

    Ok(StorageInitResponse {
        status: if free_bytes < LOW_DISK_BLOCK_BYTES {
            "red".to_string()
        } else if readonly {
            "orange".to_string()
        } else if free_bytes < LOW_DISK_WARN_BYTES {
            "orange".to_string()
        } else {
            "green".to_string()
        },
        readonly,
        safeMode: runtime().lock().map(|r| r.safe_mode).unwrap_or(false),
        doubleInstance: double_instance,
        projectSlug: project_slug,
        freeBytes: free_bytes,
    })
}

#[tauri::command]
pub fn storage_bootstrap(app: AppHandle) -> Result<StorageBootstrapResponse, String> {
    let pdir = current_project_dir(&app)?;
    ensure_project_structure(&pdir)?;
    let rec = reconstruct_project_cache(&app, &pdir);
    let mut out = Vec::new();

    let proj = pdir.join("projet.json");
    if proj.exists() {
        if let Ok(mut f) = File::open(ext_path(&proj)) {
            let mut s = String::new();
            if f.read_to_string(&mut s).is_ok() && !s.trim().is_empty() && s.trim() != "{}" {
                out.push(KvEntry {
                    key: STORAGE_KEY.to_string(),
                    value: s.clone(),
                });
                out.push(KvEntry {
                    key: LAST_KNOWN_GOOD_KEY.to_string(),
                    value: s,
                });
            }
        }
    }
    let scenes_dir = pdir.join("scenes");
    if let Ok(rd) = fs::read_dir(ext_path(&scenes_dir)) {
        for e in rd.flatten() {
            let p = e.path();
            let Some(name) = p.file_name().and_then(|s| s.to_str()) else {
                continue;
            };
            if !(name.starts_with("scene-") && name.ends_with(".txt")) {
                continue;
            }
            let scene_id = name
                .trim_start_matches("scene-")
                .trim_end_matches(".txt")
                .to_string();
            let mut s = String::new();
            if let Ok(mut f) = File::open(ext_path(&p)) {
                if f.read_to_string(&mut s).is_ok() {
                    out.push(KvEntry {
                        key: format!("{SCENE_TEXT_PREFIX}{scene_id}"),
                        value: s,
                    });
                }
            }
        }
    }
    Ok(StorageBootstrapResponse {
        entries: out,
        reconstructed: rec.rebuilt,
        reconstruct_source: rec.source,
    })
}

#[tauri::command]
pub fn storage_set_active_project(app: AppHandle, display_name: String) -> Result<String, String> {
    let slug = sanitize_project_name(&display_name);
    let old_slug = runtime()
        .lock()
        .map(|r| r.project_slug.clone())
        .unwrap_or_else(|_| "Projet".to_string());
    let docs = docs_root(&app);
    let old_dir = docs.join(old_slug);
    let new_dir = docs.join(&slug);
    if old_dir != new_dir && old_dir.exists() && !new_dir.exists() {
        let _ = rename_with_retry(&old_dir, &new_dir);
    }
    let mut pref = read_json::<PreferencesFile>(&preferences_path(&app)).unwrap_or_default();
    pref.last_project_slug = slug.clone();
    pref.safe_mode_until_ts = 0;
    write_json(&preferences_path(&app), &pref)?;
    if let Ok(mut rt) = runtime().lock() {
        rt.project_slug = slug.clone();
    }
    let pdir = current_project_dir(&app)?;
    ensure_project_structure(&pdir)?;
    warm_scrub_meta_cache(&app, &pdir);
    Ok(slug)
}

#[tauri::command]
pub fn storage_set_key(app: AppHandle, key: String, value: String) -> Result<(), String> {
    let pdir = current_project_dir(&app)?;
    let machine = read_json::<MachineFile>(&machine_path(&app)).unwrap_or(MachineFile {
        machine_id: "node".to_string(),
        hlc_base: Hlc::default(),
    });
    if runtime().lock().map(|r| r.readonly).unwrap_or(false) {
        return Err("readonly mode".to_string());
    }
    if key == STORAGE_KEY {
        wal_atomic_write(
            &pdir,
            "WRITE_PROJECT",
            None,
            &pdir.join("projet.json"),
            value.as_bytes(),
            "internal",
        )?;
        let payload: Value = serde_json::from_str(&value).unwrap_or(json!({}));
        let _ = wal_log_update_structure_from_project(&pdir, &payload);
        update_manifest_shadow(&pdir, &payload, &machine.machine_id)?;
        maybe_snapshot(&pdir, &payload, &machine.machine_id)?;
        return Ok(());
    }
    if key.starts_with(SCENE_TEXT_PREFIX) {
        let scene_id = key.trim_start_matches(SCENE_TEXT_PREFIX).to_string();
        wal_scene_write(&pdir, &scene_id, &value)?;
        let index_cache = appdata_dir(&app).join("index.cache");
        let _ = fs::remove_file(ext_path(&index_cache));
        let state = build_project_from_scenes(&pdir);
        let _ = maybe_snapshot(&pdir, &state, &machine.machine_id);
        return Ok(());
    }
    // metadata low criticality
    let meta_path = pdir.join("metadata.json");
    let mut meta: HashMap<String, Value> = read_json(&meta_path).unwrap_or_default();
    meta.insert(key.clone(), Value::String(value.clone()));
    wal_atomic_write(
        &pdir,
        "WRITE_METADATA",
        None,
        &meta_path,
        &serde_json::to_vec_pretty(&meta).map_err(|e| e.to_string())?,
        "internal",
    )?;
    Ok(())
}

#[tauri::command]
pub fn storage_remove_key(app: AppHandle, key: String) -> Result<(), String> {
    let pdir = current_project_dir(&app)?;
    if runtime().lock().map(|r| r.readonly).unwrap_or(false) {
        return Err("readonly mode".to_string());
    }
    if key.starts_with(SCENE_TEXT_PREFIX) {
        let scene_id = key.trim_start_matches(SCENE_TEXT_PREFIX).to_string();
        let txt = pdir.join("scenes").join(format!("scene-{scene_id}.txt"));
        let bak = pdir.join("scenes").join(format!("scene-{scene_id}.bak"));
        append_wal(
            &pdir,
            &WalEntry {
                ts: now_ts(),
                typ: "DELETE_SCENE".to_string(),
                sceneId: Some(scene_id.clone()),
                hash: None,
                status: "INTENT".to_string(),
                source: "internal".to_string(),
            },
        )?;
        let _ = fs::remove_file(ext_path(&txt));
        let _ = fs::remove_file(ext_path(&bak));
        let _ = remove_scene_last_checkpoint(&pdir, &scene_id);
        let _ = fsync_parent_dir(&txt);
        append_wal(
            &pdir,
            &WalEntry {
                ts: now_ts(),
                typ: "DELETE_SCENE".to_string(),
                sceneId: Some(scene_id),
                hash: None,
                status: "COMMIT".to_string(),
                source: "internal".to_string(),
            },
        )?;
        write_integrity(&app, "DELETE_SCENE commit");
        return Ok(());
    }
    let meta_path = pdir.join("metadata.json");
    let mut meta: HashMap<String, Value> = read_json(&meta_path).unwrap_or_default();
    meta.remove(&key);
    wal_atomic_write(
        &pdir,
        "WRITE_METADATA",
        None,
        &meta_path,
        &serde_json::to_vec_pretty(&meta).map_err(|e| e.to_string())?,
        "internal",
    )?;
    Ok(())
}

#[tauri::command]
pub fn storage_scrub_tick(app: AppHandle) -> Result<ScrubTickResult, String> {
    if runtime()
        .lock()
        .map(|r| r.safe_mode || r.readonly)
        .unwrap_or(true)
    {
        return Ok(ScrubTickResult {
            checked: 0,
            skipped: true,
            sceneId: None,
        });
    }
    let pdir = current_project_dir(&app)?;
    let scenes_dir = pdir.join("scenes");
    let Ok(rd) = fs::read_dir(ext_path(&scenes_dir)) else {
        return Ok(ScrubTickResult {
            checked: 0,
            skipped: true,
            sceneId: None,
        });
    };
    let mut txts: Vec<PathBuf> = rd
        .flatten()
        .filter_map(|e| {
            let p = e.path();
            let name = p.file_name()?.to_str()?;
            if name.starts_with("scene-") && name.ends_with(".txt") {
                Some(p)
            } else {
                None
            }
        })
        .collect();
    txts.sort();
    if txts.is_empty() {
        return Ok(ScrubTickResult {
            checked: 0,
            skipped: true,
            sceneId: None,
        });
    }
    let idx = SCRUB_CURSOR.fetch_add(1, Ordering::Relaxed) % txts.len();
    let path = &txts[idx];
    let name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("scene");
    let scene_id = name
        .trim_start_matches("scene-")
        .trim_end_matches(".txt")
        .to_string();
    let path_key = path.to_string_lossy().to_string();
    let meta = file_mtime_size(path);
    if let Some((mt, sz)) = meta {
        if let Ok(cache) = scrub_last_meta().lock() {
            if let Some((prev_mt, prev_sz)) = cache.get(&path_key) {
                if *prev_mt == mt && *prev_sz == sz {
                    write_integrity(
                        &app,
                        &format!("scrub skip unchanged scene={scene_id} mtime={mt} size={sz}"),
                    );
                    return Ok(ScrubTickResult {
                        checked: 0,
                        skipped: true,
                        sceneId: Some(scene_id),
                    });
                }
            }
        }
    }
    let mut bytes = Vec::new();
    File::open(ext_path(path))
        .and_then(|mut f| f.read_to_end(&mut bytes))
        .map_err(|e| e.to_string())?;
    let h = sha256_hex(&bytes);
    if let Some((mt, sz)) = meta {
        if let Ok(mut cache) = scrub_last_meta().lock() {
            cache.insert(path_key, (mt, sz));
        }
    }
    write_integrity(
        &app,
        &format!("scrub ok scene={scene_id} sha256={h} len={}", bytes.len()),
    );
    Ok(ScrubTickResult {
        checked: 1,
        skipped: false,
        sceneId: Some(scene_id),
    })
}

#[tauri::command]
pub fn storage_sync_success(app: AppHandle, version: u64) -> Result<(), String> {
    let pdir = current_project_dir(&app)?;
    let state = SyncStateFile {
        last_synced_version: version,
        last_sync_ts: now_ts(),
    };
    wal_atomic_write(
        &pdir,
        "SYNC_STATE",
        None,
        &pdir.join(".sync-state.json"),
        &serde_json::to_vec_pretty(&state).map_err(|e| e.to_string())?,
        "internal",
    )
}

#[tauri::command]
pub fn storage_external_mutation(app: AppHandle, key: String) -> Result<(), String> {
    let pdir = current_project_dir(&app)?;
    let typ = if key == STORAGE_KEY {
        "WRITE_PROJECT"
    } else if key.starts_with(SCENE_TEXT_PREFIX) {
        "WRITE_SCENE"
    } else {
        "UPDATE_STRUCTURE"
    };
    let intent = WalEntry {
        ts: now_ts(),
        typ: typ.to_string(),
        sceneId: None,
        hash: None,
        status: "INTENT".to_string(),
        source: "external".to_string(),
    };
    append_wal(&pdir, &intent)?;
    let commit = WalEntry {
        ts: now_ts(),
        typ: typ.to_string(),
        sceneId: None,
        hash: None,
        status: "COMMIT".to_string(),
        source: "external".to_string(),
    };
    append_wal(&pdir, &commit)?;
    external_mutation_sync_loop_guard(&app, &pdir);
    Ok(())
}

#[tauri::command]
pub fn storage_create_conflict_artifact(
    app: AppHandle,
    key: String,
    external_value: Option<String>,
) -> Result<String, String> {
    let pdir = current_project_dir(&app)?;
    let machine = read_json::<MachineFile>(&machine_path(&app)).unwrap_or(MachineFile {
        machine_id: "machine-unknown".to_string(),
        hlc_base: Hlc::default(),
    });
    let ts = now_ts();

    if key.starts_with(SCENE_TEXT_PREFIX) {
        let sid = key.trim_start_matches(SCENE_TEXT_PREFIX);
        let conflict_name = format!("scene-{sid}_CONFLICT_{}_{}.txt", machine.machine_id, ts);
        let conflict_path = pdir.join("scenes").join(conflict_name);
        write_file_fsync(&conflict_path, external_value.unwrap_or_default().as_bytes())?;
        append_wal(
            &pdir,
            &WalEntry {
                ts,
                typ: "UPDATE_STRUCTURE".to_string(),
                sceneId: Some(sid.to_string()),
                hash: None,
                status: "COMMIT".to_string(),
                source: "external".to_string(),
            },
        )?;
        return Ok(conflict_path.to_string_lossy().to_string());
    }

    let manifest_conflict = pdir.join(format!("manifest_CONFLICT_{}_{}.json", machine.machine_id, ts));
    let payload = json!({
      "machineId": machine.machine_id,
      "ts": ts,
      "key": key,
      "externalValue": external_value.unwrap_or_default()
    });
    write_json(&manifest_conflict, &payload)?;
    append_wal(
        &pdir,
        &WalEntry {
            ts,
            typ: "UPDATE_STRUCTURE".to_string(),
            sceneId: None,
            hash: None,
            status: "COMMIT".to_string(),
            source: "external".to_string(),
        },
    )?;
    Ok(manifest_conflict.to_string_lossy().to_string())
}

#[tauri::command]
pub fn storage_list_conflicts(app: AppHandle) -> Result<ConflictList, String> {
    let pdir = current_project_dir(&app)?;
    let mut files = Vec::new();
    let scenes = pdir.join("scenes");
    if let Ok(rd) = fs::read_dir(ext_path(&scenes)) {
        for e in rd.flatten() {
            let p = e.path();
            let Some(name) = p.file_name().and_then(|s| s.to_str()) else {
                continue;
            };
            if name.contains("_CONFLICT_") {
                files.push(p.to_string_lossy().to_string());
            }
        }
    }
    if let Ok(rd) = fs::read_dir(ext_path(&pdir)) {
        for e in rd.flatten() {
            let p = e.path();
            let Some(name) = p.file_name().and_then(|s| s.to_str()) else {
                continue;
            };
            if name.starts_with("manifest_CONFLICT_") && name.ends_with(".json") {
                files.push(p.to_string_lossy().to_string());
            }
        }
    }
    Ok(ConflictList { files })
}

#[tauri::command]
pub fn storage_get_conflict_payload(app: AppHandle, path: String) -> Result<ConflictPayload, String> {
    let p = PathBuf::from(path.clone());
    if !p.exists() {
        return Err("Fichier de conflit introuvable".to_string());
    }
    let file_name = p
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or_default()
        .to_string();
    let pdir = current_project_dir(&app)?;
    let mut conflict_text = String::new();
    File::open(ext_path(&p))
        .map_err(|e| e.to_string())?
        .read_to_string(&mut conflict_text)
        .map_err(|e| e.to_string())?;

    if file_name.starts_with("scene-") && file_name.contains("_CONFLICT_") {
        let sid = parse_scene_id_from_conflict_path(&path);
        let local_path = sid
            .as_ref()
            .map(|id| pdir.join("scenes").join(format!("scene-{id}.txt")));
        let mut local_text = String::new();
        if let Some(lp) = local_path {
            if lp.exists() {
                let _ = File::open(ext_path(&lp)).and_then(|mut f| f.read_to_string(&mut local_text));
            }
        }
        return Ok(ConflictPayload {
            path,
            kind: "scene".to_string(),
            sceneId: sid,
            localText: local_text,
            conflictText: conflict_text,
        });
    }

    Ok(ConflictPayload {
        path,
        kind: "manifest".to_string(),
        sceneId: None,
        localText: String::new(),
        conflictText: conflict_text,
    })
}

#[tauri::command]
pub fn storage_resolve_conflict(
    app: AppHandle,
    path: String,
    strategy: String,
) -> Result<String, String> {
    let p = PathBuf::from(path.clone());
    if !p.exists() {
        return Err("Fichier de conflit introuvable".to_string());
    }
    let pdir = current_project_dir(&app)?;
    let use_conflict = strategy.eq_ignore_ascii_case("conflict");
    let keep_local = strategy.eq_ignore_ascii_case("local");
    if !use_conflict && !keep_local {
        return Err("Stratégie invalide (local|conflict)".to_string());
    }

    let file_name = p
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or_default()
        .to_string();
    if file_name.starts_with("scene-") && file_name.contains("_CONFLICT_") {
        let sid = parse_scene_id_from_conflict_path(&path).ok_or("sceneId conflit invalide")?;
        if use_conflict {
            let mut conflict_text = String::new();
            File::open(ext_path(&p))
                .map_err(|e| e.to_string())?
                .read_to_string(&mut conflict_text)
                .map_err(|e| e.to_string())?;
            wal_scene_write(&pdir, &sid, &conflict_text)?;
        }
        let _ = fs::remove_file(ext_path(&p));
        append_wal(
            &pdir,
            &WalEntry {
                ts: now_ts(),
                typ: "UPDATE_STRUCTURE".to_string(),
                sceneId: Some(sid),
                hash: None,
                status: "COMMIT".to_string(),
                source: "internal".to_string(),
            },
        )?;
        return Ok("Conflit scène résolu".to_string());
    }

    // Conflit manifest: on garde local ou on archive/confirme externe (sans bascule auto).
    if use_conflict {
        let mut v = String::new();
        File::open(ext_path(&p))
            .map_err(|e| e.to_string())?
            .read_to_string(&mut v)
            .map_err(|e| e.to_string())?;
        let target = pdir.join(format!("manifest.external.accepted.{}.json", now_ts()));
        write_file_fsync(&target, v.as_bytes())?;
    }
    let _ = fs::remove_file(ext_path(&p));
    append_wal(
        &pdir,
        &WalEntry {
            ts: now_ts(),
            typ: "UPDATE_STRUCTURE".to_string(),
            sceneId: None,
            hash: None,
            status: "COMMIT".to_string(),
            source: "internal".to_string(),
        },
    )?;
    Ok("Conflit manifest résolu".to_string())
}

/// Ghost merge : applique un texte fusionné (ex. par paragraphe) pour un fichier `scene-*_CONFLICT_*.txt`.
#[tauri::command]
pub fn storage_resolve_conflict_merge(app: AppHandle, path: String, merged_text: String) -> Result<String, String> {
    let p = PathBuf::from(path.clone());
    if !p.exists() {
        return Err("Fichier de conflit introuvable".to_string());
    }
    let file_name = p
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or_default()
        .to_string();
    if !(file_name.starts_with("scene-") && file_name.contains("_CONFLICT_")) {
        return Err("Fusion manuelle réservée aux conflits de scène".to_string());
    }
    let pdir = current_project_dir(&app)?;
    let sid = parse_scene_id_from_conflict_path(&path).ok_or("sceneId conflit invalide")?;
    wal_scene_write(&pdir, &sid, &merged_text)?;
    let index_cache = appdata_dir(&app).join("index.cache");
    let _ = fs::remove_file(ext_path(&index_cache));
    let _ = fs::remove_file(ext_path(&p));
    append_wal(
        &pdir,
        &WalEntry {
            ts: now_ts(),
            typ: "UPDATE_STRUCTURE".to_string(),
            sceneId: Some(sid),
            hash: None,
            status: "COMMIT".to_string(),
            source: "internal".to_string(),
        },
    )?;
    Ok("Conflit scène fusionné".to_string())
}

#[tauri::command]
pub fn storage_reconstruct(app: AppHandle) -> Result<ReconstructResult, String> {
    let pdir = current_project_dir(&app)?;
    Ok(reconstruct_project_cache(&app, &pdir))
}

fn copy_file_if_exists(from: &Path, to: &Path) -> Result<(), String> {
    if !from.exists() {
        return Ok(());
    }
    if let Some(parent) = to.parent() {
        ensure_dir(parent)?;
    }
    fs::copy(ext_path(from), ext_path(to)).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn storage_create_manual_snapshot(app: AppHandle) -> Result<String, String> {
    let pdir = current_project_dir(&app)?;
    let ts = now_ts();
    append_wal(
        &pdir,
        &WalEntry {
            ts,
            typ: "SNAPSHOT_CREATE".to_string(),
            sceneId: None,
            hash: None,
            status: "INTENT".to_string(),
            source: "internal".to_string(),
        },
    )?;
    let backups = pdir.join("backups");
    ensure_dir(&backups)?;
    let tmp_dir = backups.join(format!("{ts}_Snapshot.tmp"));
    let final_dir = backups.join(format!("{ts}_Snapshot"));
    if tmp_dir.exists() {
        let _ = fs::remove_dir_all(ext_path(&tmp_dir));
    }
    ensure_dir(&tmp_dir)?;
    ensure_dir(&tmp_dir.join("scenes"))?;

    for f in [
        "manifest.A.json",
        "manifest.B.json",
        "manifest.pointer.json",
        "metadata.json",
        "projet.json",
        "projet.snapshot.json",
        "journal.log",
        ".sync-state.json",
    ] {
        copy_file_if_exists(&pdir.join(f), &tmp_dir.join(f))?;
    }

    let scenes = pdir.join("scenes");
    if let Ok(rd) = fs::read_dir(ext_path(&scenes)) {
        for e in rd.flatten() {
            let p = e.path();
            let Some(name) = p.file_name().and_then(|s| s.to_str()) else {
                continue;
            };
            if name.ends_with(".txt") || name.ends_with(".bak") {
                let _ = copy_file_if_exists(&p, &tmp_dir.join("scenes").join(name));
            }
        }
    }

    if final_dir.exists() {
        let _ = fs::remove_dir_all(ext_path(&final_dir));
    }
    rename_with_retry(&tmp_dir, &final_dir)?;

    append_wal(
        &pdir,
        &WalEntry {
            ts: now_ts(),
            typ: "SNAPSHOT_CREATE".to_string(),
            sceneId: None,
            hash: None,
            status: "COMMIT".to_string(),
            source: "internal".to_string(),
        },
    )?;
    Ok(final_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn storage_restore_latest_snapshot(app: AppHandle) -> Result<String, String> {
    let pdir = current_project_dir(&app)?;
    let backups = pdir.join("backups");
    let mut latest: Option<(PathBuf, u64)> = None;
    if let Ok(rd) = fs::read_dir(ext_path(&backups)) {
        for e in rd.flatten() {
            let p = e.path();
            if !p.is_dir() {
                continue;
            }
            let Some(name) = p.file_name().and_then(|s| s.to_str()) else {
                continue;
            };
            if !name.ends_with("_Snapshot") {
                continue;
            }
            let Ok(meta) = fs::metadata(ext_path(&p)) else {
                continue;
            };
            let Ok(modified) = meta.modified() else {
                continue;
            };
            let ts = modified
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            if latest.as_ref().map(|(_, t)| ts > *t).unwrap_or(true) {
                latest = Some((p, ts));
            }
        }
    }
    let Some((dir, _)) = latest else {
        return Err("Aucun snapshot disponible".to_string());
    };
    for f in [
        "manifest.A.json",
        "manifest.B.json",
        "manifest.pointer.json",
        "metadata.json",
        "projet.json",
        "projet.snapshot.json",
        "journal.log",
        ".sync-state.json",
    ] {
        let _ = copy_file_if_exists(&dir.join(f), &pdir.join(f));
    }
    let src_scenes = dir.join("scenes");
    let dst_scenes = pdir.join("scenes");
    if let Ok(rd) = fs::read_dir(ext_path(&src_scenes)) {
        for e in rd.flatten() {
            let p = e.path();
            let Some(name) = p.file_name().and_then(|s| s.to_str()) else {
                continue;
            };
            if name.ends_with(".txt") || name.ends_with(".bak") {
                let _ = copy_file_if_exists(&p, &dst_scenes.join(name));
            }
        }
    }
    append_wal(
        &pdir,
        &WalEntry {
            ts: now_ts(),
            typ: "SNAPSHOT".to_string(),
            sceneId: None,
            hash: None,
            status: "COMMIT".to_string(),
            source: "internal".to_string(),
        },
    )?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn storage_emergency_export(app: AppHandle) -> Result<String, String> {
    let pdir = current_project_dir(&app)?;
    let desktop = app
        .path()
        .desktop_dir()
        .unwrap_or_else(|_| std::env::temp_dir());
    let slug = runtime()
        .lock()
        .map(|r| r.project_slug.clone())
        .unwrap_or_else(|_| "Projet".to_string());
    let out = desktop.join(format!("SECOURS_{}_{}.txt", slug, now_ts()));
    let mut merged = String::new();
    let scenes = pdir.join("scenes");
    if let Ok(rd) = fs::read_dir(ext_path(&scenes)) {
        for e in rd.flatten() {
            let p = e.path();
            let Some(name) = p.file_name().and_then(|s| s.to_str()) else {
                continue;
            };
            let name = name.to_string();
            if !(name.ends_with(".txt") || name.ends_with(".bak")) {
                continue;
            }
            let mut s = String::new();
            if let Ok(mut f) = File::open(ext_path(&p)) {
                if f.read_to_string(&mut s).is_ok() {
                    merged.push_str(&format!("\n\n=== {name} ===\n\n{s}"));
                }
            }
        }
    }
    write_file_fsync(&out, merged.as_bytes())?;
    Ok(out.to_string_lossy().to_string())
}

#[tauri::command]
pub fn storage_health(app: AppHandle) -> Result<StorageHealth, String> {
    maybe_clear_safe_mode_by_deadline(&app);
    let pdir = current_project_dir(&app)?;
    let free = available_bytes(&pdir);
    let (readonly, safe_mode) = runtime()
        .lock()
        .map(|r| (r.readonly, r.safe_mode))
        .unwrap_or((false, false));
    let status = if free < LOW_DISK_BLOCK_BYTES {
        "red"
    } else if readonly || safe_mode || free < LOW_DISK_WARN_BYTES {
        "orange"
    } else {
        "green"
    };
    Ok(StorageHealth {
        status: status.to_string(),
        freeBytes: free,
        readonly,
        safeMode: safe_mode,
    })
}

#[tauri::command]
pub fn storage_set_safe_mode(app: AppHandle, enabled: bool) -> Result<StorageModeResult, String> {
    let mut safe_mode = false;
    let mut readonly = false;
    if let Ok(mut rt) = runtime().lock() {
        rt.safe_mode = enabled;
        safe_mode = rt.safe_mode;
        readonly = rt.readonly;
    }
    let path = preferences_path(&app);
    let mut pref = read_json::<PreferencesFile>(&path).unwrap_or_default();
    if enabled {
        pref.safe_mode_until_ts = now_ts().saturating_add(SAFE_MODE_AUTO_CLEAR_SECS);
    } else {
        pref.safe_mode_until_ts = 0;
    }
    let _ = write_json(&path, &pref);
    Ok(StorageModeResult {
        safe_mode,
        readonly,
    })
}

#[tauri::command]
pub fn storage_set_sync_loop_threshold(app: AppHandle, threshold: f64) -> Result<(), String> {
    if threshold <= 0.5 || threshold > 1.0 {
        return Err("syncLoopThreshold doit être dans (0,5, 1,0]".to_string());
    }
    let path = preferences_path(&app);
    let mut pref = read_json::<PreferencesFile>(&path).unwrap_or_default();
    pref.sync_loop_threshold = threshold;
    write_json(&path, &pref)
}

#[tauri::command]
pub fn storage_set_readonly(enabled: bool) -> Result<StorageModeResult, String> {
    let mut safe_mode = false;
    let mut readonly = false;
    if let Ok(mut rt) = runtime().lock() {
        rt.readonly = enabled;
        safe_mode = rt.safe_mode;
        readonly = rt.readonly;
    }
    Ok(StorageModeResult {
        safe_mode,
        readonly,
    })
}

#[tauri::command]
pub fn storage_shutdown(app: AppHandle) -> Result<(), String> {
    if let Ok(pdir) = current_project_dir(&app) {
        let lock = pdir.join(".lock");
        let _ = fs::remove_file(ext_path(&lock));
    }
    mark_clean_shutdown(&app);
    Ok(())
}

#[tauri::command]
pub fn storage_report_anomaly(app: AppHandle, message: String) -> Result<(), String> {
    record_anomaly(&app, &message);
    Ok(())
}

/// Échantillon charge CPU globale (0–100). Utilisé par le scheduler pour respecter « CPU < 60 % » (CDC).
#[tauri::command]
pub fn storage_cpu_sample() -> Option<f32> {
    Some(global_cpu_usage_percent())
}

