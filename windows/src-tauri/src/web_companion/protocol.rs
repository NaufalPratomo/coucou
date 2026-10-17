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
    #[serde(rename = "agent:answer")]
    AgentAnswer {
        #[serde(rename = "requestId")]
        request_id: String,
        answers: std::collections::HashMap<String, serde_json::Value>,
    },
    #[serde(rename = "session:select")]
    SessionSelect {
        #[serde(rename = "sessionId")]
        session_id: String,
    },
    #[serde(rename = "diff:get")]
    DiffGet {
        #[serde(rename = "sessionId", default)]
        session_id: Option<String>,
    },
    #[serde(rename = "chat:send")]
    ChatSend {
        text: String,
        #[serde(default)]
        mode: Option<String>,
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
    #[serde(default)]
    pub volume: Option<u8>,
    pub lyrics: Vec<LyricLine>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct QuestionOption {
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct QuestionItem {
    pub question: String,
    pub options: Vec<QuestionOption>,
    #[serde(default, rename = "multiSelect")]
    pub multi_select: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ApprovalPrompt {
    pub id: String,
    pub prompt: String,
    pub tool: Option<String>,
    pub command: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub questions: Option<Vec<QuestionItem>>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Default)]
pub struct DiffLine {
    pub kind: String, // "+" (add), "-" (del), " " (ctx), "@" (header)
    pub text: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Default)]
pub struct CompanionFileDiff {
    pub path: String,
    pub filename: String,
    pub status: String, // "modified", "added", "deleted"
    pub additions: u32,
    pub deletions: u32,
    pub lines: Vec<DiffLine>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Default)]
pub struct DiffSummaryFile {
    pub path: String,
    pub filename: String,
    pub status: String,
    pub additions: u32,
    pub deletions: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Default)]
pub struct SessionSummary {
    pub id: String,
    pub agent: String,
    pub title: String,
    pub status: String,
    #[serde(rename = "activeGoal")]
    pub active_goal: Option<String>,
    #[serde(rename = "currentTool")]
    pub current_tool: Option<String>,
    #[serde(rename = "isActive")]
    pub is_active: bool,
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
    #[serde(default, rename = "diffSummary")]
    pub diff_summary: Vec<DiffSummaryFile>,
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
    #[serde(default)]
    pub sessions: Vec<SessionSummary>,
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
    #[serde(rename = "diff:data")]
    DiffData {
        #[serde(rename = "sessionId", default, skip_serializing_if = "Option::is_none")]
        session_id: Option<String>,
        files: Vec<CompanionFileDiff>,
    },
    #[serde(rename = "chat:reply")]
    ChatReply {
        text: String,
        #[serde(rename = "isUser")]
        is_user: bool,
    },
    #[serde(rename = "pong")]
    Pong,
}
