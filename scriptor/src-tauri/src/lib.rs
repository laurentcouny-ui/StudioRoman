#[cfg(windows)]
pub mod webview2;

mod java_runtime;
mod languagetool_paths;
mod languagetool_autostart;
mod paths;
mod corrector_lt;
mod epubcheck;
mod import_backup;
mod import_session;
mod ollama_autostart;
mod print_validate;
mod storage_fs;
mod google_oauth_server;

use std::fs;
use std::io::ErrorKind;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};

use log::LevelFilter;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;
use tauri::RunEvent;
use tauri_plugin_log::{Target, TargetKind};

static APP_READY: AtomicBool = AtomicBool::new(false);

/// Génère un nom de fichier log horodaté unique par session (secondes Unix).
/// Ex : "scriptor-1744128000.log"
fn session_log_filename() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("scriptor-{secs}.log")
}

/// Rotation FIFO : garde au plus `max_files` fichiers `.log` les plus récents dans `dir`.
fn rotate_logs_fifo(dir: &PathBuf, max_files: usize) {
    let Ok(read) = fs::read_dir(dir) else {
        return;
    };
    let mut entries: Vec<(PathBuf, std::time::SystemTime)> = read
        .filter_map(|e| e.ok())
        .map(|e| {
            let p = e.path();
            let mt = e.metadata().ok().and_then(|m| m.modified().ok());
            (p, mt.unwrap_or(std::time::UNIX_EPOCH))
        })
        .filter(|(p, _)| {
            p.extension()
                .and_then(|s| s.to_str())
                .map(|ext| ext.eq_ignore_ascii_case("log"))
                .unwrap_or(false)
        })
        .collect();
    entries.sort_by(|a, b| b.1.cmp(&a.1));
    for (path, _) in entries.into_iter().skip(max_files) {
        let _ = fs::remove_file(path);
    }
}

fn resolve_log_dir(app: &tauri::AppHandle) -> PathBuf {
    let preferred = app
        .path()
        .app_data_dir()
        .map(|p| p.join("logs"))
        .unwrap_or_else(|_| paths::temp_appdata_fallback().join("logs"));
    if let Err(e) = fs::create_dir_all(&preferred) {
        if e.kind() != ErrorKind::AlreadyExists {
            let fallback = paths::temp_appdata_fallback().join("logs");
            let _ = fs::create_dir_all(&fallback);
            return fallback;
        }
    }
    preferred
}

pub fn run() {
    // Nom de fichier unique par session → la rotation FIFO est opérationnelle.
    let log_filename = session_log_filename();

    // Le panic hook est enregistré ici mais ne peut logger que si le plugin log
    // est déjà initialisé. Les panics durant builder.build() sont donc silencieux ;
    // c'est une limitation acceptable de l'ordre d'init Tauri.
    std::panic::set_hook(Box::new(|info| {
        log::error!("panic Rust: {info}");
    }));

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(LevelFilter::Debug)
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir {
                        file_name: Some(log_filename.into()),
                    }),
                ])
                .build(),
        )
        .setup(|app| {
            // Rotation FIFO : chaque session crée un nouveau fichier horodaté ;
            // on supprime les anciens au-delà de 10.
            let log_dir = resolve_log_dir(&app.handle());
            rotate_logs_fifo(&log_dir, 10);

            // Fusionne les traces : répertoire logs du bundle Tauri (plugin-log + rotation locale).
            log::info!("Scriptor démarré — journaux : {}", log_dir.display());

            java_runtime::maybe_warn_java_first_run(&app.handle());

            let cleaned = import_session::import_cleanup_stale_sessions_internal(&app.handle());
            if cleaned > 0 {
                log::info!("Brique 3 : {cleaned} session(s) d'import stale nettoyée(s)");
            }

            std::thread::spawn(|| {
                ollama_autostart::try_start_if_needed();
            });

            let lt_app = app.handle().clone();
            std::thread::spawn(move || {
                languagetool_autostart::try_start_if_needed(lt_app);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_ready,
            storage_fs::storage_init,
            storage_fs::storage_bootstrap,
            storage_fs::storage_set_active_project,
            storage_fs::storage_set_key,
            storage_fs::storage_remove_key,
            storage_fs::storage_sync_success,
            storage_fs::storage_external_mutation,
            storage_fs::storage_create_conflict_artifact,
            storage_fs::storage_list_conflicts,
            storage_fs::storage_get_conflict_payload,
            storage_fs::storage_resolve_conflict,
            storage_fs::storage_resolve_conflict_merge,
            storage_fs::storage_create_manual_snapshot,
            storage_fs::storage_restore_latest_snapshot,
            storage_fs::storage_reconstruct,
            storage_fs::storage_emergency_export,
            storage_fs::storage_health,
            storage_fs::storage_scrub_tick,
            storage_fs::storage_cpu_sample,
            storage_fs::storage_set_safe_mode,
            storage_fs::storage_set_sync_loop_threshold,
            storage_fs::storage_set_readonly,
            storage_fs::storage_shutdown,
            storage_fs::storage_report_anomaly,
            import_session::import_preflight_write,
            import_session::import_session_save,
            import_session::import_session_load,
            import_session::import_session_touch_heartbeat,
            import_session::import_cleanup_stale_sessions,
            import_backup::import_pre_import_backup,
            import_backup::import_read_backup_projet_json,
            import_backup::import_save_log,
            import_backup::import_load_log,
            import_backup::import_list_recent_logs,
            import_backup::import_stage_scene_text,
            import_backup::import_commit_staged_scenes,
            import_backup::import_restore_from_pre_import_backup,
            print_validate::print_validate_pdfx,
            epubcheck::print_run_epubcheck,
            corrector_lt::corrector_languagetool_check,
            google_oauth_server::start_google_oauth_server
        ])
        .build(tauri::generate_context!())
        .expect("erreur au lancement Tauri");

    app.run(|app_handle, event| {
        if matches!(event, RunEvent::Exit) {
            let _ = storage_fs::storage_shutdown(app_handle.clone());
            ollama_autostart::kill_spawned_if_any();
            languagetool_autostart::kill_spawned_if_any();
        }
    });
}

#[tauri::command]
fn app_ready(app: tauri::AppHandle) -> Result<(), String> {
    if APP_READY.swap(true, Ordering::SeqCst) {
        return Ok(());
    }
    if let Some(splash) = app.get_webview_window("splashscreen") {
        let _ = splash.close();
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
    Ok(())
}
