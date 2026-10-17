import type { CompanionClient } from "../ws";

export function setupRemoteChat(client: CompanionClient) {
  const form = document.getElementById("chat-form") as HTMLFormElement | null;
  const input = document.getElementById("chat-input") as HTMLInputElement | null;
  const messagesContainer = document.getElementById("chat-messages");
  const btnModeAi = document.getElementById("btn-mode-ai");
  const btnModeClip = document.getElementById("btn-mode-clip");
  const toast = document.getElementById("chat-status-toast");

  let mode: "ai" | "clip" = "ai";

  const triggerHaptic = (ms: number) => {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(ms);
      }
    } catch (_) {}
  };

  const updateMode = (newMode: "ai" | "clip") => {
    mode = newMode;
    triggerHaptic(10);
    if (mode === "ai") {
      btnModeAi?.classList.add("active", "border-emerald-500/50", "bg-emerald-500/15", "text-emerald-400");
      btnModeAi?.classList.remove("border-neutral-800", "bg-neutral-900", "text-neutral-400");
      btnModeClip?.classList.remove("active", "border-emerald-500/50", "bg-emerald-500/15", "text-emerald-400");
      btnModeClip?.classList.add("border-neutral-800", "bg-neutral-900", "text-neutral-400");
      if (input) input.placeholder = "Ask Mochi or prompt laptop AI...";
    } else {
      btnModeClip?.classList.add("active", "border-emerald-500/50", "bg-emerald-500/15", "text-emerald-400");
      btnModeClip?.classList.remove("border-neutral-800", "bg-neutral-900", "text-neutral-400");
      btnModeAi?.classList.remove("active", "border-emerald-500/50", "bg-emerald-500/15", "text-emerald-400");
      btnModeAi?.classList.add("border-neutral-800", "bg-neutral-900", "text-neutral-400");
      if (input) input.placeholder = "Type text to copy to PC clipboard...";
    }
  };

  btnModeAi?.addEventListener("click", () => updateMode("ai"));
  btnModeClip?.addEventListener("click", () => updateMode("clip"));

  const showToast = (msg: string) => {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove("hidden");
    setTimeout(() => {
      toast.classList.add("hidden");
    }, 2500);
  };

  const appendMessage = (text: string, isUser: boolean) => {
    if (!messagesContainer) return;
    const bubble = document.createElement("div");
    bubble.className = isUser
      ? "chat-bubble flex items-start justify-end space-x-2 my-1"
      : "chat-bubble flex items-start space-x-3 my-1";

    if (isUser) {
      bubble.innerHTML = `
        <div class="bg-emerald-500 text-black font-semibold rounded-2xl rounded-tr-sm px-4 py-3 text-sm shadow-md leading-relaxed max-w-[85%] break-words">
          ${escapeHtml(text)}
        </div>
      `;
    } else {
      bubble.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0 shadow">
          <svg class="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v2"/><rect x="4" y="4" width="16" height="14" rx="3"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/><path d="M9 15h6"/>
          </svg>
        </div>
        <div class="bg-neutral-900 border border-neutral-800 rounded-2xl rounded-tl-sm p-3.5 text-sm text-neutral-200 shadow-md leading-relaxed max-w-[85%] break-words whitespace-pre-wrap">
          ${escapeHtml(text)}
        </div>
      `;
    }

    messagesContainer.appendChild(bubble);
    try {
      messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: "smooth" });
    } catch {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  };

  const submitCurrentMessage = () => {
    const text = input?.value?.trim();
    if (!text) return;

    if (input) input.value = "";
    triggerHaptic(15);
    client.sendChatMessage(text, mode);
    showToast(mode === "clip" ? "Copied to PC!" : "Sent to AI!");
  };

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    submitCurrentMessage();
  });

  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitCurrentMessage();
    }
  });

  return {
    receiveReply(reply: { text: string; isUser: boolean }) {
      appendMessage(reply.text, reply.isUser);
    },
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
