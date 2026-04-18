//! Démarre le serveur HTTP LanguageTool en local (port 8010 par défaut) si un JAR est disponible.
//! Désactivable avec SCRIPTOR_SKIP_LANGUAGETOOL_AUTOSTART=1.
//! Si Scriptor a lancé le serveur, on tente d’arrêter le processus à la fermeture (comme Ollama).
//! JRE + JAR peuvent être embarqués dans `resources/languagetool/` (voir `npm run vendor:languagetool-bundled`).

use std::env;
use std::net::SocketAddr;
use std::net::TcpStream;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use crate::languagetool_paths;

static SPAWNED_LT_PID: Mutex<Option<u32>> = Mutex::new(None);

fn autostart_disabled() -> bool {
    env::var("SCRIPTOR_SKIP_LANGUAGETOOL_AUTOSTART")
        .map(|v| {
            let s = v.trim().to_ascii_lowercase();
            matches!(s.as_str(), "1" | "true" | "yes" | "on")
        })
        .unwrap_or(false)
}

fn lt_port() -> u16 {
    env::var("SCRIPTOR_LANGUAGETOOL_PORT")
        .ok()
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(8010)
}

fn port_open(port: u16) -> bool {
    let addr: SocketAddr = match format!("127.0.0.1:{port}").parse() {
        Ok(a) => a,
        Err(_) => return false,
    };
    TcpStream::connect_timeout(&addr, Duration::from_millis(450)).is_ok()
}

fn wait_for_port(port: u16, max_attempts: u32, delay: Duration) -> bool {
    for _ in 0..max_attempts {
        if port_open(port) {
            return true;
        }
        std::thread::sleep(delay);
    }
    false
}

/// Arrête le serveur LanguageTool uniquement s’il a été lancé par cette session.
pub fn kill_spawned_if_any() {
    let pid = SPAWNED_LT_PID.lock().ok().and_then(|mut g| g.take());
    let Some(pid) = pid else {
        return;
    };
    #[cfg(windows)]
    kill_pid_windows(pid);
    #[cfg(not(windows))]
    kill_pid_unix(pid);
}

#[cfg(windows)]
fn kill_pid_windows(pid: u32) {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{
        OpenProcess, TerminateProcess, PROCESS_TERMINATE,
    };

    unsafe {
        let handle = OpenProcess(PROCESS_TERMINATE, 0, pid);
        if !handle.is_null() {
            let _ = TerminateProcess(handle, 1);
            let _ = CloseHandle(handle);
        }
    }
    log::info!("LanguageTool : processus lancé par Scriptor (PID {pid}) — arrêt à la fermeture.");
}

#[cfg(not(windows))]
fn kill_pid_unix(pid: u32) {
    unsafe {
        let _ = libc::kill(pid as libc::pid_t, libc::SIGTERM);
    }
    log::info!("LanguageTool : processus lancé par Scriptor (PID {pid}) — SIGTERM à la fermeture.");
}

fn record_spawned_child(child: std::process::Child) {
    let pid = child.id();
    if let Ok(mut g) = SPAWNED_LT_PID.lock() {
        *g = Some(pid);
    }
    std::mem::forget(child);
}

fn spawn_java_lt(java_exe: &Path, jar: &Path, port: u16) -> std::io::Result<std::process::Child> {
    let jar_str = jar.to_str().ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::InvalidInput, "chemin JAR invalide")
    })?;
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        const DETACHED_PROCESS: u32 = 0x0000_0008;
        let mut cmd = Command::new(java_exe);
        cmd.args(["-jar", jar_str, "--port", &port.to_string()]);
        cmd.stdin(Stdio::null());
        cmd.stdout(Stdio::null());
        cmd.stderr(Stdio::null());
        cmd.creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS);
        cmd.spawn()
    }
    #[cfg(not(windows))]
    {
        let mut cmd = Command::new(java_exe);
        cmd.args(["-jar", jar_str, "--port", &port.to_string()]);
        cmd.stdin(Stdio::null());
        cmd.stdout(Stdio::null());
        cmd.stderr(Stdio::null());
        cmd.spawn()
    }
}

/// Si le port LT est libre et qu’un JAR est trouvé, lance le serveur en arrière-plan.
pub fn try_start_if_needed(app: tauri::AppHandle) {
    if autostart_disabled() {
        log::info!("SCRIPTOR_SKIP_LANGUAGETOOL_AUTOSTART actif — pas de lancement automatique LanguageTool.");
        return;
    }

    let port = lt_port();
    if port_open(port) {
        log::debug!("LanguageTool : port {port} déjà ouvert — aucun lancement.");
        return;
    }

    let Some(jar) = languagetool_paths::resolve_lt_jar(&app) else {
        log::info!(
            "LanguageTool : JAR introuvable — pour un build bureau autonome, exécutez « npm run vendor:languagetool-bundled » avant « npm run tauri:build »."
        );
        return;
    };

    let Some(java_exe) = languagetool_paths::resolve_java_for_lt(&app) else {
        log::warn!(
            "LanguageTool : aucun Java utilisable (JRE embarqué ou système). JAR : {}",
            jar.display()
        );
        return;
    };

    match spawn_java_lt(&java_exe, &jar, port) {
        Ok(child) => {
            record_spawned_child(child);
            log::info!(
                "LanguageTool : serveur lancé en arrière-plan (port {port}, java {}, JAR {}).",
                java_exe.display(),
                jar.display()
            );
            if wait_for_port(port, 120, Duration::from_millis(500)) {
                log::info!("LanguageTool : port {port} répond.");
            } else {
                log::warn!(
                    "LanguageTool : le port {port} ne répond pas encore après le délai — le serveur peut encore démarrer."
                );
            }
        }
        Err(e) => log::warn!(
            "LanguageTool : impossible de lancer le serveur ({e}). Vérifiez le JAR et le JRE."
        ),
    }
}
