// Coucou iPhone Web Companion — Main Bootstrap

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

function init(): void {
  setupTabs();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
