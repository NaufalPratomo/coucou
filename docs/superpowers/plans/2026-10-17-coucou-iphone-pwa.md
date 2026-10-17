# Coucou iPhone Web Companion (PWA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, pure local iPhone Web Companion (PWA) hosted directly by `coucou.exe` on port `47822` with real-time media/karaoke sync, Antigravity agent controls, and animated Mochi.

**Architecture:** Embedded HTTP static server + WebSocket stream in `windows/src-tauri` on port `47822` with mDNS (`coucou.local`); frontend PWA built using Vite (`companion.html`) with pitch black OLED dark styling, haptic feedback, and local storage token persistence.

**Tech Stack:** Rust (Tauri v2, Tokio, tokio-tungstenite, mdns-sd), TypeScript, Vite, WebSockets, Canvas 2D, HTML5 Web Haptics.

## Global Constraints

- Platform: Windows host (`coucou.exe`) serving iOS Safari client.
- Network Mode: Pure Local (port `47822`), zero tunneling, zero external 24/7 server.
- mDNS Hostname: `coucou.local:47822` with manual IP fallback.
- Design: Pitch Black OLED (`#000000`), iOS Dynamic Island capsule aesthetic.
- Language: English UI copy, clean typography, no AI slop comments.

---

### Task 1: Web Companion Protocol & State Models

**Files:**
- Create: `windows/src-tauri/src/web_companion/protocol.rs`
- Create: `windows/src-tauri/src/web_companion/tests.rs`
- Create: `windows/src-tauri/src/web_companion/mod.rs`
- Modify: `windows/src-tauri/src/lib.rs`

**Interfaces:**
- Produces:
  - `pub enum InboundMessage`: `MediaAction { action: String, value: Option<f64> }`, `AgentDecision { request_id: String, allow: bool }`, `Ping`
  - `pub enum OutboundMessage`: `FullSync(StateSnapshot)`, `MediaTick { position_ms: u64 }`, `AgentPrompt(ApprovalPrompt)`, `Pong`
  - `pub struct StateSnapshot`: `media: Option<MediaState>`, `agent: Option<AgentState>`, `system: SystemState`

- [ ] **Step 1: Write the failing tests for serialization and deserialization**

```rust
// windows/src-tauri/src/web_companion/tests.rs
use super::protocol::*;

#[test]
fn test_parse_media_action() {
    let raw = r#"{"type":"media:action","payload":{"action":"playpause","value":null}}"#;
    let msg: InboundMessage = serde_json::from_str(raw).expect("must parse media action");
    match msg {
        InboundMessage::MediaAction { action, value } => {
            assert_eq!(action, "playpause");
            assert_eq!(value, None);
        }
        _ => panic!("wrong message type"),
    }
}

#[test]
fn test_parse_agent_decision() {
    let raw = r#"{"type":"agent:decision","payload":{"requestId":"req-123","allow":true}}"#;
    let msg: InboundMessage = serde_json::from_str(raw).expect("must parse agent decision");
    match msg {
        InboundMessage::AgentDecision { request_id, allow } => {
            assert_eq!(request_id, "req-123");
            assert!(allow);
        }
        _ => panic!("wrong message type"),
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test -p coucou --lib web_companion`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement protocol models and register module**

```rust
// windows/src-tauri/src/web_companion/protocol.rs
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", content = "payload")]
pub enum InboundMessage {
    #[serde(rename = "media:action")]
    MediaAction {
        action: String,
        value: Option<f64>,
    },
    #[serde(rename = "agent:decision")]
    AgentDecision {
        #[serde(rename = "requestId")]
        request_id: String,
        allow: bool,
    },
    #[serde(rename = "ping")]
    Ping,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct LyricLine {
    #[serde(rename = "timeMs")]
    pub time_ms: u64,
    pub text: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Default)]
pub struct MediaState {
    #[serde(rename = "isPlaying")]
    pub is_playing: bool,
    pub title: String,
    pub artist: String,
    #[serde(rename = "albumArt")]
    pub album_art: Option<String>,
    #[serde(rename = "durationMs")]
    pub duration_ms: u64,
    #[serde(rename = "positionMs")]
    pub position_ms: u64,
    pub lyrics: Vec<LyricLine>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Default)]
pub struct AgentState {
    pub status: String,
    #[serde(rename = "activeGoal")]
    pub active_goal: Option<String>,
    #[serde(rename = "currentTool")]
    pub current_tool: Option<String>,
    #[serde(rename = "pendingRequest")]
    pub pending_request: Option<ApprovalPrompt>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ApprovalPrompt {
    pub id: String,
    pub prompt: String,
    pub tool: Option<String>,
    pub command: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Default)]
pub struct SystemState {
    #[serde(rename = "batteryPercent")]
    pub battery_percent: u8,
    #[serde(rename = "isCharging")]
    pub is_charging: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Default)]
pub struct StateSnapshot {
    pub media: Option<MediaState>,
    pub agent: Option<AgentState>,
    pub system: SystemState,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", content = "payload")]
pub enum OutboundMessage {
    #[serde(rename = "sync:state")]
    FullSync(StateSnapshot),
    #[serde(rename = "media:tick")]
    MediaTick {
        #[serde(rename = "positionMs")]
        position_ms: u64,
    },
    #[serde(rename = "agent:request")]
    AgentPrompt(ApprovalPrompt),
    #[serde(rename = "pong")]
    Pong,
}
```

```rust
// windows/src-tauri/src/web_companion/mod.rs
pub mod protocol;
pub mod server;
#[cfg(test)]
mod tests;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test -p coucou --lib web_companion`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add windows/src-tauri/src/web_companion/
git commit -m "feat(companion): add web companion protocol models and tests"
```

---

### Task 2: Embedded HTTP & WebSocket Server Engine

**Files:**
- Create: `windows/src-tauri/src/web_companion/server.rs`
- Modify: `windows/src-tauri/src/web_companion/mod.rs`
- Modify: `windows/src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: `windows/src-tauri/src/web_companion/protocol.rs`
- Produces: `pub fn start_web_companion(app: tauri::AppHandle, port: u16) -> tokio::task::JoinHandle<()>`

- [ ] **Step 1: Write integration test for HTTP root endpoint and WebSocket upgrade**

```rust
// windows/src-tauri/src/web_companion/tests.rs (append)
#[tokio::test]
async fn test_http_response_headers() {
    let headers = super::server::http_response(200, "text/html; charset=utf-8", "<h1>Coucou</h1>".as_bytes());
    let text = String::from_utf8_lossy(&headers);
    assert!(text.contains("HTTP/1.1 200 OK"));
    assert!(text.contains("Content-Type: text/html"));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test -p coucou --lib web_companion::tests::test_http_response_headers`
Expected: FAIL (`http_response` not found).

- [ ] **Step 3: Implement HTTP static responder and WebSocket upgrade dispatcher**

```rust
// windows/src-tauri/src/web_companion/server.rs
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
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

    if req_header.contains("Upgrade: websocket") || req_header.contains("upgrade: websocket") {
        if let Ok(ws_stream) = tokio_tungstenite::accept_async(stream).await {
            handle_ws_session(app, ws_stream, addr).await;
        }
        return;
    }

    // Handle HTTP GET
    let mut full_buf = vec![0u8; n];
    let _ = stream.read_exact(&mut full_buf).await;
    let path = req_header
        .lines()
        .next()
        .and_then(|l| l.split_whitespace().nth(1))
        .unwrap_or("/");

    let (content_type, body) = match path {
        "/" | "/companion.html" => ("text/html; charset=utf-8", include_bytes!("../../../companion.html").as_slice()),
        "/manifest.json" => ("application/manifest+json", include_bytes!("../../../src/companion/manifest.json").as_slice()),
        _ => ("text/plain", "Not Found".as_bytes()),
    };

    let resp = http_response(200, content_type, body);
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
        let _ = ws.send(Message::Text(json)).await;
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
                        let _ = ws.send(Message::Text(pong)).await;
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test -p coucou --lib web_companion`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add windows/src-tauri/src/web_companion/
git commit -m "feat(companion): add embedded http and websocket server"
```

---

### Task 3: Pairing Security & Settings Integration

**Files:**
- Create: `windows/src-tauri/src/web_companion/pairing.rs`
- Modify: `windows/src-tauri/src/settings.rs`
- Modify: `windows/settings.html`
- Modify: `windows/src/settings/`

**Interfaces:**
- Produces:
  - `pub fn get_companion_token() -> String`
  - `pub fn verify_token(provided: &str) -> bool`
  - Tauri command `pub fn get_companion_qr() -> String`

- [ ] **Step 1: Write test for token generation and verification**

```rust
// windows/src-tauri/src/web_companion/tests.rs (append)
#[test]
fn test_token_verification() {
    let token = super::pairing::get_or_create_token();
    assert!(!token.is_empty());
    assert!(super::pairing::verify_token(&token));
    assert!(!super::pairing::verify_token("invalid_token"));
}
```

- [ ] **Step 2: Run test to verify failure**

Run: `cargo test -p coucou --lib web_companion::tests::test_token_verification`
Expected: FAIL (module not defined).

- [ ] **Step 3: Implement pairing token storage and QR generation**

```rust
// windows/src-tauri/src/web_companion/pairing.rs
use std::sync::Mutex;
use qrcode::QrCode;
use qrcode::render::svg;

static TOKEN: Mutex<Option<String>> = Mutex::new(None);

pub fn get_or_create_token() -> String {
    let mut lock = TOKEN.lock().unwrap();
    if let Some(ref t) = *lock {
        return t.clone();
    }
    let new_tok = format!("{:08x}{:08x}", rand::random::<u32>(), rand::random::<u32>());
    *lock = Some(new_tok.clone());
    new_tok
}

pub fn verify_token(provided: &str) -> bool {
    let token = get_or_create_token();
    provided.trim() == token.trim()
}

pub fn generate_qr_svg() -> String {
    let token = get_or_create_token();
    let url = format!("http://coucou.local:47822?token={token}");
    let code = QrCode::new(url.as_bytes()).unwrap();
    code.render::<svg::Color>().min_dimensions(200, 200).build()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test -p coucou --lib web_companion`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add windows/src-tauri/src/web_companion/pairing.rs
git commit -m "feat(companion): add pairing token and qr generation"
```

---

### Task 4: iPhone PWA HTML Shell, Manifest, & OLED Dark Styling

**Files:**
- Create: `windows/companion.html`
- Create: `windows/src/companion/manifest.json`
- Create: `windows/src/companion/style.css`
- Modify: `windows/vite.config.ts`

**Interfaces:**
- Produces: Built entry point `companion.html` in `windows/dist/` ready for iOS Safari standalone mode.

- [ ] **Step 1: Create Web App Manifest**

```json
// windows/src/companion/manifest.json
{
  "name": "Coucou Companion",
  "short_name": "Coucou",
  "start_url": "/companion.html",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/128x128.png",
      "sizes": "128x128",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 2: Create companion.html with iOS PWA meta tags**

```html
<!-- windows/companion.html -->
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Coucou">
  <link rel="manifest" href="/manifest.json">
  <title>Coucou Companion</title>
  <link rel="stylesheet" href="./src/companion/style.css">
</head>
<body class="bg-black text-white antialiased select-none overflow-hidden touch-none">
  <div id="app" class="flex flex-col h-screen w-screen px-4 pt-safe pb-safe">
    <!-- Dynamic Island Container -->
    <header id="dynamic-island" class="flex justify-center pt-3 pb-2">
      <div class="island-pill flex items-center justify-between px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-full w-full max-w-xs shadow-2xl">
        <canvas id="mochi-canvas" width="36" height="36" class="rounded-full"></canvas>
        <span id="island-status" class="text-xs font-medium tracking-wide text-neutral-300">Coucou Ready</span>
        <div id="battery-indicator" class="flex items-center space-x-1 text-xs text-neutral-400">
          <span id="battery-level">100%</span>
        </div>
      </div>
    </header>

    <!-- Tab Navigation -->
    <nav class="flex justify-around my-2 border-b border-neutral-900 pb-2">
      <button data-tab="music" class="tab-btn active text-sm font-semibold text-white px-3 py-1">Music & Lyrics</button>
      <button data-tab="agent" class="tab-btn text-sm font-semibold text-neutral-500 px-3 py-1">Antigravity</button>
    </nav>

    <!-- Main Viewport -->
    <main id="tab-content" class="flex-1 relative overflow-hidden">
      <!-- Music Tab -->
      <section id="tab-music" class="tab-pane active flex flex-col h-full">
        <div id="media-card" class="flex items-center space-x-4 p-3 bg-neutral-950 rounded-2xl border border-neutral-900">
          <img id="album-art" src="" alt="Cover" class="w-16 h-16 rounded-xl bg-neutral-900 object-cover shadow-lg" />
          <div class="flex-1 min-w-0">
            <h2 id="track-title" class="text-base font-bold truncate text-white">No Track Playing</h2>
            <p id="track-artist" class="text-xs text-neutral-400 truncate">Connect to Coucou</p>
          </div>
        </div>

        <!-- Karaoke Scrolling Lyrics -->
        <div id="lyrics-container" class="flex-1 overflow-y-auto my-4 text-center space-y-4 px-2 scroll-smooth">
          <p class="text-neutral-600 text-sm italic">Waiting for music...</p>
        </div>

        <!-- Playback Controls -->
        <div class="flex items-center justify-around py-4 bg-neutral-950/80 backdrop-blur rounded-2xl border border-neutral-900">
          <button id="btn-prev" class="p-3 text-white active:scale-95 transition-transform">⏮️</button>
          <button id="btn-play" class="p-4 bg-white text-black rounded-full text-lg font-bold shadow active:scale-95 transition-transform">▶</button>
          <button id="btn-next" class="p-3 text-white active:scale-95 transition-transform">⏭️</button>
        </div>
      </section>

      <!-- Antigravity Tab -->
      <section id="tab-agent" class="tab-pane hidden flex flex-col h-full justify-between p-2">
        <div id="agent-status-card" class="p-4 bg-neutral-950 rounded-2xl border border-neutral-900">
          <span class="text-xs uppercase font-semibold text-neutral-500">Agent Status</span>
          <h3 id="agent-state-label" class="text-lg font-bold text-emerald-400 mt-1">Idle</h3>
          <p id="agent-goal" class="text-sm text-neutral-300 mt-2">No active tasks</p>
        </div>

        <!-- Approval Prompt Card -->
        <div id="approval-card" class="hidden p-5 bg-neutral-900 rounded-3xl border border-neutral-700 shadow-2xl space-y-4">
          <span class="text-xs font-bold uppercase text-amber-400 tracking-wider">Action Approval Required</span>
          <p id="approval-prompt-text" class="text-sm font-medium text-white"></p>
          <div class="flex space-x-3 pt-2">
            <button id="btn-deny" class="flex-1 py-3 bg-red-600 active:bg-red-700 text-white font-bold rounded-xl active:scale-95 transition-transform">Deny</button>
            <button id="btn-allow" class="flex-1 py-3 bg-emerald-500 active:bg-emerald-600 text-black font-bold rounded-xl active:scale-95 transition-transform">Allow</button>
          </div>
        </div>
      </section>
    </main>
  </div>
  <script type="module" src="./src/companion/main.ts"></script>
</body>
</html>
```

- [ ] **Step 3: Register `companion.html` in `windows/vite.config.ts`**

Add `companion: resolve(__dirname, "companion.html")` into `rollupOptions.input`.

- [ ] **Step 4: Verify build succeeds**

Run: `npm run build` in `windows/`
Expected: PASS, outputs `dist/companion.html`.

- [ ] **Step 5: Commit**

```bash
git add windows/companion.html windows/src/companion/ windows/vite.config.ts
git commit -m "feat(companion): add companion html shell, manifest, and vite bundle entry"
```

---

### Task 5: WebSocket Client & Auto-Reconnect Engine

**Files:**
- Create: `windows/src/companion/ws.ts`
- Create: `windows/src/companion/main.ts`

**Interfaces:**
- Produces:
  - `class CompanionClient`
  - Events: `onStateSync(state)`, `onMediaTick(pos)`, `onAgentPrompt(prompt)`, `onDisconnect()`
  - Methods: `sendMediaAction(action, value)`, `sendDecision(requestId, allow)`

- [ ] **Step 1: Write WebSocket client with localStorage token handling**

```typescript
// windows/src/companion/ws.ts
export interface LyricLine {
  timeMs: number;
  text: string;
}

export interface MediaState {
  isPlaying: boolean;
  title: string;
  artist: string;
  albumArt?: string;
  durationMs: number;
  positionMs: number;
  lyrics: LyricLine[];
}

export interface ApprovalPrompt {
  id: string;
  prompt: string;
  tool?: string;
  command?: string;
}

export interface AgentState {
  status: string;
  activeGoal?: string;
  currentTool?: string;
  pendingRequest?: ApprovalPrompt;
}

export interface StateSnapshot {
  media?: MediaState;
  agent?: AgentState;
  system: {
    batteryPercent: number;
    isCharging: boolean;
  };
}

export class CompanionClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;

  constructor(
    private onState: (state: StateSnapshot) => void,
    private onTick: (posMs: number) => void,
    private onPrompt: (prompt: ApprovalPrompt) => void,
    private onStatusChange: (connected: boolean) => void
  ) {}

  public connect() {
    const params = new URLSearchParams(window.location.search);
    let token = params.get("token");
    if (token) {
      localStorage.setItem("coucou_token", token);
    } else {
      token = localStorage.getItem("coucou_token");
    }

    const host = window.location.hostname || "coucou.local";
    const port = window.location.port || "47822";
    const wsUrl = `ws://${host}:${port}/ws?token=${token || ""}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.onStatusChange(true);
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "sync:state") this.onState(msg.payload);
        else if (msg.type === "media:tick") this.onTick(msg.payload.positionMs);
        else if (msg.type === "agent:request") this.onPrompt(msg.payload);
      } catch (e) {
        console.error("Failed to parse WS msg", e);
      }
    };

    this.ws.onclose = () => {
      this.onStatusChange(false);
      this.reconnectTimer = window.setTimeout(() => this.connect(), 2000);
    };
  }

  public sendMediaAction(action: string, value?: number) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "media:action", payload: { action, value } }));
    }
  }

  public sendDecision(requestId: string, allow: bool) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "agent:decision", payload: { requestId, allow } }));
    }
  }
}
```

- [ ] **Step 2: Connect client in `windows/src/companion/main.ts`**

```typescript
// windows/src/companion/main.ts
import { CompanionClient } from "./ws";

const statusEl = document.getElementById("island-status")!;
const batteryEl = document.getElementById("battery-level")!;

const client = new CompanionClient(
  (state) => {
    if (state.system) {
      batteryEl.textContent = `${state.system.batteryPercent}%${state.system.isCharging ? " ⚡" : ""}`;
    }
  },
  (pos) => {},
  (prompt) => {},
  (connected) => {
    statusEl.textContent = connected ? "Coucou Connected" : "Reconnecting...";
    statusEl.className = connected ? "text-xs font-medium text-emerald-400" : "text-xs font-medium text-amber-400";
  }
);

client.connect();
```

- [ ] **Step 3: Run TypeScript compiler check**

Run: `npm run build` in `windows/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add windows/src/companion/ws.ts windows/src/companion/main.ts
git commit -m "feat(companion): add websocket client and auto-reconnect engine"
```

---

### Task 6: Remote Music Controller & Karaoke Lyrics Auto-Scroll

**Files:**
- Create: `windows/src/companion/components/MusicPlayer.ts`
- Create: `windows/src/companion/components/KaraokeLyrics.ts`
- Modify: `windows/src/companion/main.ts`

**Interfaces:**
- Produces:
  - `updateMediaState(media: MediaState)`
  - `updatePosition(posMs: number)`
  - Smooth auto-scroll with active line highlight

- [ ] **Step 1: Implement KaraokeLyrics component**

```typescript
// windows/src/companion/components/KaraokeLyrics.ts
import { LyricLine } from "../ws";

export class KaraokeLyrics {
  private activeIndex: number = -1;
  private lines: LyricLine[] = [];

  constructor(private container: HTMLElement, private onSeek: (timeMs: number) => void) {}

  public setLyrics(lines: LyricLine[]) {
    this.lines = lines;
    this.container.innerHTML = "";
    if (lines.length === 0) {
      this.container.innerHTML = '<p class="text-neutral-600 text-sm italic">No synced lyrics available</p>';
      return;
    }

    lines.forEach((line, index) => {
      const p = document.createElement("p");
      p.className = "lyric-line transition-all duration-300 text-base font-medium text-neutral-500 cursor-pointer py-1";
      p.textContent = line.text;
      p.dataset.index = String(index);
      p.onclick = () => {
        if ("vibrate" in navigator) navigator.vibrate(10);
        this.onSeek(line.timeMs);
      };
      this.container.appendChild(p);
    });
  }

  public updateTime(currentMs: number) {
    if (this.lines.length === 0) return;

    let index = -1;
    for (let i = 0; i < this.lines.length; i++) {
      if (this.lines[i].timeMs <= currentMs) {
        index = i;
      } else {
        break;
      }
    }

    if (index !== this.activeIndex && index >= 0) {
      this.activeIndex = index;
      const elements = this.container.querySelectorAll(".lyric-line");
      elements.forEach((el, i) => {
        if (i === index) {
          el.className = "lyric-line transition-all duration-300 text-xl font-bold text-white scale-105 py-2";
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          el.className = "lyric-line transition-all duration-300 text-base font-medium text-neutral-500 opacity-40 py-1";
        }
      });
    }
  }
}
```

- [ ] **Step 2: Wire MusicPlayer controls with haptics**

```typescript
// windows/src/companion/components/MusicPlayer.ts
import { CompanionClient, MediaState } from "../ws";
import { KaraokeLyrics } from "./KaraokeLyrics";

export function setupMusicPlayer(client: CompanionClient) {
  const titleEl = document.getElementById("track-title")!;
  const artistEl = document.getElementById("track-artist")!;
  const albumArtEl = document.getElementById("album-art") as HTMLImageElement;
  const btnPlay = document.getElementById("btn-play")!;
  const btnPrev = document.getElementById("btn-prev")!;
  const btnNext = document.getElementById("btn-next")!;
  const lyricsContainer = document.getElementById("lyrics-container")!;

  const lyrics = new KaraokeLyrics(lyricsContainer, (timeMs) => {
    client.sendMediaAction("seek", timeMs);
  });

  btnPlay.onclick = () => {
    if ("vibrate" in navigator) navigator.vibrate(15);
    client.sendMediaAction("playpause");
  };

  btnPrev.onclick = () => {
    if ("vibrate" in navigator) navigator.vibrate(15);
    client.sendMediaAction("previous");
  };

  btnNext.onclick = () => {
    if ("vibrate" in navigator) navigator.vibrate(15);
    client.sendMediaAction("next");
  };

  return {
    update(media?: MediaState) {
      if (!media) return;
      titleEl.textContent = media.title || "No Track";
      artistEl.textContent = media.artist || "Unknown Artist";
      if (media.albumArt) albumArtEl.src = media.albumArt;
      btnPlay.textContent = media.isPlaying ? "⏸" : "▶";
      lyrics.setLyrics(media.lyrics || []);
    },
    tick(posMs: number) {
      lyrics.updateTime(posMs);
    },
  };
}
```

- [ ] **Step 3: Run TypeScript compiler check**

Run: `npm run build` in `windows/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add windows/src/companion/components/
git commit -m "feat(companion): add remote music controls and karaoke lyrics auto-scroller"
```

---

### Task 7: Antigravity Agent Controller & Interactive Decision Cards

**Files:**
- Create: `windows/src/companion/components/AntigravityCard.ts`
- Modify: `windows/src/companion/main.ts`

**Interfaces:**
- Produces:
  - Interactive Allow/Deny card with vibration alert
  - Live agent status badge (`Thinking`, `Tool Running`, `Idle`)

- [ ] **Step 1: Implement AntigravityCard component**

```typescript
// windows/src/companion/components/AntigravityCard.ts
import { ApprovalPrompt, CompanionClient, AgentState } from "../ws";

export function setupAntigravityCard(client: CompanionClient) {
  const statusLabel = document.getElementById("agent-state-label")!;
  const goalEl = document.getElementById("agent-goal")!;
  const approvalCard = document.getElementById("approval-card")!;
  const promptText = document.getElementById("approval-prompt-text")!;
  const btnAllow = document.getElementById("btn-allow")!;
  const btnDeny = document.getElementById("btn-deny")!;

  let currentRequestId: string | null = null;

  btnAllow.onclick = () => {
    if (currentRequestId) {
      if ("vibrate" in navigator) navigator.vibrate([30, 50, 30]);
      client.sendDecision(currentRequestId, true);
      approvalCard.classList.add("hidden");
      currentRequestId = null;
    }
  };

  btnDeny.onclick = () => {
    if (currentRequestId) {
      if ("vibrate" in navigator) navigator.vibrate(60);
      client.sendDecision(currentRequestId, false);
      approvalCard.classList.add("hidden");
      currentRequestId = null;
    }
  };

  return {
    update(agent?: AgentState) {
      if (!agent) return;
      statusLabel.textContent = agent.status;
      goalEl.textContent = agent.activeGoal || "No active tasks";
      if (agent.pendingRequest) {
        this.prompt(agent.pendingRequest);
      }
    },
    prompt(req: ApprovalPrompt) {
      currentRequestId = req.id;
      promptText.textContent = req.prompt;
      approvalCard.classList.remove("hidden");
      if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
    },
  };
}
```

- [ ] **Step 2: Connect AntigravityCard in `main.ts`**

Update `main.ts` to instantiate `setupAntigravityCard` and forward updates on state sync.

- [ ] **Step 3: Run TypeScript compiler check**

Run: `npm run build` in `windows/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add windows/src/companion/components/AntigravityCard.ts windows/src/companion/main.ts
git commit -m "feat(companion): add antigravity remote approval card and status monitor"
```

---

### Task 8: Mochi Canvas Animation & System Health Widget

**Files:**
- Create: `windows/src/companion/components/MochiCanvas.ts`
- Modify: `windows/src/companion/main.ts`

**Interfaces:**
- Produces: 60fps lightweight 2D canvas Mochi character reflecting state (idle blink, music bounce, alert).

- [ ] **Step 1: Implement MochiCanvas component**

```typescript
// windows/src/companion/components/MochiCanvas.ts
export class MochiCanvas {
  private ctx: CanvasRenderingContext2D;
  private frame: number = 0;
  private isBouncing: boolean = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.loop();
  }

  public setMusicPlaying(playing: boolean) {
    this.isBouncing = playing;
  }

  private loop = () => {
    this.frame++;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, 36, 36);

    const bounce = this.isBouncing ? Math.sin(this.frame * 0.15) * 2 : 0;

    // Body
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(18, 18 + bounce, 12, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = "#111111";
    const blink = this.frame % 140 < 5;
    if (blink) {
      ctx.fillRect(13, 17 + bounce, 3, 1);
      ctx.fillRect(20, 17 + bounce, 3, 1);
    } else {
      ctx.beginPath();
      ctx.arc(14, 17 + bounce, 1.5, 0, Math.PI * 2);
      ctx.arc(21, 17 + bounce, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Blush
    ctx.fillStyle = "rgba(255, 100, 150, 0.4)";
    ctx.beginPath();
    ctx.arc(11, 20 + bounce, 2, 0, Math.PI * 2);
    ctx.arc(24, 20 + bounce, 2, 0, Math.PI * 2);
    ctx.fill();

    requestAnimationFrame(this.loop);
  };
}
```

- [ ] **Step 2: Connect MochiCanvas to `main.ts`**

Instantiate `MochiCanvas` with `document.getElementById('mochi-canvas')` and link `setMusicPlaying` to media state changes.

- [ ] **Step 3: Run TypeScript compiler check**

Run: `npm run build` in `windows/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add windows/src/companion/components/MochiCanvas.ts windows/src/companion/main.ts
git commit -m "feat(companion): add animated mochi canvas and system health widget"
```

---

### Task 9: End-to-End Build & Verification

**Files:**
- Modify: `windows/src-tauri/src/lib.rs` (start web companion on app launch)
- Verify: Full Cargo build + Vitest / unit tests

- [ ] **Step 1: Register and launch web companion in `src-tauri/src/lib.rs`**

```rust
// In windows/src-tauri/src/lib.rs setup hook:
web_companion::server::start_web_companion(app.handle().clone(), web_companion::server::DEFAULT_COMPANION_PORT);
```

- [ ] **Step 2: Run all Rust backend unit tests**

Run: `cargo test -p coucou --lib web_companion`
Expected: All tests PASS.

- [ ] **Step 3: Run full TypeScript and Vite build**

Run: `npm run build` in `windows/`
Expected: All bundles compile with zero errors.

- [ ] **Step 4: Commit final integration**

```bash
git add windows/src-tauri/src/lib.rs
git commit -m "feat(companion): wire web companion server startup into coucou desktop"
```
