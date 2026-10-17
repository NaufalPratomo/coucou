import type { ApprovalPrompt, CompanionClient, AgentState } from "../ws";

export function setupAntigravityCard(client: CompanionClient) {
  const statusLabel = document.getElementById("agent-state-label")!;
  const goalEl = document.getElementById("agent-goal")!;
  const pulseDot = document.getElementById("agent-pulse-dot");
  const activityText = document.getElementById("agent-activity-text");
  const activityBadge = document.getElementById("agent-activity-badge");
  const approvalCard = document.getElementById("approval-card")!;
  const promptText = document.getElementById("approval-prompt-text")!;
  const btnAllow = document.getElementById("btn-allow")!;
  const btnDeny = document.getElementById("btn-deny")!;

  let currentRequestId: string | null = null;

  const triggerHaptic = (pattern: number | number[]) => {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(pattern);
      }
    } catch (_) {}
  };

  btnAllow.onclick = () => {
    if (currentRequestId) {
      triggerHaptic([30, 50, 30]);
      client.sendDecision(currentRequestId, true);
      approvalCard.classList.add("hidden");
      currentRequestId = null;
    }
  };

  btnDeny.onclick = () => {
    if (currentRequestId) {
      triggerHaptic(60);
      client.sendDecision(currentRequestId, false);
      approvalCard.classList.add("hidden");
      currentRequestId = null;
    }
  };

  const card = {
    update(agent?: AgentState) {
      if (!agent) return;
      const statusLower = (agent.status || "").toLowerCase();

      if (statusLower === "running" || statusLower === "thinking") {
        statusLabel.textContent = statusLower === "thinking" ? "Thinking" : "Running";
        statusLabel.className = "text-xl font-bold text-amber-400 mt-1 capitalize";
        if (pulseDot) {
          pulseDot.className = "w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse";
        }
        if (activityBadge) {
          activityBadge.textContent = "Active";
          activityBadge.className = "text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold tracking-wider";
        }
      } else if (statusLower === "waiting_confirmation" || statusLower === "waiting for confirmation") {
        statusLabel.textContent = "Waiting for Confirmation";
        statusLabel.className = "text-xl font-bold text-rose-400 mt-1 capitalize";
        if (pulseDot) {
          pulseDot.className = "w-2.5 h-2.5 rounded-full bg-rose-400 animate-pulse";
        }
        if (activityBadge) {
          activityBadge.textContent = "Action Required";
          activityBadge.className = "text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-semibold tracking-wider";
        }
      } else {
        statusLabel.textContent = "Idle";
        statusLabel.className = "text-xl font-bold text-emerald-400 mt-1 capitalize";
        if (pulseDot) {
          pulseDot.className = "w-2.5 h-2.5 rounded-full bg-emerald-400";
        }
        if (activityBadge) {
          activityBadge.textContent = "Idle";
          activityBadge.className = "text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-semibold tracking-wider";
        }
      }

      goalEl.textContent = agent.activeGoal || "No active tasks";
      if (activityText) {
        activityText.textContent = agent.currentTool || "Standing by";
      }

      if (agent.pendingRequest) {
        card.prompt(agent.pendingRequest);
      } else {
        approvalCard.classList.add("hidden");
        currentRequestId = null;
      }
    },
    prompt(req: ApprovalPrompt) {
      currentRequestId = req.id;
      promptText.textContent = req.prompt || (req.command ? `Run: ${req.command}` : "Confirmation needed");
      approvalCard.classList.remove("hidden");
      triggerHaptic([100, 50, 100]);
    },
  };

  return card;
}
