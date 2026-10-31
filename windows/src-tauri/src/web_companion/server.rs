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

#[cfg(test)]
pub(crate) fn current_hook_agent_state() -> (String, Option<String>, Option<String>) {
    let s = HOOK_AGENT_STATE.lock().unwrap();
    (s.status.clone(), s.active_goal.clone(), s.current_tool.clone())
}

#[derive(Clone, Debug)]
pub struct SessionRecord {
    pub id: String,
    pub agent: String,
    pub title: String,
    pub status: String,
    pub active_goal: Option<String>,
    pub current_tool: Option<String>,
    pub cwd: Option<String>,
    pub last_event_time: u64,
}

static SESSIONS: LazyLock<Mutex<std::collections::HashMap<String, SessionRecord>>> = LazyLock::new(|| {
    Mutex::new(std::collections::HashMap::new())
});

pub fn record_desktop_sessions(desktop_sessions: &[crate::phone_link::SessionIn]) {
    let now = (now_ms()) as u64;
    let mut store = SESSIONS.lock().unwrap();
    for s in desktop_sessions {
        if s.pill_id.is_empty() {
            continue;
        }
        let title = s.project.clone().unwrap_or_else(|| {
            if !s.agent.is_empty() { s.agent.clone() } else { s.pill_id.clone() }
        });
        let entry = store.entry(s.pill_id.clone()).or_insert_with(|| SessionRecord {
            id: s.pill_id.clone(),
            agent: s.agent.clone(),
            title: title.clone(),
            status: s.state.clone(),
            active_goal: None,
            current_tool: None,
            cwd: None,
            last_event_time: now,
        });
        entry.agent = s.agent.clone();
        entry.title = title;
        entry.status = s.state.clone();
        if !s.status_text.is_empty() {
            entry.current_tool = Some(s.status_text.clone());
        }
        if let Some(fl) = &s.final_line {
            entry.active_goal = Some(fl.clone());
        }
        entry.last_event_time = now;
    }
}

pub fn parse_questions(payload: &serde_json::Value) -> Option<Vec<QuestionItem>> {
    let raw_questions = payload.get("questions")
        .or_else(|| payload.get("tool_input").and_then(|t| t.get("questions")))
        .or_else(|| payload.get("toolArgs").and_then(|t| t.get("questions")))
        .or_else(|| payload.get("toolCall").and_then(|t| t.get("args")).and_then(|a| a.get("questions")));

    let arr = raw_questions.and_then(|v| v.as_array())?;
    if arr.is_empty() {
        return None;
    }

    let mut items = Vec::new();
    for q in arr {
        let question_text = q.get("question")
            .or_else(|| q.get("text"))
            .or_else(|| q.get("title"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
        if question_text.is_empty() {
            continue;
        }

        let multi_select = q.get("multiSelect")
            .or_else(|| q.get("is_multi_select"))
            .or_else(|| q.get("isMultiSelect"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let mut options = Vec::new();
        if let Some(opts) = q.get("options").and_then(|v| v.as_array()) {
            for opt in opts {
                if let Some(s) = opt.as_str() {
                    let trim = s.trim().to_string();
                    if !trim.is_empty() {
                        options.push(QuestionOption {
                            label: trim,
                            description: None,
                        });
                    }
                } else if let Some(obj) = opt.as_object() {
                    let label = obj.get("label")
                        .or_else(|| obj.get("text"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .trim()
                        .to_string();
                    let desc = obj.get("description")
                        .and_then(|v| v.as_str())
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty());
                    if !label.is_empty() {
                        options.push(QuestionOption {
                            label,
                            description: desc,
                        });
                    }
                }
            }
        }

        if !options.is_empty() {
            items.push(QuestionItem {
                question: question_text,
                options,
                multi_select,
            });
        }
    }

    if items.is_empty() {
        None
    } else {
        Some(items)
    }
}

fn clean_diff_path(raw: &str) -> String {
    let unquoted = raw.trim().trim_matches('"');
    let normalized = unquoted.replace('\\', "/");
    normalized.strip_prefix("a/").or_else(|| normalized.strip_prefix("b/")).unwrap_or(&normalized).to_string()
}

pub fn parse_unified_diff(raw_diff: &str) -> Vec<CompanionFileDiff> {
    let mut files: Vec<CompanionFileDiff> = Vec::new();
    let mut current_file: Option<CompanionFileDiff> = None;

    for line in raw_diff.lines() {
        if line.starts_with("diff --git ") {
            if let Some(f) = current_file.take() {
                files.push(f);
            }
            let rest = &line[11..];
            let initial_path = if let Some(idx) = rest.rfind(" b/") {
                clean_diff_path(&rest[idx + 3..])
            } else if let Some(idx) = rest.rfind("\" b/\"") {
                clean_diff_path(&rest[idx + 5..])
            } else {
                let parts: Vec<&str> = rest.split_whitespace().collect();
                clean_diff_path(parts.last().unwrap_or(&"unknown"))
            };
            let filename = initial_path.split('/').last().unwrap_or(&initial_path).to_string();
            current_file = Some(CompanionFileDiff {
                path: initial_path,
                filename,
                status: "modified".to_string(),
                additions: 0,
                deletions: 0,
                lines: Vec::new(),
            });
        } else if let Some(ref mut f) = current_file {
            if line.starts_with("new file mode") {
                f.status = "added".to_string();
            } else if line.starts_with("deleted file mode") {
                f.status = "deleted".to_string();
            } else if line.starts_with("--- ") {
                if f.status == "deleted" && !line.starts_with("--- /dev/null") {
                    let p = clean_diff_path(&line[4..]);
                    if !p.is_empty() && p != "/dev/null" {
                        f.path = p.clone();
                        f.filename = p.split('/').last().unwrap_or(&p).to_string();
                    }
                }
            } else if line.starts_with("+++ ") {
                if !line.starts_with("+++ /dev/null") {
                    let p = clean_diff_path(&line[4..]);
                    if !p.is_empty() && p != "/dev/null" {
                        f.path = p.clone();
                        f.filename = p.split('/').last().unwrap_or(&p).to_string();
                    }
                }
            } else if line.starts_with("@@ ") {
                f.lines.push(DiffLine {
                    kind: "@".to_string(),
                    text: line.to_string(),
                });
            } else if line.starts_with('+') && !line.starts_with("+++") {
                f.additions += 1;
                f.lines.push(DiffLine {
                    kind: "+".to_string(),
                    text: line[1..].to_string(),
                });
            } else if line.starts_with('-') && !line.starts_with("---") {
                f.deletions += 1;
                f.lines.push(DiffLine {
                    kind: "-".to_string(),
                    text: line[1..].to_string(),
                });
            } else if line.starts_with(' ') {
                f.lines.push(DiffLine {
                    kind: " ".to_string(),
                    text: line[1..].to_string(),
                });
            }
        }
    }

    if let Some(f) = current_file {
        files.push(f);
    }

    files
}

pub fn get_git_diffs(repo_dir: Option<&str>) -> Vec<CompanionFileDiff> {
    let target_dir = repo_dir
        .map(std::path::PathBuf::from)
        .or_else(|| {
            let active_sid = LAST_ACTIVE_SESSION.lock().unwrap().clone();
            if let Some(sid) = active_sid {
                let sessions = SESSIONS.lock().unwrap();
                if let Some(s) = sessions.get(&sid) {
                    if let Some(cwd) = &s.cwd {
                        return Some(std::path::PathBuf::from(cwd));
                    }
                }
            }
            let sessions = SESSIONS.lock().unwrap();
            for s in sessions.values() {
                if let Some(cwd) = &s.cwd {
                    return Some(std::path::PathBuf::from(cwd));
                }
            }
            None
        })
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_else(|| std::path::PathBuf::from("."));

    let mut cmd = std::process::Command::new("git");
    cmd.args(&["diff", "-U3", "HEAD"]).current_dir(&target_dir);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = match cmd.output() {
        Ok(out) => String::from_utf8_lossy(&out.stdout).to_string(),
        Err(_) => String::new(),
    };

    let mut diffs = parse_unified_diff(&output);

    let mut status_cmd = std::process::Command::new("git");
    status_cmd.args(&["status", "--porcelain=v1"]).current_dir(&target_dir);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        status_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    if let Ok(st_out) = status_cmd.output() {
        let st_text = String::from_utf8_lossy(&st_out.stdout);
        for line in st_text.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("?? ") {
                let raw_path = trimmed[3..].trim().trim_matches('"');
                let path = raw_path.replace('\\', "/");
                if !diffs.iter().any(|d| d.path == path) {
                    let filename = path.split('/').last().unwrap_or(&path).to_string();
                    diffs.push(CompanionFileDiff {
                        path: path.clone(),
                        filename,
                        status: "added".to_string(),
                        additions: 1,
                        deletions: 0,
                        lines: vec![
                            DiffLine {
                                kind: "@".to_string(),
                                text: "@@ untracked @@".to_string(),
                            },
                            DiffLine {
                                kind: "+".to_string(),
                                text: format!("[Untracked new file: {path}]"),
                            },
                        ],
                    });
                }
            }
        }
    }

    diffs
}

struct DiffSummaryCache {
    repo_dir: String,
    cached_at: u64,
    summary: Vec<DiffSummaryFile>,
}

static DIFF_SUMMARY_CACHE: LazyLock<Mutex<Option<DiffSummaryCache>>> = LazyLock::new(|| Mutex::new(None));

pub fn get_diff_summary(repo_dir: Option<&str>) -> Vec<DiffSummaryFile> {
    let key = repo_dir.unwrap_or("").to_string();
    let now = (now_ms()) as u64;
    {
        let cache = DIFF_SUMMARY_CACHE.lock().unwrap();
        if let Some(ref c) = *cache {
            if c.repo_dir == key && now.saturating_sub(c.cached_at) < 3000 {
                return c.summary.clone();
            }
        }
    }

    let diffs = get_git_diffs(repo_dir);
    let summary: Vec<DiffSummaryFile> = diffs.into_iter().map(|d| DiffSummaryFile {
        path: d.path,
        filename: d.filename,
        status: d.status,
        additions: d.additions,
        deletions: d.deletions,
    }).collect();

    {
        let mut cache = DIFF_SUMMARY_CACHE.lock().unwrap();
        *cache = Some(DiffSummaryCache {
            repo_dir: key,
            cached_at: now,
            summary: summary.clone(),
        });
    }

    summary
}

static LAST_ACTIVE_SESSION: LazyLock<Mutex<Option<String>>> = LazyLock::new(|| Mutex::new(None));
static WS_BROADCAST: LazyLock<tokio::sync::broadcast::Sender<OutboundMessage>> = LazyLock::new(|| tokio::sync::broadcast::channel(64).0);

pub fn broadcast_message(msg: OutboundMessage) {
    let _ = WS_BROADCAST.send(msg);
}

fn truncate_str(s: &str, max_len: usize) -> String {
    if s.chars().count() <= max_len {
        s.to_string()
    } else {
        let truncated: String = s.chars().take(max_len.saturating_sub(1)).collect();
        format!("{truncated}…")
    }
}

pub(crate) fn format_tool_activity(tool: &str, payload: &serde_json::Value) -> String {
    let input = payload.get("tool_input").and_then(|v| v.as_object())
        .or_else(|| payload.get("toolArgs").and_then(|v| v.as_object()))
        .or_else(|| payload.get("toolCall").and_then(|v| v.get("args")).and_then(|v| v.as_object()));

    if let Some(map) = input {
        if let Some(cmd) = map.get("command").or_else(|| map.get("CommandLine")).and_then(|v| v.as_str()) {
            let clean = cmd.trim();
            let first_line = clean.lines().next().unwrap_or(clean);
            return format!("Runs · {}", truncate_str(first_line, 45));
        }
        if let Some(path) = map.get("file_path")
            .or_else(|| map.get("path"))
            .or_else(|| map.get("FilePath"))
            .or_else(|| map.get("TargetFile"))
            .and_then(|v| v.as_str())
        {
            let clean = path.replace('\\', "/");
            let basename = clean.split('/').last().unwrap_or(path);
            return match tool {
                "view_file" | "Read" => format!("Reads · {basename}"),
                "write_to_file" | "Write" => format!("Writes · {basename}"),
                "replace_file_content" | "Edit" | "MultiEdit" => format!("Edits · {basename}"),
                _ => format!("{tool} · {basename}"),
            };
        }
        if let Some(q) = map.get("query").or_else(|| map.get("Query")).and_then(|v| v.as_str()) {
            return format!("Searches · {}", truncate_str(q, 40));
        }
        if let Some(u) = map.get("url").or_else(|| map.get("Url")).and_then(|v| v.as_str()) {
            return format!("Fetches · {}", truncate_str(u, 40));
        }
    }

    match tool {
        "run_command" | "Bash" | "PowerShell" => "Running command...".to_string(),
        "view_file" | "Read" => "Reading file...".to_string(),
        "write_to_file" | "Write" => "Writing file...".to_string(),
        "replace_file_content" | "Edit" | "MultiEdit" => "Editing file...".to_string(),
        "search_web" | "WebSearch" => "Searching web...".to_string(),
        "read_url_content" | "WebFetch" => "Fetching URL...".to_string(),
        t => format!("Working with {t}..."),
    }
}

pub fn record_hook_event(event: &str, payload: &serde_json::Value) {
    let now = (now_ms()) as u64;
    let mut state = HOOK_AGENT_STATE.lock().unwrap();
    state.last_event_time = now;

    let session_id = payload.get("session_id")
        .or_else(|| payload.get("conversationId"))
        .or_else(|| payload.get("sessionId"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    if !session_id.is_empty() {
        *LAST_ACTIVE_SESSION.lock().unwrap() = Some(session_id.clone());
        let agent_name = payload.get("coucou_agent")
            .or_else(|| payload.get("agent"))
            .and_then(|v| v.as_str())
            .unwrap_or("Antigravity")
            .to_string();
        let cwd = payload.get("cwd")
            .or_else(|| payload.get("workdir"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let title = cwd.as_deref().and_then(|c| {
            let clean = c.replace('\\', "/");
            clean.split('/').filter(|s| !s.is_empty()).last().map(|s| s.to_string())
        }).unwrap_or_else(|| agent_name.clone());

        let mut store = SESSIONS.lock().unwrap();
        let record = store.entry(session_id.clone()).or_insert_with(|| SessionRecord {
            id: session_id.clone(),
            agent: agent_name.clone(),
            title: title.clone(),
            status: "running".to_string(),
            active_goal: None,
            current_tool: None,
            cwd: cwd.clone(),
            last_event_time: now,
        });
        record.agent = agent_name;
        record.title = title;
        record.last_event_time = now;
        if cwd.is_some() {
            record.cwd = cwd;
        }

        match event {
            "PreToolUse" | "pre_tool_use" => {
                record.status = "running".to_string();
                let tool = payload.get("tool").or_else(|| payload.get("tool_name")).and_then(|v| v.as_str()).unwrap_or("Tool");
                record.current_tool = Some(format_tool_activity(tool, payload));
            }
            "UserPromptSubmit" | "UserPrompt" | "PreInvocation" | "user_prompt_submit" => {
                record.status = "running".to_string();
                let prompt = payload.get("prompt").or_else(|| payload.get("message")).and_then(|v| v.as_str()).map(|s| s.to_string());
                if let Some(p) = prompt {
                    record.active_goal = Some(p);
                }
                record.current_tool = Some("Thinking & planning...".to_string());
            }
            "Stop" | "stop" | "AfterAgent" => {
                record.status = "idle".to_string();
                record.current_tool = Some("Task complete".to_string());
            }
            "SessionEnd" | "session_end" => {
                record.status = "idle".to_string();
            }
            _ => {}
        }
    }

    match event {
        "PreToolUse" | "pre_tool_use" => {
            state.status = "running".to_string();
            let tool = payload.get("tool").or_else(|| payload.get("tool_name")).and_then(|v| v.as_str()).unwrap_or("Tool");
            let activity = format_tool_activity(tool, payload);
            state.current_tool = Some(activity);
        }
        "PostToolUse" | "post_tool_use" => {
            state.status = "running".to_string();
        }
        "UserPromptSubmit" | "UserPrompt" | "PreInvocation" | "user_prompt_submit" => {
            state.status = "running".to_string();
            let prompt = payload.get("prompt").or_else(|| payload.get("message")).and_then(|v| v.as_str()).map(|s| s.to_string());
            if let Some(p) = prompt {
                state.active_goal = Some(p.clone());
                broadcast_message(OutboundMessage::ChatReply {
                    text: p,
                    is_user: true,
                });
            }
            state.current_tool = Some("Thinking & planning...".to_string());
        }
        "Stop" | "stop" | "AfterAgent" => {
            state.status = "idle".to_string();
            state.current_tool = Some("Task complete".to_string());
            if let Some(msg) = payload.get("last_assistant_message").or_else(|| payload.get("message")).and_then(|v| v.as_str()) {
                let trimmed = msg.trim();
                if !trimmed.is_empty() {
                    broadcast_message(OutboundMessage::ChatReply {
                        text: trimmed.to_string(),
                        is_user: false,
                    });
                }
            }
        }
        "SessionStart" | "session_start" => {
            state.status = "running".to_string();
            state.current_tool = Some("Session started".to_string());
        }
        "SessionEnd" | "session_end" => {
            state.status = "idle".to_string();
            state.current_tool = Some("Session ended".to_string());
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
    let questions = parse_questions(payload);

    let prompt_obj = ApprovalPrompt {
        id: id.to_string(),
        prompt,
        tool,
        command,
        questions,
    };
    state.pending_request = Some(prompt_obj.clone());
    broadcast_message(OutboundMessage::AgentPrompt(prompt_obj));
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
            volume: Some(p.volume.clamp(0, 100) as u8),
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

    let active_sid = LAST_ACTIVE_SESSION.lock().unwrap().clone();
    let (selected_status, selected_goal, selected_tool, active_cwd) = {
        let sessions = SESSIONS.lock().unwrap();
        let s_opt = active_sid.as_ref().and_then(|sid| sessions.get(sid)).or_else(|| {
            sessions.values().next()
        });
        if let Some(s) = s_opt {
            (Some(s.status.clone()), s.active_goal.clone(), s.current_tool.clone(), s.cwd.clone())
        } else {
            (None, None, None, None)
        }
    };
    let diff_summary = get_diff_summary(active_cwd.as_deref());

    let agent = if hook_state.pending_request.is_some() || has_pipe_pending {
        Some(AgentState {
            status: "Waiting for Confirmation".to_string(),
            active_goal: selected_goal.or_else(|| hook_state.active_goal.clone()),
            current_tool: selected_tool.or_else(|| hook_state.current_tool.clone()),
            pending_request: hook_state.pending_request,
            diff_summary,
        })
    } else if let Some(ref st) = selected_status {
        let st_lower = st.to_lowercase();
        let status_str = if st_lower == "thinking" {
            "Thinking".to_string()
        } else if st_lower == "running" || st_lower == "busy" {
            "Running".to_string()
        } else if st_lower.contains("waiting") || st_lower.contains("confirmation") {
            "Waiting for Confirmation".to_string()
        } else if st_lower == "idle" {
            "Idle".to_string()
        } else {
            st.clone()
        };
        Some(AgentState {
            status: status_str,
            active_goal: selected_goal.or_else(|| hook_state.active_goal.clone()),
            current_tool: selected_tool.or_else(|| hook_state.current_tool.clone()).or_else(|| Some("Standing by".to_string())),
            pending_request: None,
            diff_summary,
        })
    } else if hook_state.status != "idle" && now.saturating_sub(hook_state.last_event_time) < 120_000 {
        Some(AgentState {
            status: if hook_state.status == "thinking" { "Thinking".to_string() } else { "Running".to_string() },
            active_goal: hook_state.active_goal.clone(),
            current_tool: hook_state.current_tool.clone(),
            pending_request: None,
            diff_summary,
        })
    } else {
        Some(AgentState {
            status: "Idle".to_string(),
            active_goal: hook_state.active_goal.clone(),
            current_tool: hook_state.current_tool.clone().or_else(|| Some("Standing by".to_string())),
            pending_request: None,
            diff_summary,
        })
    };

    let active_sid = LAST_ACTIVE_SESSION.lock().unwrap().clone();
    let mut sessions_list: Vec<SessionSummary> = {
        let sessions = SESSIONS.lock().unwrap();
        let mut list: Vec<SessionSummary> = sessions.values().map(|s| {
            let is_act = active_sid.as_ref().map(|id| id == &s.id).unwrap_or(false);
            SessionSummary {
                id: s.id.clone(),
                agent: s.agent.clone(),
                title: s.title.clone(),
                status: s.status.clone(),
                active_goal: s.active_goal.clone(),
                current_tool: s.current_tool.clone(),
                is_active: is_act,
            }
        }).collect();
        list.sort_by(|a, b| b.is_active.cmp(&a.is_active));
        list
    };

    if sessions_list.is_empty() {
        sessions_list.push(SessionSummary {
            id: "antigravity-main".to_string(),
            agent: "Antigravity".to_string(),
            title: "coucou-fork".to_string(),
            status: hook_state.status.clone(),
            active_goal: hook_state.active_goal.clone(),
            current_tool: hook_state.current_tool.clone(),
            is_active: true,
        });
    } else if !sessions_list.iter().any(|s| s.is_active) {
        if let Some(first) = sessions_list.first_mut() {
            first.is_active = true;
        }
    }

    let pc_stats = Some(super::stats::get_pc_stats());

    StateSnapshot {
        media,
        agent,
        system,
        sessions: sessions_list,
        pc_stats,
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
    let mut bcast_rx = WS_BROADCAST.subscribe();

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
        loop {
            tokio::select! {
                Some(msg) = out_rx.recv() => {
                    if let Ok(json) = serde_json::to_string(&msg) {
                        if ws_tx.send(Message::Text(json.into())).await.is_err() {
                            break;
                        }
                    }
                }
                Ok(msg) = bcast_rx.recv() => {
                    if let Ok(json) = serde_json::to_string(&msg) {
                        if ws_tx.send(Message::Text(json.into())).await.is_err() {
                            break;
                        }
                    }
                }
                else => break,
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
                            "volume" => "volume".to_string(),
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

                        // 3. Bring the active Antigravity session window / terminal to the front
                        let session_opt = LAST_ACTIVE_SESSION.lock().unwrap().clone();
                        if let Some(session_id) = session_opt {
                            #[cfg(windows)]
                            {
                                if let Some(owners) = crate::session_window::lookup(&session_id) {
                                    let _ = crate::platform::focus_session_window(&owners, "");
                                }
                            }
                        }

                        // 4. Update the active goal immediately
                        {
                            let mut state = HOOK_AGENT_STATE.lock().unwrap();
                            state.active_goal = Some(text_trim.clone());
                            state.status = "running".to_string();
                            state.current_tool = Some("Dispatched to Antigravity".to_string());
                            state.last_event_time = (now_ms()) as u64;
                        }

                        let app_clone = app.clone();
                        let out_tx_chat = out_tx.clone();
                        let mode_str = mode.unwrap_or_else(|| "ai".to_string());

                        tauri::async_runtime::spawn(async move {
                            let _ = out_tx_chat.send(OutboundMessage::ChatReply {
                                text: text_trim.clone(),
                                is_user: true,
                            }).await;

                            let ack_reply = if mode_str == "clip" {
                                "Copied to PC clipboard! Ready to paste (Ctrl+V) on laptop.".to_string()
                            } else {
                                "Prompt dispatched to Antigravity & copied to clipboard! Terminal focused.".to_string()
                            };

                            let _ = out_tx_chat.send(OutboundMessage::ChatReply {
                                text: ack_reply,
                                is_user: false,
                            }).await;

                            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                            let snap = build_snapshot(&app_clone).await;
                            let _ = out_tx_chat.send(OutboundMessage::FullSync(snap)).await;
                        });
                    }
                    InboundMessage::AgentAnswer { request_id, answers } => {
                        log::line(format!("web companion: answered question id={request_id}"));
                        crate::recap::forget_request(&app, &request_id);
                        pipe::answer_question(&app, &request_id, &answers);
                        use tauri::Emitter;
                        let _ = app.emit_to(crate::island::WINDOW_LABEL, "phone-link-decided", request_id.clone());
                        clear_permission_request(&request_id);

                        let app_clone = app.clone();
                        let out_tx_ans = out_tx.clone();
                        tauri::async_runtime::spawn(async move {
                            tokio::time::sleep(std::time::Duration::from_millis(80)).await;
                            let snap = build_snapshot(&app_clone).await;
                            let _ = out_tx_ans.send(OutboundMessage::FullSync(snap)).await;
                        });
                    }
                    InboundMessage::SessionSelect { session_id } => {
                        *LAST_ACTIVE_SESSION.lock().unwrap() = Some(session_id.clone());
                        #[cfg(windows)]
                        {
                            if let Some(owners) = crate::session_window::lookup(&session_id) {
                                let _ = crate::platform::focus_session_window(&owners, "");
                            }
                        }
                        let app_clone = app.clone();
                        let out_tx_sel = out_tx.clone();
                        tauri::async_runtime::spawn(async move {
                            let snap = build_snapshot(&app_clone).await;
                            let _ = out_tx_sel.send(OutboundMessage::FullSync(snap)).await;
                        });
                    }
                    InboundMessage::DiffGet { session_id } => {
                        let sid = session_id.or_else(|| LAST_ACTIVE_SESSION.lock().unwrap().clone());
                        let cwd_opt = sid.as_ref().and_then(|s| {
                            let store = SESSIONS.lock().unwrap();
                            store.get(s).and_then(|r| r.cwd.clone())
                        });
                        let files = get_git_diffs(cwd_opt.as_deref());
                        let _ = out_tx.send(OutboundMessage::DiffData { session_id: sid, files }).await;
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

