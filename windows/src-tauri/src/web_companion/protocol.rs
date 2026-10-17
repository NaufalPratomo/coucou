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
    #[serde(rename = "chat:reply")]
    ChatReply {
        text: String,
        #[serde(rename = "isUser")]
        is_user: bool,
    },
    #[serde(rename = "pong")]
    Pong,
}
