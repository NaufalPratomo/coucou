use std::net::SocketAddr;
use std::sync::{LazyLock, Mutex};
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

pub fn is_icon_path(path: &str) -> bool {
    path == "/icon.png" || path == "/apple-touch-icon.png" || path == "/apple-touch-icon-precomposed.png"
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
    } else if path == "/icon.png" || path == "/apple-touch-icon.png" || path == "/apple-touch-icon-precomposed.png" {
        (200, "image/png".to_string(), include_bytes!("../../../src-tauri/icons/icon.png").to_vec())
    } else if let Some((bytes, mime)) = resolve_asset_file(&app, path) {
        (200, mime, bytes)
    } else {
        (404, "text/plain".to_string(), b"Not Found".to_vec())
    };

    let resp = http_response(code, &content_type, &body);
    let _ = stream.write_all(&resp).await;
    let _ = stream.flush().await;
}

#[repr(C)]
struct SystemPowerStatus {
    ac_line_status: u8,
    battery_flag: u8,
    battery_life_percent: u8,
    system_status_flag: u8,
    battery_life_time: u32,
    battery_full_life_time: u32,
}

#[cfg(windows)]
#[link(name = "kernel32")]
extern "system" {
    fn GetSystemPowerStatus(lpSystemPowerStatus: *mut SystemPowerStatus) -> i32;
}

pub fn get_system_battery() -> (u8, bool) {
    #[cfg(windows)]
    unsafe {
        let mut status = SystemPowerStatus {
            ac_line_status: 255,
            battery_flag: 255,
            battery_life_percent: 255,
            system_status_flag: 0,
            battery_life_time: 0,
            battery_full_life_time: 0,
        };
        if GetSystemPowerStatus(&mut status) != 0 {
            let percent = if status.battery_life_percent <= 100 {
                status.battery_life_percent
            } else {
                100
            };
            let is_charging = status.ac_line_status == 1;
            return (percent, is_charging);
        }
    }
    (100, true)
}

fn now_ms() -> f64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs_f64() * 1000.0)
        .unwrap_or(0.0)
}

#[derive(Clone, Debug, Default)]
struct HookAgentState {
    status: String,
    active_goal: Option<String>,
    current_tool: Option<String>,
    pending_request: Option<ApprovalPrompt>,
    last_event_time: u64,
}

static HOOK_AGENT_STATE: LazyLock<Mutex<HookAgentState>> = LazyLock::new(|| {
    Mutex::new(HookAgentState {
        status: "idle".to_string(),
        active_goal: None,
        current_tool: None,
        pending_request: None,
        last_event_time: 0,
    })
});

pub fn record_hook_event(event: &str, payload: &serde_json::Value) {
    let now = (now_ms()) as u64;
    let mut state = HOOK_AGENT_STATE.lock().unwrap();
    state.last_event_time = now;

    match event {
        "PreToolUse" => {
            state.status = "running".to_string();
            state.current_tool = payload.get("tool").or_else(|| payload.get("tool_name")).and_then(|v| v.as_str()).map(|s| s.to_string());
        }
        "PostToolUse" => {
            state.status = "running".to_string();
            state.current_tool = None;
        }
        "UserPrompt" => {
            state.status = "running".to_string();
            state.active_goal = payload.get("prompt").or_else(|| payload.get("message")).and_then(|v| v.as_str()).map(|s| s.to_string());
        }
        "SessionStart" => {
            state.status = "running".to_string();
        }
        "SessionEnd" => {
            state.status = "idle".to_string();
            state.current_tool = None;
            state.active_goal = None;
            state.pending_request = None;
        }
        _ => {}
    }
}

pub fn record_permission_request(id: &str, payload: &serde_json::Value) {
    let now = (now_ms()) as u64;
    let mut state = HOOK_AGENT_STATE.lock().unwrap();
    state.last_event_time = now;
    state.status = "waiting_confirmation".to_string();

    let tool = payload.get("tool").or_else(|| payload.get("tool_name")).and_then(|v| v.as_str()).map(|s| s.to_string());
    let command = payload.get("command").or_else(|| payload.get("cmd")).and_then(|v| v.as_str()).map(|s| s.to_string());
    let prompt = payload.get("prompt").or_else(|| payload.get("message")).and_then(|v| v.as_str()).unwrap_or("Action approval required").to_string();

    state.pending_request = Some(ApprovalPrompt {
        id: id.to_string(),
        prompt,
        tool,
        command,
    });
}

pub fn clear_permission_request(id: &str) {
    let mut state = HOOK_AGENT_STATE.lock().unwrap();
    if state.pending_request.as_ref().is_some_and(|r| r.id == id) {
        state.pending_request = None;
        state.status = "running".to_string();
    }
}

pub async fn build_snapshot(app: &AppHandle) -> StateSnapshot {
    let player = spotify::spotify_refresh(app.clone()).await;
    let media = player.and_then(|p| {
        let track = p.track.clone()?;
        let now = now_ms();
        let pos_secs = p.position_at_time(now);
        let pos_ms = (pos_secs * 1000.0).max(0.0) as u64;
        let dur_ms = (track.duration * 1000.0).max(0.0) as u64;

        let album_art = track.art_url.as_ref().and_then(|art_key| {
            spotify::get_cached_artwork(art_key).or_else(|| {
                if art_key.starts_with("http") || art_key.starts_with("data:") {
                    Some(art_key.clone())
                } else {
                    None
                }
            })
        });

        Some(MediaState {
            is_playing: p.playing,
            title: track.title,
            artist: track.artist,
            album_art,
            duration_ms: dur_ms,
            position_ms: pos_ms,
            lyrics: Vec::new(),
        })
    });

    let (battery_percent, is_charging) = get_system_battery();
    let system = SystemState {
        battery_percent,
        is_charging,
    };

    let now = (now_ms()) as u64;
    let hook_state = HOOK_AGENT_STATE.lock().unwrap().clone();

    let has_pipe_pending = app.try_state::<pipe::Pending>().map(|p| {
        let lock = p.0.lock().unwrap();
        !lock.is_empty()
    }).unwrap_or(false);

    let agent = if hook_state.pending_request.is_some() || has_pipe_pending {
        Some(AgentState {
            status: "Waiting for Confirmation".to_string(),
            active_goal: hook_state.active_goal,
            current_tool: hook_state.current_tool,
            pending_request: hook_state.pending_request,
        })
    } else if hook_state.status != "idle" && now.saturating_sub(hook_state.last_event_time) < 45_000 {
        Some(AgentState {
            status: "Running".to_string(),
            active_goal: hook_state.active_goal,
            current_tool: hook_state.current_tool,
            pending_request: None,
        })
    } else {
        Some(AgentState {
            status: "Idle".to_string(),
            active_goal: None,
            current_tool: None,
            pending_request: None,
        })
    };

    StateSnapshot {
        media,
        agent,
        system,
    }
}

pub async fn handle_ws_session(
    app: AppHandle,
    ws: tokio_tungstenite::WebSocketStream<TcpStream>,
    _addr: SocketAddr,
) {
    let (mut ws_tx, mut ws_rx) = ws.split();

    let initial_snapshot = build_snapshot(&app).await;
    let initial_state = OutboundMessage::FullSync(initial_snapshot);
    if let Ok(json) = serde_json::to_string(&initial_state) {
        let _ = ws_tx.send(Message::Text(json.into())).await;
    }

    let (out_tx, mut out_rx) = tokio::sync::mpsc::channel::<OutboundMessage>(32);
    let (stop_tx, mut stop_rx) = tokio::sync::oneshot::channel::<()>();

    let app_broadcaster = app.clone();
    let out_tx_broadcaster = out_tx.clone();
    tauri::async_runtime::spawn(async move {
        let mut ticker = tokio::time::interval(std::time::Duration::from_millis(1000));
        loop {
            tokio::select! {
                _ = &mut stop_rx => break,
                _ = ticker.tick() => {
                    let snap = build_snapshot(&app_broadcaster).await;
                    if out_tx_broadcaster.send(OutboundMessage::FullSync(snap)).await.is_err() {
                        break;
                    }
                }
            }
        }
    });

    let writer_task = tauri::async_runtime::spawn(async move {
        while let Some(msg) = out_rx.recv().await {
            if let Ok(json) = serde_json::to_string(&msg) {
                if ws_tx.send(Message::Text(json.into())).await.is_err() {
                    break;
                }
            }
        }
        let _ = ws_tx.close().await;
    });

    while let Some(Ok(msg)) = ws_rx.next().await {
        if let Message::Text(txt) = msg {
            if let Ok(inbound) = serde_json::from_str::<InboundMessage>(&txt) {
                match inbound {
                    InboundMessage::MediaAction { action, value } => {
                        let normalized_action = match action.to_ascii_lowercase().as_str() {
                            "playpause" | "play_pause" | "toggle" => "playPause".to_string(),
                            "prev" | "previous" => "previous".to_string(),
                            "next" => "next".to_string(),
                            "seek" => "seek".to_string(),
                            a => a.to_string(),
                        };
                        let app_clone = app.clone();
                        let out_tx_action = out_tx.clone();
                        tauri::async_runtime::spawn(async move {
                            spotify::spotify_control(app_clone.clone(), normalized_action, value).await;
                            tokio::time::sleep(std::time::Duration::from_millis(150)).await;
                            let snap = build_snapshot(&app_clone).await;
                            let _ = out_tx_action.send(OutboundMessage::FullSync(snap)).await;
                        });
                    }
                    InboundMessage::AgentDecision { request_id, allow } => {
                        let word = if allow { "allow" } else { "deny" };
                        pipe::answer(&app, &request_id, word);
                        let app_clone = app.clone();
                        let out_tx_dec = out_tx.clone();
                        tauri::async_runtime::spawn(async move {
                            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                            let snap = build_snapshot(&app_clone).await;
                            let _ = out_tx_dec.send(OutboundMessage::FullSync(snap)).await;
                        });
                    }
                    InboundMessage::ChatSend { text, mode } => {
                        let text_trim = text.trim().to_string();
                        if text_trim.is_empty() {
                            continue;
                        }

                        // 1. Copy to laptop clipboard
                        if let Ok(mut clipboard) = arboard::Clipboard::new() {
                            let _ = clipboard.set_text(text_trim.clone());
                        }

                        // 2. Notify laptop desktop island
                        use tauri::Emitter;
                        let _ = app.emit_to(crate::island::WINDOW_LABEL, "remote-chat", text_trim.clone());

                        let app_clone = app.clone();
                        let out_tx_chat = out_tx.clone();
                        let mode_str = mode.unwrap_or_else(|| "ai".to_string());

                        tauri::async_runtime::spawn(async move {
                            let _ = out_tx_chat.send(OutboundMessage::ChatReply {
                                text: text_trim.clone(),
                                is_user: true,
                            }).await;

                            if mode_str == "clip" {
                                let _ = out_tx_chat.send(OutboundMessage::ChatReply {
                                    text: "Copied to PC clipboard! Ready to paste (Ctrl+V) on laptop.".to_string(),
                                    is_user: false,
                                }).await;
                                return;
                            }

                            let settings = app_clone.state::<crate::Shared>().settings.lock().unwrap().clone();
                            if let Some(chat) = app_clone.try_state::<crate::chat::Chat>() {
                                match crate::chat::send(&app_clone, &chat, &settings, text_trim, None).await {
                                    Ok(reply) => {
                                        let _ = out_tx_chat.send(OutboundMessage::ChatReply {
                                            text: reply.text,
                                            is_user: false,
                                        }).await;
                                    }
                                    Err(err) => {
                                        let _ = out_tx_chat.send(OutboundMessage::ChatReply {
                                            text: format!("AI Assistant: {err}"),
                                            is_user: false,
                                        }).await;
                                    }
                                }
                            } else {
                                let _ = out_tx_chat.send(OutboundMessage::ChatReply {
                                    text: "Copied to PC clipboard!".to_string(),
                                    is_user: false,
                                }).await;
                            }
                        });
                    }
                    InboundMessage::Ping => {
                        let _ = out_tx.send(OutboundMessage::Pong).await;
                    }
                }
            }
        }
    }

    let _ = stop_tx.send(());
    let _ = writer_task.await;
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

