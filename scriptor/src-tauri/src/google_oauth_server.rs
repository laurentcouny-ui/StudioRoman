/// Serveur HTTP temporaire pour le callback OAuth Google (flux desktop).
/// Écoute sur **127.0.0.1** (port aléatoire). Boucle sur les connexions TCP jusqu'à
/// recevoir une requête dont la query contient `code` ou `error` (OAuth) — ignore
/// les requêtes parasites (favicon, etc.) qui ne doivent pas « voler » le seul accept().
/// Émet ensuite `google-oauth-callback` et sert une page HTML de confirmation ou d'erreur.

use std::io::{BufRead, BufReader, ErrorKind, Write};
use std::net::TcpListener;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use serde::Serialize;

static OAUTH_SERVER_RUNNING: AtomicBool = AtomicBool::new(false);

/// Port fixe pour le callback OAuth Dropbox depuis le **navigateur système** (Tauri).
/// Doit être déclaré tel quel dans la console Dropbox (Redirect URIs), en plus de localhost:14230/5173.
pub const DROPBOX_OAUTH_LOOPBACK_PORT: u16 = 17863;

#[derive(Serialize, Clone, Debug)]
pub struct OAuthCallbackPayload {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
}

const SUCCESS_HTML: &str = r#"<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Studio Roman — Connexion réussie</title>
<style>
  body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;
    background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif}
  .box{text-align:center;padding:2.5rem;background:#1e293b;border-radius:12px;max-width:380px}
  h1{color:#22c55e;font-size:1.25rem;margin:0 0 .75rem}
  p{color:#94a3b8;margin:0;font-size:.9rem}
</style></head>
<body>
  <div class="box">
    <h1>✓ Connexion réussie</h1>
    <p>Vous pouvez fermer cet onglet et retourner à Studio Roman.</p>
  </div>
</body>
</html>"#;

const ERROR_HTML: &str = r#"<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Studio Roman — Erreur connexion</title>
<style>
  body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;
    background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif}
  .box{text-align:center;padding:2.5rem;background:#1e293b;border-radius:12px;max-width:380px}
  h1{color:#ef4444;font-size:1.25rem;margin:0 0 .75rem}
  p{color:#94a3b8;margin:0;font-size:.9rem}
</style></head>
<body>
  <div class="box">
    <h1>✗ Connexion refusée ou annulée</h1>
    <p>Vous pouvez fermer cet onglet et retourner à Studio Roman.</p>
  </div>
</body>
</html>"#;

/// Démarre un serveur HTTP local sur un port aléatoire pour recevoir le callback OAuth Google.
/// Retourne le numéro de port. L'événement `google-oauth-callback` est émis dès réception.
/// Un seul serveur actif à la fois — renvoie une erreur si un autre est en cours.
#[tauri::command]
pub fn start_google_oauth_server(app: AppHandle) -> Result<u16, String> {
    if OAUTH_SERVER_RUNNING.swap(true, Ordering::SeqCst) {
        // Réinitialiser si bloqué plus de 15 min (garde-fou)
        return Err("Un serveur OAuth est déjà en attente. Patientez ou relancez l'application.".into());
    }

    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| {
            OAUTH_SERVER_RUNNING.store(false, Ordering::SeqCst);
            format!("Impossible de démarrer le serveur OAuth local: {e}")
        })?;

    let port = listener
        .local_addr()
        .map_err(|e| {
            OAUTH_SERVER_RUNNING.store(false, Ordering::SeqCst);
            format!("Port OAuth introuvable: {e}")
        })?
        .port();

    std::thread::spawn(move || {
        // Non-bloquant : on boucle sur accept() jusqu'à recevoir une vraie redirection OAuth
        // (code ou error dans la query). Sinon, la première connexion est souvent un bruit
        // (favicon, antimalware, etc.) qui volait le seul accept() et cassait toute la liaison.
        if let Err(e) = listener.set_nonblocking(true) {
            log::warn!("OAuth server: set_nonblocking: {e}");
            OAUTH_SERVER_RUNNING.store(false, Ordering::SeqCst);
            let _ = app.emit("google-oauth-callback", OAuthCallbackPayload {
                code: None,
                state: None,
                error: Some(format!("Serveur OAuth: {e}")),
            });
            return;
        }

        let deadline = Instant::now() + Duration::from_secs(720);
        let mut emitted = false;

        while Instant::now() < deadline && !emitted {
            match listener.accept() {
                Ok((mut stream, _)) => {
                    let payload = {
                        let reader = BufReader::new(&stream);
                        let first_line = reader
                            .lines()
                            .next()
                            .and_then(|l| l.ok())
                            .unwrap_or_default();
                        let path = first_line.split_whitespace().nth(1).unwrap_or("");
                        let query = path.splitn(2, '?').nth(1).unwrap_or("");
                        parse_oauth_query(query)
                    };

                    let is_oauth_callback = payload.code.is_some() || payload.error.is_some();
                    let response = if payload.code.is_some() {
                        format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\
                             Content-Length: {}\r\nConnection: close\r\n\r\n{}",
                            SUCCESS_HTML.len(),
                            SUCCESS_HTML
                        )
                    } else if payload.error.is_some() {
                        format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\
                             Content-Length: {}\r\nConnection: close\r\n\r\n{}",
                            ERROR_HTML.len(),
                            ERROR_HTML
                        )
                    } else {
                        log::debug!(
                            "OAuth server: requête ignorée (pas de code/error OAuth), on attend le callback."
                        );
                        "HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n".to_string()
                    };
                    let _ = (&mut stream as &mut dyn Write).write_all(response.as_bytes());

                    if is_oauth_callback {
                        let _ = app.emit("google-oauth-callback", payload);
                        emitted = true;
                    }
                }
                Err(ref e) if e.kind() == ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(80));
                }
                Err(e) => {
                    log::warn!("OAuth server: accept échoué: {e}");
                    let _ = app.emit("google-oauth-callback", OAuthCallbackPayload {
                        code: None,
                        state: None,
                        error: Some(format!("Serveur OAuth: connexion impossible: {e}")),
                    });
                    emitted = true;
                }
            }
        }

        if !emitted {
            log::info!("OAuth server: timeout (12 min sans callback OAuth valide).");
        }

        OAUTH_SERVER_RUNNING.store(false, Ordering::SeqCst);
    });

    Ok(port)
}

fn parse_oauth_query(query: &str) -> OAuthCallbackPayload {
    let params: Vec<(String, String)> = serde_urlencoded::from_str(query).unwrap_or_default();
    let mut code = None;
    let mut state = None;
    let mut error = None;
    for (k, v) in params {
        match k.as_str() {
            "code" => code = Some(v),
            "state" => state = Some(v),
            "error" | "error_description" => {
                if error.is_none() {
                    error = Some(v);
                }
            }
            _ => {}
        }
    }
    OAuthCallbackPayload { code, state, error }
}

/// Même principe que `start_google_oauth_server`, mais sur un **port fixe** : l’URL de redirection
/// est connue à l’avance et peut être enregistrée dans la console Dropbox (`http://127.0.0.1:17863/`).
/// Utilisé quand l’OAuth Dropbox s’ouvre dans le navigateur par défaut (connexion Google autorisée),
/// au lieu de la webview embarquée où Google bloque souvent « Se connecter avec Google ».
#[tauri::command]
pub fn start_dropbox_oauth_server(app: AppHandle) -> Result<(), String> {
    if OAUTH_SERVER_RUNNING.swap(true, Ordering::SeqCst) {
        return Err(
            "Un serveur OAuth est déjà en attente. Patientez ou relancez l’application.".into(),
        );
    }

    let listener = TcpListener::bind(("127.0.0.1", DROPBOX_OAUTH_LOOPBACK_PORT))
        .map_err(|e| {
            OAUTH_SERVER_RUNNING.store(false, Ordering::SeqCst);
            format!(
                "Impossible d’écouter le port {} (Dropbox OAuth). Fermez l’autre programme qui l’utilise ou changez de port dans le code : {e}",
                DROPBOX_OAUTH_LOOPBACK_PORT
            )
        })?;

    std::thread::spawn(move || {
        if let Err(e) = listener.set_nonblocking(true) {
            log::warn!("Dropbox OAuth server: set_nonblocking: {e}");
            OAUTH_SERVER_RUNNING.store(false, Ordering::SeqCst);
            let _ = app.emit("dropbox-oauth-callback", OAuthCallbackPayload {
                code: None,
                state: None,
                error: Some(format!("Serveur OAuth: {e}")),
            });
            return;
        }

        let deadline = Instant::now() + Duration::from_secs(720);
        let mut emitted = false;

        while Instant::now() < deadline && !emitted {
            match listener.accept() {
                Ok((mut stream, _)) => {
                    let payload = {
                        let reader = BufReader::new(&stream);
                        let first_line = reader
                            .lines()
                            .next()
                            .and_then(|l| l.ok())
                            .unwrap_or_default();
                        let path = first_line.split_whitespace().nth(1).unwrap_or("");
                        let query = path.splitn(2, '?').nth(1).unwrap_or("");
                        parse_oauth_query(query)
                    };

                    let is_oauth_callback = payload.code.is_some() || payload.error.is_some();
                    let response = if payload.code.is_some() {
                        format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\
                             Content-Length: {}\r\nConnection: close\r\n\r\n{}",
                            SUCCESS_HTML.len(),
                            SUCCESS_HTML
                        )
                    } else if payload.error.is_some() {
                        format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\
                             Content-Length: {}\r\nConnection: close\r\n\r\n{}",
                            ERROR_HTML.len(),
                            ERROR_HTML
                        )
                    } else {
                        log::debug!(
                            "Dropbox OAuth server: requête ignorée (pas de code/error OAuth), on attend le callback."
                        );
                        "HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n".to_string()
                    };
                    let _ = (&mut stream as &mut dyn Write).write_all(response.as_bytes());

                    if is_oauth_callback {
                        let _ = app.emit("dropbox-oauth-callback", payload);
                        emitted = true;
                    }
                }
                Err(ref e) if e.kind() == ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(80));
                }
                Err(e) => {
                    log::warn!("Dropbox OAuth server: accept échoué: {e}");
                    let _ = app.emit("dropbox-oauth-callback", OAuthCallbackPayload {
                        code: None,
                        state: None,
                        error: Some(format!("Serveur OAuth: connexion impossible: {e}")),
                    });
                    emitted = true;
                }
            }
        }

        if !emitted {
            log::info!("Dropbox OAuth server: timeout (12 min sans callback OAuth valide).");
        }

        OAUTH_SERVER_RUNNING.store(false, Ordering::SeqCst);
    });

    Ok(())
}
