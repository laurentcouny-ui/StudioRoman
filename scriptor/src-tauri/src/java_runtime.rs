//! Avertissement si le bundle LanguageTool est incomplet (JAR embarqué sans JRE utilisable).
//! Si le JRE est embarqué ou que `java` système fonctionne, aucun message.

use std::fs;
use std::io::ErrorKind;

use tauri::Manager;

use crate::languagetool_paths;

/// Lien officiel recommandé (Eclipse Temurin, builds OpenJDK) — message de secours.
pub const JAVA_DOWNLOAD_URL: &str = "https://adoptium.net/temurin/releases/?package=jre";

fn notice_marker_path(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    let base = app.path().app_local_data_dir().ok()?;
    Some(base.join("flags").join("java_jre_lt_notice_shown"))
}

/// Si l’app embarque le JAR LanguageTool mais qu’aucun Java n’est utilisable, affiche une fois un message (Windows : MessageBox).
pub fn maybe_warn_java_first_run(app: &tauri::AppHandle) {
    if languagetool_paths::resolve_java_for_lt(app).is_some() {
        return;
    }
    if !languagetool_paths::bundled_jar_present(app) {
        return;
    }
    let Some(marker) = notice_marker_path(app) else {
        log::warn!("LanguageTool : impossible de résoudre le dossier données pour l’avertissement JRE.");
        return;
    };
    if marker.is_file() {
        return;
    }
    if let Some(parent) = marker.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            if e.kind() != ErrorKind::AlreadyExists {
                log::warn!("LanguageTool : création flags impossible ({e})");
                return;
            }
        }
    }

    let detail = "Le correcteur LanguageTool est inclus mais le moteur Java n’est pas disponible.\n\
        L’installateur devrait embarquer un JRE — cette copie de Scriptor est peut-être incomplète.\n\
        Vous pouvez installer un JRE sur le système en secours, ou réinstaller Scriptor.";
    show_java_help(detail);
    let _ = fs::write(&marker, b"1");
}

#[cfg(windows)]
pub fn show_java_help(detail: &str) {
    let body = format!(
        "{detail}\r\n\r\n\
        Secours : JRE Eclipse Temurin (si vous choisissez d’installer Java vous-même) :\r\n{JAVA_DOWNLOAD_URL}"
    );
    let wide: Vec<u16> = body.encode_utf16().chain(std::iter::once(0)).collect();
    let title: Vec<u16> = "Scriptor — LanguageTool incomplet"
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

#[cfg(not(windows))]
pub fn show_java_help(detail: &str) {
    log::warn!(
        "{detail} — Téléchargez un JRE (ex. Temurin) : {JAVA_DOWNLOAD_URL}"
    );
}
