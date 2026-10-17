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


