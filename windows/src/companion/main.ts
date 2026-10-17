// Coucou iPhone Web Companion — Main Bootstrap

import {
  CompanionClient,
  type StateSnapshot,
  type ApprovalPrompt,
} from "./ws";

export let client: CompanionClient | null = null;

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
      if (islandStatus && state.agent?.status && state.agent.status !== "idle") {
        islandStatus.textContent = state.agent.status;
      }
    },
    (_posMs: number) => {
      // Audio playback position tick — wired in Task 6
    },
    (_prompt: ApprovalPrompt) => {
      // Agent approval request — wired in Task 7
    },
    (connected: boolean) => {
      if (islandStatus) {
        islandStatus.textContent = connected ? "Coucou Connected" : "Reconnecting...";
      }
    }
  );

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
