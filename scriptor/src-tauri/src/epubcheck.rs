//! Validation EPUB avec le JAR officiel EPUBCheck (Java), si `EPUBCHECK_JAR` / `SCRIPTOR_EPUBCHECK_JAR`
//! pointe vers un fichier existant, ou si `epubcheck.jar` est dans les données locales de l’app.

use base64::Engine;
use serde::Serialize;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::{Command, Stdio};

use tauri::Manager;
use uuid::Uuid;

use crate::languagetool_paths;

const OUT_MAX: usize = 48_000;

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        return s.to_string();
    }
    let mut t = s.chars().take(max.saturating_sub(1)).collect::<String>();
    t.push('…');
    t
}

fn resolve_epubcheck_jar(app: &tauri::AppHandle) -> Option<PathBuf> {
    for key in ["SCRIPTOR_EPUBCHECK_JAR", "EPUBCHECK_JAR", "BOOKNOTE_EPUBCHECK_JAR"] {
        if let Ok(p) = env::var(key) {
            let pb = PathBuf::from(p.trim());
            if pb.is_file() {
                return Some(pb);
            }
        }
    }
    if let Ok(dir) = app.path().app_local_data_dir() {
        for name in ["epubcheck-all.jar", "epubcheck.jar"] {
            let local = dir.join("epubcheck").join(name);
            if local.is_file() {
                return Some(local);
            }
        }
    }
    None
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EpubcheckResult {
    pub skipped: bool,
    pub ok: bool,
    pub exit_code: i32,
    pub tool: String,
    pub stdout: String,
    pub stderr: String,
    pub details: String,
}

/// Lance `java -jar epubcheck.jar` sur un EPUB encodé en base64 (sans préfixe data URL).
#[tauri::command]
pub fn print_run_epubcheck(
    app: tauri::AppHandle,
    epub_base64: String,
    jar_path: Option<String>,
) -> Result<EpubcheckResult, String> {
    let jar = jar_path
        .map(PathBuf::from)
        .filter(|p| p.is_file())
        .or_else(|| resolve_epubcheck_jar(&app));

    let Some(jar) = jar else {
        return Ok(EpubcheckResult {
            skipped: true,
            ok: false,
            exit_code: -1,
            tool: "epubcheck".to_string(),
            stdout: String::new(),
            stderr: String::new(),
            details: "EPUBCheck non configuré : définissez la variable d’environnement EPUBCHECK_JAR (chemin vers epubcheck-all.jar) ou placez epubcheck.jar dans le dossier données de l’application (epubcheck/).".to_string(),
        });
    };

    let Some(java) = languagetool_paths::resolve_java_for_lt(&app) else {
        return Ok(EpubcheckResult {
            skipped: true,
            ok: false,
            exit_code: -1,
            tool: "epubcheck".to_string(),
            stdout: String::new(),
            stderr: String::new(),
            details: "Java introuvable : installez un JRE sur le système ou utilisez une build Scriptor avec JRE embarqué (LanguageTool).".to_string(),
        });
    };

    let raw = epub_base64.trim();
    let b64 = raw.strip_prefix("data:").and_then(|s| s.split_once(',').map(|x| x.1)).unwrap_or(raw);
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64)
        .map_err(|e| format!("base64 EPUB invalide : {e}"))?;

    let tmp: PathBuf = env::temp_dir().join(format!("scriptor-epubcheck-{}.epub", Uuid::new_v4()));
    fs::write(&tmp, &bytes).map_err(|e| format!("écriture temporaire EPUB : {e}"))?;

    let output = Command::new(&java)
        .arg("-jar")
        .arg(jar.as_os_str())
        .arg(&tmp)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("lancement EPUBCheck : {e}"));

    let _ = fs::remove_file(&tmp);

    let output = output?;
    let code = output.status.code().unwrap_or(-1);
    let stdout = truncate(&String::from_utf8_lossy(&output.stdout), OUT_MAX);
    let stderr = truncate(&String::from_utf8_lossy(&output.stderr), OUT_MAX);
    let ok = output.status.success();

    let details = if ok {
        format!("EPUBCheck OK (code {code}).")
    } else {
        format!("EPUBCheck a signalé des problèmes (code {code}). Voir stdout/stderr.")
    };

    Ok(EpubcheckResult {
        skipped: false,
        ok,
        exit_code: code,
        tool: "epubcheck".to_string(),
        stdout,
        stderr,
        details,
    })
}
