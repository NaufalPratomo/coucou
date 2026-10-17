use std::net::SocketAddr;
use futures_util::{SinkExt, StreamExt};
use tauri::{AppHandle, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::tungstenite::Message;

use super::protocol::*;
use crate::{log, pipe, spotify};

pub const DEFAULT_COMPANION_PORT: u16 = 47822;

pub fn http_response(code: u16, content_type: &str, body: &[u8]) -> Vec<u8> {
    let status_str = match code {
        200 => "OK",
        401 => "Unauthorized",
        404 => "Not Found",
        _ => "Unknown",
    };
    let header = format!(
        "HTTP/1.1 {code} {status_str}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\nAccess-Control-Allow-Origin: *\r\n\r\n",
        body.len()
    );
    let mut resp = header.into_bytes();
    resp.extend_from_slice(body);
    resp
}

pub fn extract_token(path: &str) -> &str {
    if let Some(query) = path.split('?').nth(1) {
        for pair in query.split('&') {
            let mut parts = pair.splitn(2, '=');
            if let Some(key) = parts.next() {
                if key == "token" {
                    return parts.next().unwrap_or("");
                }
            }
        }
    }
    ""
}

pub fn mime_type_for_path(path: &str) -> &'static str {
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".js") || lower.ends_with(".mjs") {
        "application/javascript"
    } else if lower.ends_with(".css") {
        "text/css"
    } else if lower.ends_with(".html") || lower.ends_with(".htm") {
        "text/html; charset=utf-8"
    } else if lower.ends_with(".json") || lower.ends_with(".map") {
        "application/json"
    } else if lower.ends_with(".webmanifest") {
        "application/manifest+json"
    } else if lower.ends_with(".svg") {
        "image/svg+xml"
    } else if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "image/jpeg"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else if lower.ends_with(".gif") {
        "image/gif"
    } else if lower.ends_with(".ico") {
        "image/x-icon"
    } else if lower.ends_with(".woff2") {
        "font/woff2"
    } else if lower.ends_with(".woff") {
        "font/woff"
    } else if lower.ends_with(".ttf") {
        "font/ttf"
    } else if lower.ends_with(".wasm") {
        "application/wasm"
    } else {
        "application/octet-stream"
    }
}

pub fn resolve_asset_path(clean: &str) -> Option<std::path::PathBuf> {
    if clean.is_empty() || clean.contains("..") || clean.contains('\\') || clean.contains('\0') {
        return None;
    }

    let parts: Vec<&str> = clean.split('/').filter(|s| !s.is_empty()).collect();
    if parts.is_empty() {
        return None;
    }

    let mut base_dirs = vec![
        std::path::PathBuf::from("dist"),
        std::path::PathBuf::from("../dist"),
        std::path::PathBuf::from("../../dist"),
        std::path::PathBuf::from("windows/dist"),
    ];

    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            base_dirs.push(parent.join("dist"));
            base_dirs.push(parent.join("../dist"));
            base_dirs.push(parent.join("../../dist"));
        }
    }

    for base in &base_dirs {
        let mut file_path = base.clone();
        for part in &parts {
            file_path.push(part);
        }
        if file_path.is_file() {
            return Some(file_path);
        }
    }

    None
}

pub fn resolve_asset_file(app: &AppHandle, rel_path: &str) -> Option<(Vec<u8>, String)> {
    let clean = rel_path.trim_start_matches('/');

    // 1. Tauri's embedded asset resolver (serves compiled dist/* directly from the binary)
    if let Some(asset) = app.asset_resolver().get(clean.to_string()) {
        return Some((asset.bytes, asset.mime_type));
    }

    // 2. Filesystem fallback
    if let Some(path) = resolve_asset_path(clean) {
        if let Ok(bytes) = std::fs::read(&path) {
            return Some((bytes, mime_type_for_path(clean).to_string()));
        }
    }

    None
}

pub async fn handle_connection(app: AppHandle, mut stream: TcpStream, addr: SocketAddr) {
    let mut buf = [0u8; 2048];
    let n = match stream.peek(&mut buf).await {
        Ok(n) if n > 0 => n,
        _ => return,
    };
    let req_header = String::from_utf8_lossy(&buf[..n]);
    let raw_path = req_header
        .lines()
        .next()
        .and_then(|l| l.split_whitespace().nth(1))
        .unwrap_or("/");

    let req_lower = req_header.to_ascii_lowercase();
    if req_lower.contains("upgrade: websocket") {
        let token = extract_token(raw_path);
        if !super::pairing::verify_token(token) {
            let mut full_buf = vec![0u8; n];
            let _ = stream.read_exact(&mut full_buf).await;
            let resp = http_response(401, "text/plain", b"Unauthorized: invalid pairing token");
            let _ = stream.write_all(&resp).await;
            let _ = stream.flush().await;
            return;
        }

        if let Ok(ws_stream) = tokio_tungstenite::accept_async(stream).await {
            handle_ws_session(app, ws_stream, addr).await;
        }
        return;
    }

    // Handle HTTP GET
    let mut full_buf = vec![0u8; n];
    let _ = stream.read_exact(&mut full_buf).await;
    let path = raw_path.split('?').next().unwrap_or(raw_path);

    let (code, content_type, body): (u16, String, Vec<u8>) = if path == "/" || path == "/companion.html" {
        if let Some((bytes, mime)) = resolve_asset_file(&app, "companion.html") {
            (200, mime, bytes)
        } else {
            (200, "text/html; charset=utf-8".to_string(), include_bytes!("../../../companion.html").to_vec())
        }
    } else if path == "/manifest.json" {
        if let Some((bytes, mime)) = resolve_asset_file(&app, "manifest.json") {
            (200, mime, bytes)
        } else {
            (200, "application/manifest+json".to_string(), include_bytes!("../../../src/companion/manifest.json").to_vec())
        }
    } else if let Some((bytes, mime)) = resolve_asset_file(&app, path) {
        (200, mime, bytes)
    } else {
        (404, "text/plain".to_string(), b"Not Found".to_vec())
    };

    let resp = http_response(code, &content_type, &body);
    let _ = stream.write_all(&resp).await;
    let _ = stream.flush().await;
}

pub async fn handle_ws_session(
    app: AppHandle,
    mut ws: tokio_tungstenite::WebSocketStream<TcpStream>,
    _addr: SocketAddr,
) {
    let initial_state = OutboundMessage::FullSync(StateSnapshot::default());
    if let Ok(json) = serde_json::to_string(&initial_state) {
        let _ = ws.send(Message::Text(json.into())).await;
    }

    while let Some(Ok(msg)) = ws.next().await {
        if let Message::Text(txt) = msg {
            if let Ok(inbound) = serde_json::from_str::<InboundMessage>(&txt) {
                match inbound {
                    InboundMessage::MediaAction { action, value } => {
                        let app_clone = app.clone();
                        tauri::async_runtime::spawn(async move {
                            spotify::spotify_control(app_clone, action, value).await;
                        });
                    }
                    InboundMessage::AgentDecision { request_id, allow } => {
                        let word = if allow { "allow" } else { "deny" };
                        pipe::answer(&app, &request_id, word);
                    }
                    InboundMessage::Ping => {
                        let pong = serde_json::to_string(&OutboundMessage::Pong).unwrap_or_default();
                        let _ = ws.send(Message::Text(pong.into())).await;
                    }
                }
            }
        }
    }
}

pub fn start_web_companion(app: AppHandle, port: u16) {
    tauri::async_runtime::spawn(async move {
        let addr = SocketAddr::from(([0, 0, 0, 0], port));
        let listener = match TcpListener::bind(addr).await {
            Ok(l) => l,
            Err(e) => {
                log::line(format!("web companion: bind error {e}"));
                return;
            }
        };
        log::line(format!("web companion: listening on http://0.0.0.0:{port}"));

        loop {
            if let Ok((stream, peer)) = listener.accept().await {
                let app_c = app.clone();
                tauri::async_runtime::spawn(async move {
                    handle_connection(app_c, stream, peer).await;
                });
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mime_type_for_path() {
        assert_eq!(mime_type_for_path("bundle.js"), "application/javascript");
        assert_eq!(mime_type_for_path("bundle.mjs"), "application/javascript");
        assert_eq!(mime_type_for_path("style.css"), "text/css");
        assert_eq!(mime_type_for_path("index.html"), "text/html; charset=utf-8");
        assert_eq!(mime_type_for_path("data.json"), "application/json");
        assert_eq!(mime_type_for_path("manifest.webmanifest"), "application/manifest+json");
        assert_eq!(mime_type_for_path("icon.svg"), "image/svg+xml");
        assert_eq!(mime_type_for_path("image.png"), "image/png");
        assert_eq!(mime_type_for_path("photo.jpg"), "image/jpeg");
        assert_eq!(mime_type_for_path("favicon.ico"), "image/x-icon");
        assert_eq!(mime_type_for_path("font.woff2"), "font/woff2");
        assert_eq!(mime_type_for_path("font.woff"), "font/woff");
        assert_eq!(mime_type_for_path("font.ttf"), "font/ttf");
        assert_eq!(mime_type_for_path("app.wasm"), "application/wasm");
        assert_eq!(mime_type_for_path("unknown.bin"), "application/octet-stream");
    }

    #[test]
    fn test_resolve_asset_path_traversal_prevention() {
        assert!(resolve_asset_path("../etc/passwd").is_none());
        assert!(resolve_asset_path("assets/../../etc/passwd").is_none());
        assert!(resolve_asset_path("..\\windows\\win.ini").is_none());
        assert!(resolve_asset_path("").is_none());
    }

    #[test]
    fn test_resolve_asset_path_finds_dist_assets() {
        if std::path::Path::new("dist/companion.html").is_file() {
            let res = resolve_asset_path("companion.html");
            assert!(res.is_some());
        }
    }
}

