// Coucou iPhone Web Companion — Main Bootstrap

import {
  CompanionClient,
  type StateSnapshot,
  type ApprovalPrompt,
} from "./ws";
import { setupMusicPlayer } from "./components/MusicPlayer";
import { setupAntigravityCard } from "./components/AntigravityCard";

export let client: CompanionClient | null = null;
export let player: ReturnType<typeof setupMusicPlayer> | null = null;
export let agentCard: ReturnType<typeof setupAntigravityCard> | null = null;

export function setupTabs(): void {
  const tabButtons = document.querySelectorAll<HTMLButtonElement>(".tab-btn");
  const tabMusic = document.getElementById("tab-music");
  const tabAgent = document.getElementById("tab-agent");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      if (!targetTab) return;

      if ("vibrate" in navigator) {
        try {
          navigator.vibrate(10);
        } catch {
          // Ignore vibration errors if blocked by browser policy
        }
      }

      tabButtons.forEach((b) => {
        b.classList.remove("active", "text-white");
        b.classList.add("text-neutral-500");
      });
      btn.classList.add("active", "text-white");
      btn.classList.remove("text-neutral-500");

      if (targetTab === "music") {
        tabMusic?.classList.remove("hidden");
        tabMusic?.classList.add("active");
        tabAgent?.classList.add("hidden");
        tabAgent?.classList.remove("active");
      } else if (targetTab === "agent") {
        tabAgent?.classList.remove("hidden");
        tabAgent?.classList.add("active");
        tabMusic?.classList.add("hidden");
        tabMusic?.classList.remove("active");
      }
    });
  });
}

export function initCompanionClient(): CompanionClient {
  const islandStatus = document.getElementById("island-status");
  const batteryLevel = document.getElementById("battery-level");

  const companion = new CompanionClient(
    (state: StateSnapshot) => {
      if (batteryLevel && state.system) {
        const charging = state.system.isCharging ? " ⚡" : "";
        batteryLevel.textContent = `${state.system.batteryPercent}%${charging}`;
      }
      if (islandStatus) {
        const agentStatus = state.agent?.status?.toLowerCase();
        if (agentStatus && agentStatus !== "idle") {
          islandStatus.textContent = state.agent!.status;
        } else if (agentStatus === "idle") {
          islandStatus.textContent = "Coucou Connected";
        }
      }
      if (player && state.media) {
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
      if (agentCard) {
        agentCard.prompt(prompt);
      }
    },
    (connected: boolean) => {
      if (islandStatus) {
        islandStatus.textContent = connected ? "Coucou Connected" : "Reconnecting...";
      }
    }
  );

  player = setupMusicPlayer(companion);
  agentCard = setupAntigravityCard(companion);
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
