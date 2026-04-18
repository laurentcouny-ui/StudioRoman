//! LanguageTool en local uniquement (127.0.0.1) — zéro appel Internet.
//! En bureau, Scriptor tente de lancer le serveur LT (JRE + JAR embarqués dans les ressources si
//! `npm run vendor:languagetool-bundled` a été exécuté avant le build). Sinon : JAR dans les données
//! utilisateur, variables d’environnement, ou `npm run lt:server`.

use serde_json::Value;
use std::collections::HashMap;
use std::time::{Duration, Instant};

const DEFAULT_LT_URL: &str = "http://127.0.0.1:8010/v2/check";
const TARGET_MS_PER_PARA: u64 = 50;

#[tauri::command]
pub fn corrector_languagetool_check(text: String, language: String) -> Result<String, String> {
    let lang = if language.trim().is_empty() {
        "fr".to_string()
    } else {
        language.trim().to_string()
    };

    let mut form = HashMap::new();
    form.insert("text", text.as_str());
    form.insert("language", lang.as_str());

    let body = serde_urlencoded::to_string(form).map_err(|e| e.to_string())?;

    let url = std::env::var("BOOKNOTE_LANGUAGETOOL_URL")
        .or_else(|_| std::env::var("SCRIPTOR_LANGUAGETOOL_URL"))
        .unwrap_or_else(|_| DEFAULT_LT_URL.to_string());

    let started = Instant::now();
    let resp = ureq::post(&url)
        .set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
        .timeout(Duration::from_secs(12))
        .send_string(&body)
        .map_err(|e| {
            format!(
                "LanguageTool local indisponible ({url}). Démarrez le serveur LanguageTool sur cette URL (réseau loopback uniquement). Détail : {e}"
            )
        })?;

    if resp.status() >= 400 {
        return Err(format!(
            "LanguageTool HTTP {} — vérifiez que le serveur local répond sur {url}",
            resp.status()
        ));
    }

    let json_text = resp.into_string().map_err(|e| e.to_string())?;

    // Journalisation légère perf (objectif CDC ~50 ms / paragraphe — indicatif seulement)
    let elapsed = started.elapsed().as_millis() as u64;
    if elapsed > TARGET_MS_PER_PARA {
        log::warn!(
            "corrector_languagetool_check: {} ms (> cible {} ms / paragraphe)",
            elapsed,
            TARGET_MS_PER_PARA
        );
    } else {
        log::debug!("corrector_languagetool_check: {} ms", elapsed);
    }

    // Valider que c’est du JSON LanguageTool minimal
    let _: Value = serde_json::from_str(&json_text).map_err(|e| format!("Réponse LanguageTool invalide: {e}"))?;

    Ok(json_text)
}
