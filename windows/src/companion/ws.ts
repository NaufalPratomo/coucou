// Coucou iPhone Web Companion — WebSocket Client & Auto-Reconnect Engine

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
    private onStatusChange: (connected: boolean) => void,
    private onChatReply?: (reply: { text: string; isUser: boolean }) => void
  ) {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          this.connect();
        }
      });
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
            if (this.reconnectTimer) {
              clearTimeout(this.reconnectTimer);
              this.reconnectTimer = null;
            }
            this.connect();
          }
        }
      });
    }
  }

  public connect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.close();
      } catch {
        // Ignore close error on existing socket
      }
      this.ws = null;
    }

    let token: string | null = null;
    if (typeof window !== "undefined" && window.location) {
      const params = new URLSearchParams(window.location.search);
      token = params.get("token");
    }

    if (typeof localStorage !== "undefined") {
      try {
        if (token) {
          localStorage.setItem("coucou_token", token);
        } else {
          token = localStorage.getItem("coucou_token");
        }
      } catch {
        // Storage access may be restricted
      }
    }

    const host = (typeof window !== "undefined" && window.location?.hostname) || "coucou.local";
    const port = (typeof window !== "undefined" && window.location?.port) || "47822";
    const isHttps = typeof window !== "undefined" && window.location?.protocol === "https:";
    const protocol = isHttps ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${host}:${port}/ws?token=${encodeURIComponent(token || "")}`;

    if (typeof WebSocket === "undefined") {
      console.warn("WebSocket is not supported in this environment");
      return;
    }

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.onStatusChange(true);
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "sync:state") {
          this.onState(msg.payload);
        } else if (msg.type === "media:tick") {
          this.onTick(msg.payload.positionMs);
        } else if (msg.type === "agent:request") {
          this.onPrompt(msg.payload);
        } else if (msg.type === "chat:reply") {
          this.onChatReply?.(msg.payload);
        }
      } catch (e) {
        console.error("Failed to parse WS msg", e);
      }
    };

    this.ws.onclose = () => {
      this.onStatusChange(false);
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
      }
      this.reconnectTimer = window.setTimeout(() => this.connect(), 2000);
    };

    this.ws.onerror = () => {
      // Browser automatically invokes onclose after error
    };
  }

  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.close();
      } catch {
        // Ignore close error
      }
      this.ws = null;
    }
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public sendMediaAction(action: string, value?: number): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "media:action", payload: { action, value } }));
    }
  }

  public sendDecision(requestId: string, allow: boolean): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "agent:decision", payload: { requestId, allow } }));
    }
  }

  public sendChatMessage(text: string, mode: "ai" | "clip" = "ai"): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "chat:send", payload: { text, mode } }));
    }
  }
}
