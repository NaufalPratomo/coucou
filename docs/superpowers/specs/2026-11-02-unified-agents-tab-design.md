# Design Spec: Unified Agents Tab & Multi-Agent Remote Chat

**Date**: 2026-11-02  
**Status**: Approved  
**Author**: Antigravity Pair Programmer & User  
**Target Release**: Coucou for Windows v0.6.31  

---

## 1. Problem Statement
The Web Companion currently features a dedicated tab named **Antigravity**. However, the user now runs both **Claude Code** and **Antigravity** simultaneously as coding assistants. 

Hardcoding the tab to "Antigravity" creates friction:
1. When Claude Code is running, the tab label is inaccurate.
2. Senders of permission requests and questions are ambiguous unless explicitly branded.
3. In Remote Chat, the user could only dispatch prompts to Antigravity or clipboard, with no option to directly dispatch prompts to Claude Code.

## 2. Goals & Non-Goals

### Goals
- Rename the second navigation tab from `Antigravity` to **`Agents`** across `companion.html`, `main.ts`, styles, and tests.
- Support multi-agent session switcher pills with distinct visual branding:
  - **Antigravity**: Emerald / Teal dot and accent (`#34d399` / `bg-emerald-500/15`).
  - **Claude Code**: Warm Amber / Coral dot and accent (`#fbbf24` / `bg-amber-500/15`).
- Display dynamic active agent information in the status card header (`Antigravity` vs `Claude Code`), state (`Running`, `Thinking`, `Idle`, `Waiting for Confirmation`), and live tool execution details.
- Clearly attribute approval prompts (Claude Code tool approvals) and interactive questions (Antigravity questions) to their respective agent origin.
- Provide 3 explicit mode pills in Remote Chat:
  - `[ Antigravity ]` (Emerald accent): dispatches prompt to Antigravity session.
  - `[ Claude Code ]` (Amber accent): dispatches prompt to Claude Code session.
  - `[ Copy to PC ]` (Neutral accent): copies to PC clipboard without terminal focus.
- Preserve strict zero Unicode emoji rule (enforced by `companion-ui.test.mjs`), clean antislop mobile/desktop layout reflow, and full test suite pass rate.

### Non-Goals
- Modifying core terminal hook pipes in `coucou-hook` (it already normalizes events from both Claude Code and Antigravity).

---

## 3. Architecture & Data Flow

### 3.1 Session Tracking & Differentiation
`server.rs` tracks sessions in `SESSIONS` mutex. When an event arrives from `coucou-hook`:
- Antigravity sessions identify as `agent: "Antigravity"`.
- Claude Code sessions identify as `agent: "Claude"` or `agent: "Claude Code"`.
- The snapshot sent over WebSocket (`OutboundMessage::FullSync`) contains:
  ```typescript
  export interface SessionSummary {
    id: string;
    agent: string; // "Antigravity" | "Claude" | "Claude Code"
    title: string;
    status: string;
    activeGoal?: string;
    currentTool?: string;
    isActive: boolean;
  }
  ```

### 3.2 Frontend UI Components
- **`companion.html`**:
  - Nav button: `<button data-tab="agent" class="tab-btn ...">Agents</button>`.
  - Remote Chat input bar:
    - `#btn-mode-antigravity`: `Antigravity` mode pill.
    - `#btn-mode-claude`: `Claude Code` mode pill.
    - `#btn-mode-clip`: `Copy to PC` mode pill.
- **`components/AntigravityCard.ts`**:
  - `renderSessions`: applies emerald accent for Antigravity pills, amber accent for Claude pills.
  - `update`: updates `#agent-state-label` and dynamic agent badge (`Antigravity` or `Claude Code`).
  - `prompt`: attributes approval and question cards to the active agent.
- **`components/RemoteChat.ts`**:
  - Handles switching active mode pill between `"antigravity" | "claude" | "clipboard"`.
  - Dispatches message with agent target metadata.

### 3.3 Backend WebSocket Protocol
- `protocol.rs` / `server.rs`:
  - `InboundMessage::ChatPrompt { text: String, mode: String, agent: Option<String> }`:
    - If `mode == "antigravity"` or `agent == Some("Antigravity")`: focus Antigravity window/terminal, copy prompt to clipboard, notify companion.
    - If `mode == "claude"` or `agent == Some("Claude")`: focus Claude Code window/terminal, copy prompt to clipboard, notify companion.
    - If `mode == "clipboard"`: copy to clipboard only.

---

## 4. Verification Plan
1. **Automated Unit Tests**:
   - `npm test --prefix windows`: Ensure all 444+ tests pass.
   - Verify `tests/companion-ui.test.mjs` checks for `Agents` tab, mode pills (`btn-mode-antigravity`, `btn-mode-claude`, `btn-mode-clip`), and zero Unicode emojis.
2. **TypeScript Compilation**:
   - `tsc -p windows/tsconfig.json --noEmit` returns 0 errors.
3. **Rust Compilation & Version Bump**:
   - Bump version to `0.6.31` across `Cargo.toml`, `Cargo.lock`, `package.json`, `tauri.conf.json`.
   - Push commit & tag `windows-v0.6.31` to GitHub Actions for automated build.
