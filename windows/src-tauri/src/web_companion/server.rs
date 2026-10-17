use std::net::SocketAddr;
use futures_util::{SinkExt, StreamExt};
use tauri::AppHandle;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::tungstenite::Message;

use super::protocol::*;
use crate::{log, pipe, spotify};

pub const DEFAULT_COMPANION_PORT: u16 = 47822;

pub fn http_response(code: u16, content_type: &str, body: &[u8]) -> Vec<u8> {
    let status_str = match code {
        200 => "OK",
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

pub async fn handle_connection(app: AppHandle, mut stream: TcpStream, addr: SocketAddr) {
    let mut buf = [0u8; 2048];
    let n = match stream.peek(&mut buf).await {
        Ok(n) if n > 0 => n,
        _ => return,
    };
    let req_header = String::from_utf8_lossy(&buf[..n]);

    let req_lower = req_header.to_ascii_lowercase();
    if req_lower.contains("upgrade: websocket") {
        if let Ok(ws_stream) = tokio_tungstenite::accept_async(stream).await {
            handle_ws_session(app, ws_stream, addr).await;
        }
        return;
    }

    // Handle HTTP GET
    let mut full_buf = vec![0u8; n];
    let _ = stream.read_exact(&mut full_buf).await;
    let raw_path = req_header
        .lines()
        .next()
        .and_then(|l| l.split_whitespace().nth(1))
        .unwrap_or("/");
    let path = raw_path.split('?').next().unwrap_or(raw_path);

    let (code, content_type, body) = match path {
        "/" | "/companion.html" => (200, "text/html; charset=utf-8", include_bytes!("../../../companion.html").as_slice()),
        "/manifest.json" => (200, "application/manifest+json", include_bytes!("../../../src/companion/manifest.json").as_slice()),
        _ => (404, "text/plain", "Not Found".as_bytes()),
    };

    let resp = http_response(code, content_type, body);
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
                        tokio::spawn(async move {
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

pub fn start_web_companion(app: AppHandle, port: u16) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
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
                tokio::spawn(async move {
                    handle_connection(app_c, stream, peer).await;
                });
            }
        }
    })
}
