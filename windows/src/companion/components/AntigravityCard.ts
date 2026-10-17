import type { ApprovalPrompt, CompanionClient, AgentState } from "../ws";

export function setupAntigravityCard(client: CompanionClient) {
  const statusLabel = document.getElementById("agent-state-label")!;
  const goalEl = document.getElementById("agent-goal")!;
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
      statusLabel.textContent = agent.status || "Idle";
      const statusLower = (agent.status || "").toLowerCase();
      if (statusLower === "running" || statusLower === "thinking") {
        statusLabel.className = "text-lg font-bold text-amber-400 mt-1 capitalize";
      } else if (statusLower === "waiting_confirmation" || statusLower === "waiting for confirmation") {
        statusLabel.className = "text-lg font-bold text-rose-400 mt-1 capitalize";
      } else {
        statusLabel.className = "text-lg font-bold text-emerald-400 mt-1 capitalize";
      }

      goalEl.textContent = agent.activeGoal || "No active tasks";

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
