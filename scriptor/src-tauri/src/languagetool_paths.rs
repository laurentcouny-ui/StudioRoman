//! Chemins LanguageTool embarqués (`src-tauri/resources/languagetool/`) : JRE portable + JAR serveur.
//! Objectif : installateur MSI plug-and-play sans Java système.

use std::env;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use tauri::Manager;

fn resource_languagetool_root(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path()
        .resource_dir()
        .ok()
        .map(|p| p.join("languagetool"))
}

/// `true` si le JAR serveur est présent dans les ressources (build release prévu « complet »).
pub fn bundled_jar_present(app: &tauri::AppHandle) -> bool {
    bundled_jar_path(app).is_some()
}

pub fn bundled_jar_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    let p = resource_languagetool_root(app)?.join("languagetool-server.jar");
    p.is_file().then_some(p)
}

/// JAR à charger : variables d’environnement, puis données utilisateur, puis ressources embarquées.
pub fn resolve_lt_jar(app: &tauri::AppHandle) -> Option<PathBuf> {
    for key in [
        "SCRIPTOR_LANGUAGETOOL_JAR",
        "BOOKNOTE_LANGUAGETOOL_JAR",
        "LANGUAGETOOL_JAR",
    ] {
        if let Ok(p) = env::var(key) {
            let pb = PathBuf::from(p.trim());
            if pb.is_file() {
                return Some(pb);
            }
        }
    }
    if let Ok(dir) = app.path().app_local_data_dir() {
        let local = dir.join("languagetool").join("languagetool-server.jar");
        if local.is_file() {
            return Some(local);
        }
    }
    bundled_jar_path(app)
}

fn bundled_java_candidate(app: &tauri::AppHandle) -> Option<PathBuf> {
    let root = resource_languagetool_root(app)?;
    #[cfg(windows)]
    let exe = root.join("jre").join("bin").join("java.exe");
    #[cfg(not(windows))]
    let exe = root.join("jre").join("bin").join("java");
    exe.is_file().then_some(exe)
}

fn java_version_ok(java_exe: &Path) -> bool {
    Command::new(java_exe)
        .arg("-version")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn system_java_ok() -> bool {
    Command::new("java")
        .arg("-version")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Exécutable Java à utiliser : JRE embarqué en priorité, sinon `java` sur le PATH.
pub fn resolve_java_for_lt(app: &tauri::AppHandle) -> Option<PathBuf> {
    if let Some(p) = bundled_java_candidate(app) {
        if java_version_ok(&p) {
            return Some(p);
        }
        log::warn!(
            "LanguageTool : JRE embarqué présent mais « {} -version » a échoué — repli sur Java système.",
            p.display()
        );
    }
    if system_java_ok() {
        return Some(PathBuf::from("java"));
    }
    None
}

