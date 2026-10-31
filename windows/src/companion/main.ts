// Coucou iPhone Web Companion — Main Bootstrap

import {
  CompanionClient,
  type StateSnapshot,
  type ApprovalPrompt,
} from "./ws";
import { setupMusicPlayer } from "./components/MusicPlayer";
import { setupAntigravityCard } from "./components/AntigravityCard";
import { MochiCanvas } from "./components/MochiCanvas";

import { setupRemoteChat } from "./components/RemoteChat";
import { setupPcStatsCard } from "./components/PcStatsCard";

export let client: CompanionClient | null = null;
export let player: ReturnType<typeof setupMusicPlayer> | null = null;
export let agentCard: ReturnType<typeof setupAntigravityCard> | null = null;
export let chatUi: ReturnType<typeof setupRemoteChat> | null = null;
export let statsCard: ReturnType<typeof setupPcStatsCard> | null = null;
export let mochi: MochiCanvas | null = null;

export function switchTab(targetTab: "music" | "agent" | "chat" | "stats"): void {
  const tabButtons = document.querySelectorAll<HTMLButtonElement>(".tab-btn");
  const tabMusic = document.getElementById("tab-music");
  const tabAgent = document.getElementById("tab-agent");
  const tabChat = document.getElementById("tab-chat");
  const tabStats = document.getElementById("tab-stats");

  tabButtons.forEach((b) => {
    const tab = b.getAttribute("data-tab");
    if (tab === targetTab) {
      b.classList.add("active", "text-white");
      b.classList.remove("text-neutral-500");
    } else {
      b.classList.remove("active", "text-white");
      b.classList.add("text-neutral-500");
    }
  });

  const panes: Record<string, HTMLElement | null> = {
    music: tabMusic,
    agent: tabAgent,
    chat: tabChat,
    stats: tabStats,
  };

  Object.entries(panes).forEach(([tabKey, pane]) => {
    if (!pane) return;
    if (tabKey === targetTab) {
      pane.classList.remove("hidden");
      pane.classList.add("active");
    } else {
      pane.classList.add("hidden");
      pane.classList.remove("active");
    }
  });
}

export function setAgentAlert(alert: boolean): void {
  const agentBtn = document.querySelector<HTMLButtonElement>('.tab-btn[data-tab="agent"]');
  if (!agentBtn) return;

  let badge = agentBtn.querySelector<HTMLElement>(".tab-alert-badge");
  if (alert) {
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "tab-alert-badge ml-1.5 inline-block w-2 h-2 rounded-full bg-rose-500 animate-pulse";
      agentBtn.appendChild(badge);
    }
  } else {
    badge?.remove();
  }
}

export function setupTabs(): void {
  const tabButtons = document.querySelectorAll<HTMLButtonElement>(".tab-btn");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab") as "music" | "agent" | "chat" | "stats" | null;
      if (!targetTab) return;

      if ("vibrate" in navigator) {
        try {
          navigator.vibrate(10);
        } catch {
          // Ignore vibration errors if blocked by browser policy
        }
      }

      switchTab(targetTab);
    });
  });
}

export function initCompanionClient(): CompanionClient {
  const islandStatus = document.getElementById("island-status");
  const batteryLevel = document.getElementById("battery-level");
  const batteryFill = document.getElementById("battery-fill");
  const batteryBolt = document.getElementById("battery-bolt");
  const canvas = document.getElementById("mochi-canvas") as HTMLCanvasElement | null;

  if (mochi) {
    mochi.destroy();
    mochi = null;
  }
  if (canvas) {
    mochi = new MochiCanvas(canvas);
  }

  const companion = new CompanionClient(
    (state: StateSnapshot) => {
      if (state.system) {
        const pct = Math.max(0, Math.min(100, state.system.batteryPercent));
        if (batteryLevel) {
          batteryLevel.textContent = `${pct}%`;
        }
        if (batteryFill) {
          const fillWidth = Math.max(1.5, (pct / 100) * 15);
          batteryFill.setAttribute("width", fillWidth.toFixed(1));
          if (state.system.isCharging) {
            batteryFill.setAttribute("class", "text-emerald-400 transition-all duration-300");
          } else if (pct <= 20) {
            batteryFill.setAttribute("class", "text-rose-500 transition-all duration-300");
          } else {
            batteryFill.setAttribute("class", "text-neutral-300 transition-all duration-300");
          }
        }
        if (batteryBolt) {
          if (state.system.isCharging) {
            batteryBolt.classList.remove("hidden");
          } else {
            batteryBolt.classList.add("hidden");
          }
        }
        if (batteryLevel) {
          if (pct <= 20 && !state.system.isCharging) {
            batteryLevel.classList.add("text-rose-400");
            batteryLevel.classList.remove("text-neutral-300");
          } else {
            batteryLevel.classList.remove("text-rose-400");
            batteryLevel.classList.add("text-neutral-300");
          }
        }
      }

      if (mochi && state.media) {
        mochi.setMusicPlaying(Boolean(state.media.isPlaying));
      }

      const hasPendingApproval = Boolean(state.agent?.pendingRequest);
      const agentStatusLower = (state.agent?.status || "").toLowerCase();
      const isWaitingConfirmation =
        agentStatusLower === "waiting_confirmation" ||
        agentStatusLower === "waiting for confirmation";
      const isThinking =
        agentStatusLower === "running" ||
        agentStatusLower === "thinking";

      if (hasPendingApproval || isWaitingConfirmation) {
        if (mochi) {
          mochi.setMood("alert");
        }
        setAgentAlert(true);
        switchTab("agent");
      } else {
        setAgentAlert(false);
        if (mochi) {
          if (isThinking) {
            mochi.setMood("thinking");
          } else if (state.media?.isPlaying) {
            mochi.setMood("happy");
          } else {
            mochi.setMood("idle");
          }
        }
      }

      if (islandStatus) {
        if (hasPendingApproval || isWaitingConfirmation) {
          islandStatus.textContent = "Approval Needed";
        } else if (state.agent?.currentTool && agentStatusLower !== "idle") {
          islandStatus.textContent = state.agent.currentTool;
        } else if (agentStatusLower && agentStatusLower !== "idle") {
          islandStatus.textContent = state.agent!.status;
        } else if (agentStatusLower === "idle") {
          islandStatus.textContent = "Coucou Connected";
        }
      }

      if (player) {
        player.update(state.media);
      }
      if (statsCard && state.pcStats) {
        statsCard.update(state.pcStats);
      }
      if (agentCard) {
        agentCard.renderSessions(state.sessions);
        if (state.agent) {
          agentCard.update(state.agent);
        }
      }
    },
    (posMs: number) => {
      if (player) {
        player.tick(posMs);
      }
    },
    (prompt: ApprovalPrompt) => {
      if (mochi) {
        mochi.setMood("alert");
      }
      setAgentAlert(true);
      switchTab("agent");
      if (agentCard) {
        agentCard.prompt(prompt);
      }
    },
    (connected: boolean) => {
      if (islandStatus) {
        islandStatus.textContent = connected ? "Coucou Connected" : "Reconnecting...";
      }
      if (!connected && mochi) {
        mochi.setMood("idle");
        mochi.setMusicPlaying(false);
      }
    },
    (reply: { text: string; isUser: boolean }) => {
      if (chatUi) {
        chatUi.receiveReply(reply);
      }
    },
    (diffPayload: { sessionId?: string; files: any[] }) => {
      if (agentCard) {
        agentCard.receiveDiffData(diffPayload.files);
      }
    }
  );

  player = setupMusicPlayer(companion);
  agentCard = setupAntigravityCard(companion);
  chatUi = setupRemoteChat(companion);
  statsCard = setupPcStatsCard(companion);
  companion.connect();
  return companion;
}

function init(): void {
  setupTabs();
  client = initCompanionClient();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
