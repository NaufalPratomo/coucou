import type {
  ApprovalPrompt,
  CompanionClient,
  AgentState,
  SessionSummary,
  CompanionFileDiff,
  DiffSummaryFile,
} from "../ws";

export function setupAntigravityCard(client: CompanionClient) {
  // Session Switcher Elements
  const sessionCountBadge = document.getElementById("session-count-badge");
  const sessionPillsRow = document.getElementById("session-pills-row");

  // Agent Status Card Elements
  const statusLabel = document.getElementById("agent-state-label")!;
  const goalEl = document.getElementById("agent-goal")!;
  const pulseDot = document.getElementById("agent-pulse-dot");
  const activityText = document.getElementById("agent-activity-text");
  const activityBadge = document.getElementById("agent-activity-badge");

  // Standard Approval Elements
  const approvalCard = document.getElementById("approval-card")!;
  const promptText = document.getElementById("approval-prompt-text")!;
  const btnAllow = document.getElementById("btn-allow")!;
  const btnDeny = document.getElementById("btn-deny")!;

  // Interactive Multi-Choice Question Elements
  const questionCard = document.getElementById("question-card")!;
  const questionModeBadge = document.getElementById("question-mode-badge");
  const questionListContainer = document.getElementById("question-list-container")!;
  const btnQuestionSubmit = document.getElementById("btn-question-submit") as HTMLButtonElement | null;
  const btnQuestionDecline = document.getElementById("btn-question-decline") as HTMLButtonElement | null;

  // Git Diff Viewer Elements
  const diffAddTotal = document.getElementById("diff-add-total");
  const diffDelTotal = document.getElementById("diff-del-total");
  const btnDiffRefresh = document.getElementById("btn-diff-refresh");
  const diffFilesList = document.getElementById("diff-files-list")!;
  const diffEmptyState = document.getElementById("diff-empty-state");
  const diffViewer = document.getElementById("diff-viewer")!;
  const diffViewerFilename = document.getElementById("diff-viewer-filename")!;
  const btnDiffClose = document.getElementById("btn-diff-close")!;
  const diffLinesContainer = document.getElementById("diff-lines-container")!;

  let currentRequestId: string | null = null;
  let activeQuestionsPromptId: string | null = null;
  let activeQuestionsPrompt: ApprovalPrompt | null = null;
  const userAnswers = new Map<string, string[]>(); // questionText -> selected option labels
  let cachedFullDiffs: CompanionFileDiff[] = [];
  let selectedFileDiff: string | null = null;
  let lastRenderedSessionKey = "";
  let lastRenderedDiffKey = "";

  const triggerHaptic = (pattern: number | number[]) => {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(pattern);
      }
    } catch (_) {}
  };

  // ── Standard Approval Listeners ──────────────────────────────────────────
  btnAllow.onclick = () => {
    if (currentRequestId) {
      triggerHaptic([30, 50, 30]);
      client.sendDecision(currentRequestId, true);
      approvalCard.classList.add("hidden");
      questionCard.classList.add("hidden");
      currentRequestId = null;
      activeQuestionsPromptId = null;
      activeQuestionsPrompt = null;
    }
  };

  btnDeny.onclick = () => {
    if (currentRequestId) {
      triggerHaptic(60);
      client.sendDecision(currentRequestId, false);
      approvalCard.classList.add("hidden");
      questionCard.classList.add("hidden");
      currentRequestId = null;
      activeQuestionsPromptId = null;
      activeQuestionsPrompt = null;
    }
  };

  // ── Multi-Choice Question Listeners ──────────────────────────────────────
  if (btnQuestionDecline) {
    btnQuestionDecline.onclick = () => {
      if (currentRequestId) {
        triggerHaptic(60);
        client.sendDecision(currentRequestId, false);
        questionCard.classList.add("hidden");
        approvalCard.classList.add("hidden");
        currentRequestId = null;
        activeQuestionsPromptId = null;
        activeQuestionsPrompt = null;
      }
    };
  }

  if (btnQuestionSubmit) {
    btnQuestionSubmit.onclick = () => {
      if (!currentRequestId || !activeQuestionsPrompt || !activeQuestionsPrompt.questions) return;

      const payload: Record<string, string | string[]> = {};
      let allAnswered = true;

      for (const q of activeQuestionsPrompt.questions) {
        const selected = userAnswers.get(q.question) || [];
        if (selected.length === 0) {
          allAnswered = false;
        }
        if (q.multiSelect) {
          payload[q.question] = selected;
        } else {
          payload[q.question] = selected[0] || "";
        }
      }

      if (!allAnswered) {
        triggerHaptic([40, 40]);
        activeQuestionsPrompt.questions.forEach((q, idx) => {
          const selected = userAnswers.get(q.question) || [];
          const qBox = questionListContainer.children[idx] as HTMLElement | undefined;
          if (qBox && selected.length === 0) {
            qBox.classList.add("question-required-highlight");
            setTimeout(() => qBox.classList.remove("question-required-highlight"), 1600);
          }
        });
        return;
      }

      triggerHaptic([30, 50, 30]);
      client.sendAnswer(currentRequestId, payload);
      questionCard.classList.add("hidden");
      approvalCard.classList.add("hidden");
      currentRequestId = null;
      activeQuestionsPromptId = null;
      activeQuestionsPrompt = null;
    };
  }

  // ── Git Diff Refresh & Close Listeners ───────────────────────────────────
  if (btnDiffRefresh) {
    btnDiffRefresh.onclick = () => {
      triggerHaptic(20);
      client.requestDiff();
      btnDiffRefresh.classList.add("animate-spin");
      setTimeout(() => btnDiffRefresh.classList.remove("animate-spin"), 600);
    };
  }

  if (btnDiffClose) {
    btnDiffClose.onclick = () => {
      triggerHaptic(15);
      diffViewer.classList.add("hidden");
      selectedFileDiff = null;
      document.querySelectorAll(".diff-file-row").forEach((el) => el.classList.remove("expanded"));
    };
  }

  // ── Component API ────────────────────────────────────────────────────────
  const card = {
    renderSessions(sessions?: SessionSummary[]) {
      if (!sessionPillsRow) return;

      const items = sessions && sessions.length > 0 ? sessions : [
        {
          id: "primary",
          agent: "Antigravity",
          title: "coucou-fork",
          status: "idle",
          isActive: true,
        },
      ];

      if (sessionCountBadge) {
        sessionCountBadge.textContent = `${items.length} Active`;
      }

      const sessionKey = items.map((s) => `${s.id}:${s.title}:${s.status}:${s.isActive}`).join("|");
      if (sessionKey === lastRenderedSessionKey) {
        return;
      }
      lastRenderedSessionKey = sessionKey;

      sessionPillsRow.innerHTML = "";

      for (const s of items) {
        const pill = document.createElement("button");
        pill.className = `session-pill ${s.isActive ? "active" : ""}`;
        pill.setAttribute("data-session-id", s.id);

        const dot = document.createElement("span");
        const stLower = (s.status || "").toLowerCase();
        if (stLower === "running" || stLower === "thinking") {
          dot.className = "w-2 h-2 rounded-full bg-amber-400 animate-pulse";
        } else if (stLower.includes("waiting") || stLower.includes("confirmation")) {
          dot.className = "w-2 h-2 rounded-full bg-rose-400 animate-pulse";
        } else {
          dot.className = "w-2 h-2 rounded-full bg-emerald-400";
        }

        const label = document.createElement("span");
        const titleText = s.title ? `${s.agent} · ${s.title}` : s.agent;
        label.textContent = titleText;

        pill.appendChild(dot);
        pill.appendChild(label);

        pill.onclick = () => {
          triggerHaptic(25);
          client.selectSession(s.id);
          client.requestDiff(s.id);
          document.querySelectorAll(".session-pill").forEach((p) => p.classList.remove("active"));
          pill.classList.add("active");
        };

        sessionPillsRow.appendChild(pill);
      }
    },

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

      // Handle Prompt vs Question Card
      if (agent.pendingRequest) {
        card.prompt(agent.pendingRequest);
      } else {
        approvalCard.classList.add("hidden");
        questionCard.classList.add("hidden");
        currentRequestId = null;
        activeQuestionsPromptId = null;
        activeQuestionsPrompt = null;
      }

      // Update Git Diff Summary List
      card.renderDiffSummary(agent.diffSummary);
    },

    renderDiffSummary(diffSummary?: DiffSummaryFile[]) {
      if (!diffFilesList) return;

      if (!diffSummary || diffSummary.length === 0) {
        if (diffEmptyState) diffEmptyState.classList.remove("hidden");
        diffFilesList.innerHTML = "";
        if (diffAddTotal) diffAddTotal.textContent = "+0";
        if (diffDelTotal) diffDelTotal.textContent = "-0";
        lastRenderedDiffKey = "";
        return;
      }

      const diffKey = diffSummary.map((f) => `${f.path}:${f.status}:${f.additions}:${f.deletions}:${f.path === selectedFileDiff}`).join("|");
      if (diffKey === lastRenderedDiffKey) {
        return;
      }
      lastRenderedDiffKey = diffKey;

      if (diffEmptyState) diffEmptyState.classList.add("hidden");
      diffFilesList.innerHTML = "";

      let totalAdd = 0;
      let totalDel = 0;

      for (const f of diffSummary) {
        totalAdd += f.additions;
        totalDel += f.deletions;

        const row = document.createElement("div");
        row.className = `diff-file-row ${selectedFileDiff === f.path ? "expanded" : ""}`;
        row.setAttribute("data-file-path", f.path);

        const left = document.createElement("div");
        left.className = "flex items-center space-x-2.5 min-w-0 flex-1";

        const badge = document.createElement("span");
        if (f.status === "added") {
          badge.className = "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 shrink-0";
          badge.textContent = "A";
        } else if (f.status === "deleted") {
          badge.className = "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 shrink-0";
          badge.textContent = "D";
        } else {
          badge.className = "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 shrink-0";
          badge.textContent = "M";
        }

        const info = document.createElement("div");
        info.className = "min-w-0 flex-1";
        const fname = document.createElement("p");
        fname.className = "text-xs font-semibold text-neutral-200 truncate";
        fname.textContent = f.filename;
        const fpath = document.createElement("p");
        fpath.className = "text-[10px] font-mono text-neutral-500 truncate";
        fpath.textContent = f.path;
        info.appendChild(fname);
        info.appendChild(fpath);

        left.appendChild(badge);
        left.appendChild(info);

        const right = document.createElement("div");
        right.className = "flex items-center space-x-1.5 font-mono text-xs font-semibold shrink-0 ml-2";
        if (f.additions > 0) {
          const addSpan = document.createElement("span");
          addSpan.className = "text-emerald-400";
          addSpan.textContent = `+${f.additions}`;
          right.appendChild(addSpan);
        }
        if (f.deletions > 0) {
          const delSpan = document.createElement("span");
          delSpan.className = "text-rose-400";
          delSpan.textContent = `-${f.deletions}`;
          right.appendChild(delSpan);
        }

        row.appendChild(left);
        row.appendChild(right);

        row.onclick = () => {
          triggerHaptic(20);
          selectedFileDiff = f.path;
          document.querySelectorAll(".diff-file-row").forEach((el) => el.classList.remove("expanded"));
          row.classList.add("expanded");

          const cached = cachedFullDiffs.find((d) => d.path === f.path);
          if (cached) {
            card.displayFileDiff(cached);
          } else {
            client.requestDiff();
          }
        };

        diffFilesList.appendChild(row);
      }

      if (diffAddTotal) diffAddTotal.textContent = `+${totalAdd}`;
      if (diffDelTotal) diffDelTotal.textContent = `-${totalDel}`;
    },

    displayFileDiff(fileDiff: CompanionFileDiff) {
      if (!diffViewer || !diffLinesContainer || !diffViewerFilename) return;

      diffViewerFilename.textContent = fileDiff.path;
      diffLinesContainer.innerHTML = "";

      for (const line of fileDiff.lines) {
        const lineEl = document.createElement("span");
        lineEl.className = "diff-line";

        if (line.kind === "+") {
          lineEl.classList.add("diff-line-add");
          lineEl.textContent = `+ ${line.text}`;
        } else if (line.kind === "-") {
          lineEl.classList.add("diff-line-del");
          lineEl.textContent = `- ${line.text}`;
        } else if (line.kind === "@") {
          lineEl.classList.add("diff-line-hunk");
          lineEl.textContent = line.text;
        } else {
          lineEl.classList.add("diff-line-ctx");
          lineEl.textContent = `  ${line.text}`;
        }

        diffLinesContainer.appendChild(lineEl);
      }

      diffViewer.classList.remove("hidden");
      diffViewer.scrollIntoView({ behavior: "smooth", block: "nearest" });
    },

    receiveDiffData(files: CompanionFileDiff[]) {
      cachedFullDiffs = files;

      // Update diff summary from full diffs
      const summary: DiffSummaryFile[] = files.map((f) => ({
        path: f.path,
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
      }));
      card.renderDiffSummary(summary);

      if (selectedFileDiff) {
        const found = files.find((f) => f.path === selectedFileDiff);
        if (found) {
          card.displayFileDiff(found);
        }
      }
    },

    prompt(req: ApprovalPrompt) {
      // ── Scenario A: Question Prompt (AskUserQuestion / ask_question) ──────
      if (req.questions && req.questions.length > 0) {
        if (currentRequestId === req.id && activeQuestionsPromptId === req.id) {
          return;
        }

        currentRequestId = req.id;
        activeQuestionsPromptId = req.id;
        approvalCard.classList.add("hidden");
        activeQuestionsPrompt = req;
        userAnswers.clear();

        const hasMulti = req.questions.some((q) => q.multiSelect);
        if (questionModeBadge) {
          questionModeBadge.textContent = hasMulti ? "Multi Choice" : "Single Choice";
        }

        questionListContainer.innerHTML = "";

        for (const q of req.questions) {
          const qBox = document.createElement("div");
          qBox.className = "space-y-2";

          const titleRow = document.createElement("div");
          titleRow.className = "flex items-center justify-between";
          const title = document.createElement("h4");
          title.className = "text-xs font-semibold text-neutral-200";
          title.textContent = q.question;
          titleRow.appendChild(title);

          if (q.multiSelect) {
            const badge = document.createElement("span");
            badge.className = "text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400";
            badge.textContent = "Select multiple";
            titleRow.appendChild(badge);
          }

          qBox.appendChild(titleRow);

          const optsBox = document.createElement("div");
          optsBox.className = "space-y-1.5";

          for (const opt of q.options) {
            const optCard = document.createElement("div");
            optCard.className = `question-option-card ${q.multiSelect ? "multi" : ""}`;

            const labelWrap = document.createElement("div");
            labelWrap.className = "min-w-0 flex-1 pr-2";
            const optLabel = document.createElement("p");
            optLabel.className = "text-xs font-semibold truncate";
            optLabel.textContent = opt.label;
            labelWrap.appendChild(optLabel);

            if (opt.description) {
              const optDesc = document.createElement("p");
              optDesc.className = "text-[11px] text-neutral-500 truncate mt-0.5";
              optDesc.textContent = opt.description;
              labelWrap.appendChild(optDesc);
            }

            const indicator = document.createElement("div");
            indicator.className = "opt-indicator";
            indicator.innerHTML = `<svg class="opt-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

            optCard.appendChild(labelWrap);
            optCard.appendChild(indicator);

            optCard.onclick = () => {
              triggerHaptic(20);
              const currentPicks = userAnswers.get(q.question) || [];

              if (q.multiSelect) {
                if (currentPicks.includes(opt.label)) {
                  userAnswers.set(
                    q.question,
                    currentPicks.filter((l) => l !== opt.label)
                  );
                  optCard.classList.remove("selected");
                } else {
                  currentPicks.push(opt.label);
                  userAnswers.set(q.question, currentPicks);
                  optCard.classList.add("selected");
                }
              } else {
                userAnswers.set(q.question, [opt.label]);
                optsBox.querySelectorAll(".question-option-card").forEach((c) => c.classList.remove("selected"));
                optCard.classList.add("selected");
              }
            };

            optsBox.appendChild(optCard);
          }

          qBox.appendChild(optsBox);
          questionListContainer.appendChild(qBox);
        }

        questionCard.classList.remove("hidden");
        triggerHaptic([100, 50, 100]);
        return;
      }

      // ── Scenario B: Regular Approval Prompt (Allow / Deny) ────────────────
      if (currentRequestId === req.id && activeQuestionsPromptId === null && !approvalCard.classList.contains("hidden")) {
        return;
      }
      currentRequestId = req.id;
      activeQuestionsPromptId = null;
      activeQuestionsPrompt = null;
      questionCard.classList.add("hidden");
      promptText.textContent = req.prompt || (req.command ? `Run: ${req.command}` : "Confirmation needed");
      approvalCard.classList.remove("hidden");
      triggerHaptic([100, 50, 100]);
    },
  };

  return card;
}
