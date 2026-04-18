//! Détection / installation du runtime WebView2 (Windows uniquement).
//! Niveau 1 : registre EdgeUpdate Clients (Evergreen WebView2).
//! Niveau 2 : téléchargement du bootstrapper officiel + installation silencieuse (timeout 60 s).
//! Niveau 3 : fenêtre native (MessageBox) avec instructions + lien.

use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;

const WEBVIEW2_BOOTSTRAPPER_URL: &str =
    "https://go.microsoft.com/fwlink/p/?LinkId=2124703";
const WEBVIEW2_INSTALLER_NAME: &str = "MicrosoftEdgeWebview2Setup.exe";

fn runtime_registered() -> bool {
    let hklm = winreg::RegKey::predef(winreg::enums::HKEY_LOCAL_MACHINE);
    let sub = r"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
    if let Ok(key) = hklm.open_subkey(sub) {
        if key.get_value::<String, _>("pv").is_ok() {
            return true;
        }
    }
    let sub32 = r"SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
    if let Ok(key) = hklm.open_subkey(sub32) {
        if key.get_value::<String, _>("pv").is_ok() {
            return true;
        }
    }
    false
}

fn installer_path() -> PathBuf {
    let mut dir = std::env::temp_dir();
    dir.push(WEBVIEW2_INSTALLER_NAME);
    dir
}

/// Télécharge puis lance l’installateur silencieux ; bloque au plus `timeout`.
fn run_bootstrapper_sync(timeout: Duration) -> Result<(), String> {
    let path = installer_path();
    let status_dl = Command::new("curl.exe")
        .args([
            "-L",
            "-f",
            "-o",
            path.to_str().ok_or("Chemin installateur invalide")?,
            WEBVIEW2_BOOTSTRAPPER_URL,
        ])
        .status()
        .or_else(|_| {
            Command::new("powershell.exe")
                .args([
                    "-NoProfile",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-Command",
                    &format!(
                        "Invoke-WebRequest -Uri '{}' -OutFile '{}' -UseBasicParsing",
                        WEBVIEW2_BOOTSTRAPPER_URL,
                        path.display()
                    ),
                ])
                .status()
        })
        .map_err(|e| format!("Téléchargement WebView2 impossible : {e}"))?;
    if !status_dl.success() {
        return Err("Échec du téléchargement du runtime WebView2.".into());
    }

    let (tx, rx) = std::sync::mpsc::channel::<Result<std::process::ExitStatus, std::io::Error>>();
    let exe = path.clone();
    std::thread::spawn(move || {
        let r = Command::new(&exe)
            .args(["/silent", "/install"])
            .status();
        let _ = tx.send(r);
    });

    match rx.recv_timeout(timeout) {
        Ok(Ok(st)) if st.success() => Ok(()),
        Ok(Ok(_)) => Err("L’installateur WebView2 s’est terminé avec une erreur.".into()),
        Ok(Err(e)) => Err(format!("Installation WebView2 : {e}")),
        Err(_) => Err(format!(
            "Dépassement du délai ({timeout:?}) pour l’installation silencieuse de WebView2."
        )),
    }
}

/// Retourne `Ok` si le runtime est utilisable, sinon `Err` (message court pour logs).
pub fn ensure_runtime_or_fail() -> Result<(), String> {
    if runtime_registered() {
        return Ok(());
    }

    if let Err(e) = run_bootstrapper_sync(Duration::from_secs(60)) {
        log::warn!("WebView2 bootstrapper : {e}");
    }

    if runtime_registered() {
        return Ok(());
    }

    Err(
        "Runtime WebView2 introuvable après tentative d’installation automatique. \
         Connexion Internet requise, ou installez WebView2 manuellement."
            .into(),
    )
}

pub fn show_webview2_help(detail: &str) {
    let body = format!(
        "{detail}\r\n\r\n\
        Téléchargement : {WEBVIEW2_BOOTSTRAPPER_URL}\r\n\r\n\
        Installez « Microsoft Edge WebView2 Runtime » puis relancez Scriptor."
    );
    let wide: Vec<u16> = body.encode_utf16().chain(std::iter::once(0)).collect();
    let title: Vec<u16> = "Scriptor — WebView2 requis"
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();
    unsafe {
        windows_sys::Win32::UI::WindowsAndMessaging::MessageBoxW(
            std::ptr::null_mut(),
            wide.as_ptr(),
            title.as_ptr(),
            windows_sys::Win32::UI::WindowsAndMessaging::MB_OK
                | windows_sys::Win32::UI::WindowsAndMessaging::MB_ICONINFORMATION,
        );
    }
}
