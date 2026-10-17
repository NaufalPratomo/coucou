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
