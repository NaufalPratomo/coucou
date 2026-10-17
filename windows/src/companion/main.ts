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

export let client: CompanionClient | null = null;
export let player: ReturnType<typeof setupMusicPlayer> | null = null;
export let agentCard: ReturnType<typeof setupAntigravityCard> | null = null;
export let chatUi: ReturnType<typeof setupRemoteChat> | null = null;
export let mochi: MochiCanvas | null = null;

export function switchTab(targetTab: "music" | "agent" | "chat"): void {
  const tabButtons = document.querySelectorAll<HTMLButtonElement>(".tab-btn");
  const tabMusic = document.getElementById("tab-music");
  const tabAgent = document.getElementById("tab-agent");
  const tabChat = document.getElementById("tab-chat");

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

  if (targetTab === "music") {
    tabMusic?.classList.remove("hidden");
    tabMusic?.classList.add("active");
    tabAgent?.classList.add("hidden");
    tabAgent?.classList.remove("active");
    tabChat?.classList.add("hidden");
    tabChat?.classList.remove("active");
  } else if (targetTab === "agent") {
    tabAgent?.classList.remove("hidden");
    tabAgent?.classList.add("active");
    tabMusic?.classList.add("hidden");
    tabMusic?.classList.remove("active");
    tabChat?.classList.add("hidden");
    tabChat?.classList.remove("active");
  } else if (targetTab === "chat") {
    tabChat?.classList.remove("hidden");
    tabChat?.classList.add("active");
    tabMusic?.classList.add("hidden");
    tabMusic?.classList.remove("active");
    tabAgent?.classList.add("hidden");
    tabAgent?.classList.remove("active");
  }
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
      const targetTab = btn.getAttribute("data-tab") as "music" | "agent" | "chat" | null;
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
      if (batteryLevel && state.system) {
        const charging = state.system.isCharging ? " ⚡" : "";
        batteryLevel.textContent = `${state.system.batteryPercent}%${charging}`;
        if (state.system.batteryPercent <= 20 && !state.system.isCharging) {
          batteryLevel.classList.add("text-rose-400");
          batteryLevel.classList.remove("text-neutral-400");
        } else {
          batteryLevel.classList.remove("text-rose-400");
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
        } else if (agentStatusLower && agentStatusLower !== "idle") {
          islandStatus.textContent = state.agent!.status;
        } else if (agentStatusLower === "idle") {
          islandStatus.textContent = "Coucou Connected";
        }
      }

      if (player) {
        player.update(state.media);
      }
      if (agentCard && state.agent) {
        agentCard.update(state.agent);
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
    }
  );

  player = setupMusicPlayer(companion);
  agentCard = setupAntigravityCard(companion);
  chatUi = setupRemoteChat(companion);
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
