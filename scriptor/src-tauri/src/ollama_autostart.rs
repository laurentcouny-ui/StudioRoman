//! Démarre Ollama en arrière-plan si absent (CDC §6). Désactivable avec SCRIPTOR_SKIP_OLLAMA_AUTOSTART=1.
//! Si Scriptor a lancé `ollama serve`, on tente de l’arrêter à la fermeture de l’app (ne touche pas à une instance déjà en cours).

use std::env;
use std::net::SocketAddr;
use std::net::TcpStream;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

static SPAWNED_OLLAMA_PID: Mutex<Option<u32>> = Mutex::new(None);

fn autostart_disabled() -> bool {
    env::var("SCRIPTOR_SKIP_OLLAMA_AUTOSTART")
        .map(|v| {
            let s = v.trim().to_ascii_lowercase();
            matches!(s.as_str(), "1" | "true" | "yes" | "on")
        })
        .unwrap_or(false)
}

/// Arrête le processus `ollama serve` uniquement s’il a été lancé par cette session (PID mémorisé).
pub fn kill_spawned_if_any() {
    let pid = SPAWNED_OLLAMA_PID
        .lock()
        .ok()
        .and_then(|mut g| g.take());
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
    log::info!("Ollama : processus lancé par Scriptor (PID {pid}) — arrêt demandé à la fermeture.");
}

#[cfg(not(windows))]
fn kill_pid_unix(pid: u32) {
    unsafe {
        let _ = libc::kill(pid as libc::pid_t, libc::SIGTERM);
    }
    log::info!("Ollama : processus lancé par Scriptor (PID {pid}) — SIGTERM à la fermeture.");
}

fn record_spawned_child(child: std::process::Child) {
    let pid = child.id();
    if let Ok(mut g) = SPAWNED_OLLAMA_PID.lock() {
        *g = Some(pid);
    }
    std::mem::forget(child);
}

/// Si le port 11434 ne répond pas, tente `ollama serve` (non bloquant pour l’UI).
pub fn try_start_if_needed() {
    if autostart_disabled() {
        log::info!("SCRIPTOR_SKIP_OLLAMA_AUTOSTART actif — pas de lancement automatique d’Ollama.");
        return;
    }

    let addr: SocketAddr = match "127.0.0.1:11434".parse() {
        Ok(a) => a,
        Err(_) => return,
    };

    if TcpStream::connect_timeout(&addr, Duration::from_millis(450)).is_ok() {
        log::debug!("Ollama : port 11434 déjà ouvert.");
        return;
    }

    #[cfg(windows)]
    start_windows();

    #[cfg(not(windows))]
    start_unix();
}

#[cfg(windows)]
fn start_windows() {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    const DETACHED_PROCESS: u32 = 0x0000_0008;

    let mut cmd = Command::new("ollama");
    cmd.args(["serve"]);
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::null());
    cmd.creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS);

    match cmd.spawn() {
        Ok(child) => {
            record_spawned_child(child);
            log::info!("Ollama : « ollama serve » lancé en arrière-plan (Windows).");
        }
        Err(e) => log::warn!(
            "Ollama : impossible de lancer « ollama serve » ({e}). Installez Ollama ou démarrez-le manuellement."
        ),
    }
}

#[cfg(not(windows))]
fn start_unix() {
    let mut cmd = Command::new("ollama");
    cmd.args(["serve"]);
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::null());

    match cmd.spawn() {
        Ok(child) => {
            record_spawned_child(child);
            log::info!("Ollama : « ollama serve » lancé en arrière-plan.");
        }
        Err(e) => log::warn!(
            "Ollama : impossible de lancer « ollama serve » ({e}). Installez Ollama ou démarrez-le manuellement."
        ),
    }
}
