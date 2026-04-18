use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};
use base64::Engine;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintValidateResult {
    pub ok: bool,
    pub mode: String,
    pub tool: String,
    pub details: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub iso_compliant: Option<bool>,
    #[serde(default)]
    pub errors: Vec<String>,
    #[serde(default)]
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PrintPayload {
    standard: String,
    output_intent: String,
    font_mode: String,
    #[serde(default)]
    transparent: bool,
    #[serde(default)]
    xmp: Option<serde_json::Value>,
    #[serde(default)]
    plan: Option<serde_json::Value>,
    #[serde(default)]
    pdf_base64: Option<String>,
}

struct ExternalOutcome {
    tool: Option<String>,
    /// None = outil non adapté (Ghostscript) ou exécution ambiguë / erreur.
    iso_compliant: Option<bool>,
    notes: Vec<String>,
}

fn has_tool_in_path(name: &str) -> bool {
    #[cfg(windows)]
    let out = Command::new("where").arg(name).output();
    #[cfg(not(windows))]
    let out = Command::new("which").arg(name).output();
    match out {
        Ok(o) => o.status.success(),
        Err(_) => false,
    }
}

fn now_ts() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn resolve_verapdf_bin() -> Option<String> {
    for key in ["SCRIPTOR_VERAPDF", "VERAPDF_PATH", "VERAPDF_BIN"] {
        if let Ok(p) = env::var(key) {
            let pb = PathBuf::from(p.trim());
            if pb.is_file() {
                return Some(pb.to_string_lossy().to_string());
            }
        }
    }
    if has_tool_in_path("verapdf") {
        return Some("verapdf".to_string());
    }
    None
}

fn resolve_ghostscript_bin() -> Option<String> {
    for c in ["gswin64c", "gswin32c", "gs"] {
        if has_tool_in_path(c) {
            return Some(c.to_string());
        }
    }
    None
}

fn truncate(s: &str, max: usize) -> String {
    let t = s.trim();
    if t.chars().count() <= max {
        return t.to_string();
    }
    format!("{}…", t.chars().take(max).collect::<String>())
}

fn count_verapdf_failed_nodes(v: &Value) -> usize {
    let mut n = 0;
    count_failed_nodes_inner(v, &mut n);
    n
}

fn count_failed_nodes_inner(v: &Value, n: &mut usize) {
    match v {
        Value::Object(m) => {
            if m.get("status").and_then(|s| s.as_str()) == Some("failed") {
                *n += 1;
            }
            for c in m.values() {
                count_failed_nodes_inner(c, n);
            }
        }
        Value::Array(a) => {
            for c in a {
                count_failed_nodes_inner(c, n);
            }
        }
        _ => {}
    }
}

fn verapdf_json_summaries(stdout: &str, max_rules: usize) -> Vec<String> {
    let v: Value = match serde_json::from_str(stdout.trim()) {
        Ok(v) => v,
        Err(_) => return vec![],
    };
    let mut lines = Vec::new();
    let failed_n = count_verapdf_failed_nodes(&v);
    if failed_n > 0 {
        lines.push(format!("veraPDF: {failed_n} assertion(s) avec statut « failed » dans le rapport JSON."));
    }
    if let Some(st) = v
        .pointer("/report/jobs/0/validationReport/statement")
        .and_then(|x| x.as_str())
    {
        lines.push(truncate(st, 280));
    }
    if let Some(compliant) = v
        .pointer("/report/jobs/0/validationReport/validationResult/compliant")
        .and_then(|x| x.as_bool())
    {
        lines.push(format!(
            "veraPDF validationResult.compliant: {}",
            if compliant { "true" } else { "false" }
        ));
    }
    collect_failed_rule_descriptions(&v, max_rules, &mut lines);
    lines
}

fn collect_failed_rule_descriptions(v: &Value, max: usize, out: &mut Vec<String>) {
    if out.len() >= max {
        return;
    }
    match v {
        Value::Object(m) => {
            if m.get("status").and_then(|s| s.as_str()) == Some("failed") {
                let rule = m
                    .get("ruleId")
                    .or_else(|| m.get("specification"))
                    .and_then(|x| x.as_str())
                    .unwrap_or("");
                if let Some(d) = m.get("description").and_then(|d| d.as_str()) {
                    let t = if rule.is_empty() {
                        truncate(d, 220)
                    } else {
                        truncate(&format!("{rule} — {d}"), 260)
                    };
                    if !t.is_empty() && !out.iter().any(|x| x == &t) {
                        out.push(t);
                    }
                } else if !rule.is_empty() {
                    let t = truncate(rule, 220);
                    if !out.iter().any(|x| x == &t) {
                        out.push(t);
                    }
                }
            }
            for c in m.values() {
                collect_failed_rule_descriptions(c, max, out);
            }
        }
        Value::Array(a) => {
            for c in a {
                collect_failed_rule_descriptions(c, max, out);
            }
        }
        _ => {}
    }
}

fn run_verapdf(tmp: &std::path::Path) -> ExternalOutcome {
    let bin = match resolve_verapdf_bin() {
        Some(b) => b,
        None => {
            return ExternalOutcome {
                tool: None,
                iso_compliant: None,
                notes: vec![],
            };
        }
    };
    let out = Command::new(&bin)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .arg("--format")
        .arg("json")
        .arg(tmp)
        .output();

    match out {
        Ok(o) => {
            let code = o.status.code().unwrap_or(-1);
            let stdout = String::from_utf8_lossy(&o.stdout).to_string();
            let stderr = String::from_utf8_lossy(&o.stderr).to_string();

            // veraPDF: 0 = conforme, 1 = validé mais non conforme, autres = erreur outil
            let iso = match code {
                0 => Some(true),
                1 => Some(false),
                _ => None,
            };

            let mut notes = verapdf_json_summaries(&stdout, 14);
            if notes.is_empty() && !stdout.is_empty() && iso.is_none() {
                notes.push(truncate(&stdout, 400));
            }
            if !stderr.trim().is_empty() {
                notes.push(format!("stderr: {}", truncate(&stderr, 500)));
            }
            if iso.is_none() && code != 0 && code != 1 {
                notes.insert(0, format!("veraPDF code de sortie: {code}"));
            }

            ExternalOutcome {
                tool: Some("verapdf".to_string()),
                iso_compliant: iso,
                notes,
            }
        }
        Err(e) => ExternalOutcome {
            tool: Some("verapdf".to_string()),
            iso_compliant: None,
            notes: vec![e.to_string()],
        },
    }
}

fn run_ghostscript(bin: &str, tmp: &std::path::Path) -> ExternalOutcome {
    let out = Command::new(bin)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .arg("-dNOPAUSE")
        .arg("-dBATCH")
        .arg("-sDEVICE=nullpage")
        .arg(tmp)
        .output();

    match out {
        Ok(o) => {
            let mut notes = vec!["Ghostscript: ouverture/rendu nullpage uniquement (pas une certification PDF/X).".to_string()];
            if !o.status.success() {
                let err = String::from_utf8_lossy(&o.stderr);
                notes.push(truncate(&err, 500));
            }
            ExternalOutcome {
                tool: Some("ghostscript".to_string()),
                iso_compliant: None,
                notes,
            }
        }
        Err(e) => ExternalOutcome {
            tool: Some("ghostscript".to_string()),
            iso_compliant: None,
            notes: vec![e.to_string()],
        },
    }
}

fn run_external_validation(pdf_bytes: &[u8]) -> ExternalOutcome {
    let tmp = std::env::temp_dir().join(format!("scriptor-print-{}.pdf", now_ts()));
    if fs::write(&tmp, pdf_bytes).is_err() {
        return ExternalOutcome {
            tool: None,
            iso_compliant: None,
            notes: vec!["impossible d'écrire le PDF temporaire".to_string()],
        };
    }

    let outcome = if resolve_verapdf_bin().is_some() {
        run_verapdf(&tmp)
    } else if let Some(bin) = resolve_ghostscript_bin() {
        run_ghostscript(&bin, &tmp)
    } else {
        ExternalOutcome {
            tool: None,
            iso_compliant: None,
            notes: vec!["outils externes indisponibles (verapdf ou ghostscript)".to_string()],
        }
    };

    let _ = fs::remove_file(&tmp);
    outcome
}

#[tauri::command]
pub fn print_validate_pdfx(payload_json: String) -> Result<PrintValidateResult, String> {
    let parsed: PrintPayload = serde_json::from_str(&payload_json).map_err(|e| e.to_string())?;
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    if parsed.standard != "PDF/X-4" && parsed.standard != "PDF/X-1a" {
        errors.push(format!("standard invalide: {}", parsed.standard));
    }
    if parsed.output_intent.trim().is_empty() {
        errors.push("OutputIntent manquant".to_string());
    }
    if parsed.font_mode != "embedded"
        && parsed.font_mode != "outlined"
        && parsed.font_mode != "hybrid-safe"
    {
        errors.push(format!("fontMode invalide: {}", parsed.font_mode));
    }
    if parsed.font_mode == "outlined" {
        warnings.push("outlined: texte non selectionnable".to_string());
    }
    if parsed.font_mode == "hybrid-safe" {
        warnings.push("hybrid-safe: validite PDF/X potentiellement limite".to_string());
    }
    if parsed.plan.is_none() {
        errors.push("layout plan manquant".to_string());
    }
    if let Some(b64) = parsed.pdf_base64.as_ref() {
        if !b64.starts_with("JVBERi0") {
            errors.push("signature PDF invalide (base64)".to_string());
        }
    } else {
        warnings.push("pdf_base64 absent: validation outillee limitee".to_string());
    }
    if parsed.xmp.is_none() {
        warnings.push("XMP absent".to_string());
    }
    if parsed.standard == "PDF/X-1a" && parsed.transparent {
        warnings.push("PDF/X-1a recu avec transparence=true; flattening attendu".to_string());
    }

    let mut external_tool = None::<String>;
    let mut iso_compliant: Option<bool> = None;
    if let Some(b64) = parsed.pdf_base64.as_ref() {
        if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(b64) {
            let ext = run_external_validation(&bytes);
            external_tool = ext.tool.clone();
            iso_compliant = ext.iso_compliant;
            for n in ext.notes {
                if ext.tool.as_deref() == Some("verapdf") && ext.iso_compliant == Some(false) {
                    warnings.push(format!("veraPDF: {n}"));
                } else {
                    warnings.push(n);
                }
            }
        } else {
            warnings.push("base64 PDF non decodable pour validation outillee".to_string());
        }
    }
    if external_tool.is_none() {
        warnings.push("validation ISO outillee non effectuee".to_string());
    }
    let structural_ok = errors.is_empty();
    let mode = if external_tool.is_some() {
        "structural-plus-tool-run"
    } else {
        "structural-only"
    };

    let iso = iso_compliant;
    let mut details = if structural_ok {
        "Validation structurelle PDF/X reussie".to_string()
    } else {
        "Validation structurelle PDF/X echouee".to_string()
    };
    if let Some(ic) = iso {
        details.push_str(if ic {
            " — veraPDF: document conforme au profil valide."
        } else {
            " — veraPDF: document non conforme (voir avertissements)."
        });
    } else if external_tool.as_deref() == Some("ghostscript") {
        details.push_str(" — Ghostscript: test d'ouverture seulement.");
    }

    Ok(PrintValidateResult {
        ok: structural_ok,
        mode: mode.to_string(),
        tool: external_tool.unwrap_or_else(|| "scriptor-structural-validator".to_string()),
        details,
        iso_compliant: iso,
        errors,
        warnings,
    })
}
