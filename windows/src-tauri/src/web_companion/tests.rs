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

    let seek_raw = r#"{"type":"media:action","payload":{"action":"seek","value":42.5}}"#;
    let seek_msg: InboundMessage = serde_json::from_str(seek_raw).expect("must parse seek action");
    match seek_msg {
        InboundMessage::MediaAction { action, value } => {
            assert_eq!(action, "seek");
            assert_eq!(value, Some(42.5));
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

#[test]
fn test_parse_ping() {
    let raw = r#"{"type":"ping"}"#;
    let msg: InboundMessage = serde_json::from_str(raw).expect("must parse ping");
    assert_eq!(msg, InboundMessage::Ping);
}

#[test]
fn test_serialize_outbound_messages() {
    let tick = OutboundMessage::MediaTick { position_ms: 12345 };
    let json = serde_json::to_string(&tick).expect("must serialize media tick");
    assert!(json.contains(r#""type":"media:tick""#));
    assert!(json.contains(r#""positionMs":12345"#));

    let pong = OutboundMessage::Pong;
    let json_pong = serde_json::to_string(&pong).expect("must serialize pong");
    assert_eq!(json_pong, r#"{"type":"pong"}"#);

    let prompt = OutboundMessage::AgentPrompt(ApprovalPrompt {
        id: "prompt-1".into(),
        prompt: "Run rm -rf /?".into(),
        tool: Some("bash".into()),
        command: Some("rm -rf /".into()),
    });
    let prompt_json = serde_json::to_string(&prompt).expect("must serialize agent prompt");
    assert!(prompt_json.contains(r#""type":"agent:request""#));
    assert!(prompt_json.contains(r#""id":"prompt-1""#));

    let snapshot = OutboundMessage::FullSync(StateSnapshot {
        media: Some(MediaState {
            is_playing: true,
            title: "Song".into(),
            artist: "Artist".into(),
            album_art: Some("art.png".into()),
            duration_ms: 200000,
            position_ms: 50000,
            volume: Some(80),
            lyrics: vec![LyricLine {
                time_ms: 1000,
                text: "Hello".into(),
            }],
        }),
        agent: Some(AgentState {
            status: "busy".into(),
            active_goal: Some("Refactoring".into()),
            current_tool: Some("cargo".into()),
            pending_request: None,
        }),
        system: SystemState {
            battery_percent: 85,
            is_charging: true,
        },
    });
    let snapshot_json = serde_json::to_string(&snapshot).expect("must serialize snapshot");
    assert!(snapshot_json.contains(r#""type":"sync:state""#));
    assert!(snapshot_json.contains(r#""isPlaying":true"#));
    assert!(snapshot_json.contains(r#""batteryPercent":85"#));
}

#[tokio::test]
async fn test_http_response_headers() {
    let headers = super::server::http_response(200, "text/html; charset=utf-8", "<h1>Coucou</h1>".as_bytes());
    let text = String::from_utf8_lossy(&headers);
    assert!(text.contains("HTTP/1.1 200 OK"));
    assert!(text.contains("Content-Type: text/html"));
    assert!(text.contains("Content-Length: 15"));
}

#[tokio::test]
async fn test_http_response_404_headers() {
    let headers = super::server::http_response(404, "text/plain", "Not Found".as_bytes());
    let text = String::from_utf8_lossy(&headers);
    assert!(text.contains("HTTP/1.1 404 Not Found"));
    assert!(text.contains("Content-Type: text/plain"));
    assert!(text.contains("Content-Length: 9"));
}

#[test]
fn test_route_query_stripping() {
    let raw_header = "GET /?token=abc1234 HTTP/1.1\r\nHost: coucou.local:47822\r\n\r\n";
    let raw_path = raw_header
        .lines()
        .next()
        .and_then(|l| l.split_whitespace().nth(1))
        .unwrap_or("/");
    let path = raw_path.split('?').next().unwrap_or(raw_path);
    assert_eq!(path, "/");

    let raw_header_companion = "GET /companion.html?v=1.0 HTTP/1.1\r\nHost: coucou.local:47822\r\n\r\n";
    let raw_path_companion = raw_header_companion
        .lines()
        .next()
        .and_then(|l| l.split_whitespace().nth(1))
        .unwrap_or("/");
    let path_companion = raw_path_companion.split('?').next().unwrap_or(raw_path_companion);
    assert_eq!(path_companion, "/companion.html");
}

#[test]
fn test_token_verification() {
    let token = super::pairing::get_or_create_token();
    assert!(!token.is_empty());
    assert!(super::pairing::verify_token(&token));
    assert!(!super::pairing::verify_token("invalid_token"));
}

#[test]
fn test_token_stability_and_rejection() {
    let t1 = super::pairing::get_or_create_token();
    let t2 = super::pairing::get_or_create_token();
    assert_eq!(t1, t2);
    assert!(!super::pairing::verify_token(""));
    assert!(!super::pairing::verify_token("   "));
}

#[test]
fn test_qr_svg_generation() {
    let svg = super::pairing::generate_qr_svg();
    assert!(!svg.is_empty());
    assert!(svg.contains("<svg"));

    let custom_svg = super::pairing::generate_qr_svg_for_url("http://192.168.1.50:47822?token=abc");
    assert!(!custom_svg.is_empty());
    assert!(custom_svg.contains("<svg"));
}

#[test]
fn test_lan_address() {
    let _ = super::pairing::lan_address();
}

#[test]
fn test_extract_token() {
    assert_eq!(super::server::extract_token("/ws?token=sec_tok_123"), "sec_tok_123");
    assert_eq!(super::server::extract_token("/ws?a=1&token=sec_tok_123&b=2"), "sec_tok_123");
    assert_eq!(super::server::extract_token("/ws"), "");
    assert_eq!(super::server::extract_token("/ws?token="), "");
}

#[tokio::test]
async fn test_http_response_401_headers() {
    let headers = super::server::http_response(401, "text/plain", b"Unauthorized");
    let text = String::from_utf8_lossy(&headers);
    assert!(text.contains("HTTP/1.1 401 Unauthorized"));
    assert!(text.contains("Content-Length: 12"));
}

#[test]
fn test_media_action_normalization() {
    let normalize = |action: &str| match action.to_ascii_lowercase().as_str() {
        "playpause" | "play_pause" | "toggle" => "playPause".to_string(),
        "prev" | "previous" => "previous".to_string(),
        "next" => "next".to_string(),
        "seek" => "seek".to_string(),
        a => a.to_string(),
    };

    assert_eq!(normalize("playpause"), "playPause");
    assert_eq!(normalize("play_pause"), "playPause");
    assert_eq!(normalize("toggle"), "playPause");
    assert_eq!(normalize("playPause"), "playPause");
    assert_eq!(normalize("prev"), "previous");
    assert_eq!(normalize("previous"), "previous");
    assert_eq!(normalize("next"), "next");
    assert_eq!(normalize("seek"), "seek");
}

#[test]
fn test_chat_messages_serialization() {
    let send_raw = r#"{"type":"chat:send","payload":{"text":"Hello AI","mode":"ai"}}"#;
    let send_msg: InboundMessage = serde_json::from_str(send_raw).expect("must parse chat send");
    match send_msg {
        InboundMessage::ChatSend { text, mode } => {
            assert_eq!(text, "Hello AI");
            assert_eq!(mode, Some("ai".to_string()));
        }
        _ => panic!("wrong message type"),
    }

    let reply = OutboundMessage::ChatReply {
        text: "Hello from Coucou!".into(),
        is_user: false,
    };
    let json = serde_json::to_string(&reply).expect("must serialize chat reply");
    assert!(json.contains(r#""type":"chat:reply""#));
    assert!(json.contains(r#""text":"Hello from Coucou!""#));
    assert!(json.contains(r#""isUser":false"#));
}

#[test]
fn test_icon_route_and_mime() {
    assert!(super::server::is_icon_path("/icon.png"));
    assert!(super::server::is_icon_path("/apple-touch-icon.png"));
    assert!(super::server::is_icon_path("/apple-touch-icon-precomposed.png"));
    assert!(!super::server::is_icon_path("/other.png"));
    assert!(!super::server::is_icon_path("/companion.html"));
    assert!(!super::server::is_icon_path("/manifest.json"));
    assert!(!super::server::is_icon_path("/"));

    assert_eq!(super::server::mime_type_for_path("/icon.png"), "image/png");
    assert_eq!(super::server::mime_type_for_path("/apple-touch-icon.png"), "image/png");
    assert_eq!(super::server::mime_type_for_path("/apple-touch-icon-precomposed.png"), "image/png");

    let icon_bytes = include_bytes!("../../../src-tauri/icons/icon.png");
    assert!(!icon_bytes.is_empty());
    // Valid PNG signature: 137, 80, 78, 71, 13, 10, 26, 10
    assert_eq!(&icon_bytes[..8], &[137, 80, 78, 71, 13, 10, 26, 10]);

    let resp = super::server::http_response(200, "image/png", icon_bytes);
    let resp_str = String::from_utf8_lossy(&resp[..128]);
    assert!(resp_str.contains("HTTP/1.1 200 OK"));
    assert!(resp_str.contains("Content-Type: image/png"));
    assert!(resp_str.contains(&format!("Content-Length: {}", icon_bytes.len())));
}

#[test]
fn test_icon_route_query_stripping() {
    let raw_header = "GET /icon.png?v=0.6.10 HTTP/1.1\r\nHost: coucou.local:47822\r\n\r\n";
    let raw_path = raw_header
        .lines()
        .next()
        .and_then(|l| l.split_whitespace().nth(1))
        .unwrap_or("/");
    let path = raw_path.split('?').next().unwrap_or(raw_path);
    assert_eq!(path, "/icon.png");
    assert!(super::server::is_icon_path(path));
}

#[test]
fn test_format_tool_activity() {
    let bash_payload = serde_json::json!({
        "tool": "run_command",
        "tool_input": {
            "CommandLine": "cargo test --all"
        }
    });
    let act = super::server::format_tool_activity("run_command", &bash_payload);
    assert_eq!(act, "Runs · cargo test --all");

    let read_payload = serde_json::json!({
        "tool": "view_file",
        "tool_input": {
            "TargetFile": "windows\\src-tauri\\src\\lib.rs"
        }
    });
    let act_read = super::server::format_tool_activity("view_file", &read_payload);
    assert_eq!(act_read, "Reads · lib.rs");

    let write_payload = serde_json::json!({
        "tool": "write_to_file",
        "tool_input": {
            "TargetFile": "/home/user/project/README.md"
        }
    });
    let act_write = super::server::format_tool_activity("write_to_file", &write_payload);
    assert_eq!(act_write, "Writes · README.md");

    let edit_payload = serde_json::json!({
        "tool": "replace_file_content",
        "tool_input": {
            "TargetFile": "windows/src/companion/main.ts"
        }
    });
    let act_edit = super::server::format_tool_activity("replace_file_content", &edit_payload);
    assert_eq!(act_edit, "Edits · main.ts");

    let search_payload = serde_json::json!({
        "tool": "search_web",
        "tool_input": {
            "query": "tauri v2 local server"
        }
    });
    let act_search = super::server::format_tool_activity("search_web", &search_payload);
    assert_eq!(act_search, "Searches · tauri v2 local server");
}

#[test]
fn test_record_hook_event_lifecycle() {
    let submit_payload = serde_json::json!({
        "prompt": "Fix bug in audio player",
        "session_id": "sess-456"
    });
    super::server::record_hook_event("UserPromptSubmit", &submit_payload);
    let (status, goal, tool) = super::server::current_hook_agent_state();
    assert_eq!(status, "running");
    assert_eq!(goal, Some("Fix bug in audio player".to_string()));
    assert_eq!(tool, Some("Thinking & planning...".to_string()));

    let tool_payload = serde_json::json!({
        "tool": "run_command",
        "tool_input": {
            "CommandLine": "npm test"
        }
    });
    super::server::record_hook_event("PreToolUse", &tool_payload);
    let (status2, goal2, tool2) = super::server::current_hook_agent_state();
    assert_eq!(status2, "running");
    assert_eq!(goal2, Some("Fix bug in audio player".to_string()));
    assert_eq!(tool2, Some("Runs · npm test".to_string()));

    let stop_payload = serde_json::json!({
        "last_assistant_message": "All tests passed successfully!"
    });
    super::server::record_hook_event("Stop", &stop_payload);
    let (status3, goal3, tool3) = super::server::current_hook_agent_state();
    assert_eq!(status3, "idle");
    assert_eq!(goal3, Some("Fix bug in audio player".to_string()));
    assert_eq!(tool3, Some("Task complete".to_string()));
}

#[test]
fn test_parse_agent_answer_message() {
    let raw = r#"{"type":"agent:answer","payload":{"requestId":"req-q1","answers":{"Which option?":"Option A"}}}"#;
    let msg: InboundMessage = serde_json::from_str(raw).expect("must parse agent answer");
    match msg {
        InboundMessage::AgentAnswer { request_id, answers } => {
            assert_eq!(request_id, "req-q1");
            assert_eq!(answers.get("Which option?").and_then(|v| v.as_str()), Some("Option A"));
        }
        _ => panic!("wrong message type"),
    }
}

#[test]
fn test_parse_session_select_message() {
    let raw = r#"{"type":"session:select","payload":{"sessionId":"sess-999"}}"#;
    let msg: InboundMessage = serde_json::from_str(raw).expect("must parse session select");
    match msg {
        InboundMessage::SessionSelect { session_id } => {
            assert_eq!(session_id, "sess-999");
        }
        _ => panic!("wrong message type"),
    }
}

#[test]
fn test_parse_diff_get_message() {
    let raw = r#"{"type":"diff:get","payload":{"sessionId":"sess-123"}}"#;
    let msg: InboundMessage = serde_json::from_str(raw).expect("must parse diff get");
    match msg {
        InboundMessage::DiffGet { session_id } => {
            assert_eq!(session_id, Some("sess-123".to_string()));
        }
        _ => panic!("wrong message type"),
    }
}

#[test]
fn test_parse_questions_claude_and_antigravity_format() {
    // Claude Code style: array of objects with label
    let claude_payload = serde_json::json!({
        "questions": [
            {
                "question": "Which branch would you like to merge?",
                "options": [
                    { "label": "main", "description": "Production branch" },
                    { "label": "develop", "description": "Development branch" }
                ],
                "multiSelect": false
            }
        ]
    });
    let q1 = super::server::parse_questions(&claude_payload).expect("must parse claude questions");
    assert_eq!(q1.len(), 1);
    assert_eq!(q1[0].question, "Which branch would you like to merge?");
    assert!(!q1[0].multi_select);
    assert_eq!(q1[0].options.len(), 2);
    assert_eq!(q1[0].options[0].label, "main");
    assert_eq!(q1[0].options[0].description, Some("Production branch".to_string()));

    // Antigravity style: array of strings with is_multi_select
    let antigravity_payload = serde_json::json!({
        "tool": "ask_question",
        "tool_input": {
            "questions": [
                {
                    "question": "Select target platforms",
                    "options": ["Windows", "macOS", "Linux"],
                    "is_multi_select": true
                }
            ]
        }
    });
    let q2 = super::server::parse_questions(&antigravity_payload).expect("must parse antigravity questions");
    assert_eq!(q2.len(), 1);
    assert_eq!(q2[0].question, "Select target platforms");
    assert!(q2[0].multi_select);
    assert_eq!(q2[0].options.len(), 3);
    assert_eq!(q2[0].options[0].label, "Windows");
    assert_eq!(q2[0].options[1].label, "macOS");
    assert_eq!(q2[0].options[2].label, "Linux");
}

#[test]
fn test_parse_unified_diff() {
    let sample_diff = r#"diff --git a/src/main.rs b/src/main.rs
--- a/src/main.rs
+++ b/src/main.rs
@@ -10,3 +10,4 @@
 fn main() {
-    println!("hello");
+    println!("hello world");
+    println!("new line");
 }
"#;
    let diffs = super::server::parse_unified_diff(sample_diff);
    assert_eq!(diffs.len(), 1);
    let d = &diffs[0];
    assert_eq!(d.path, "src/main.rs");
    assert_eq!(d.filename, "main.rs");
    assert_eq!(d.status, "modified");
    assert_eq!(d.additions, 2);
    assert_eq!(d.deletions, 1);
    assert!(d.lines.iter().any(|l| l.kind == "@"));
    assert!(d.lines.iter().any(|l| l.kind == "+" && l.text.contains("hello world")));
    assert!(d.lines.iter().any(|l| l.kind == "-" && l.text.contains("hello")));
}



