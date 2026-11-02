# Unified Agents Tab & Multi-Agent Remote Chat Implementation Plan

> **Goal**: Unify Antigravity and Claude Code monitoring under a renamed `Agents` tab in the Coucou Web Companion, and add dedicated targeting buttons in Remote Chat to dispatch prompts to Antigravity or Claude Code.  
> **Target Release**: Coucou for Windows v0.6.31  
> **Architecture Spec**: [`docs/superpowers/specs/2026-11-02-unified-agents-tab-design.md`](file:///C:/Users/Nof/coucou-fork/docs/superpowers/specs/2026-11-02-unified-agents-tab-design.md)  

---

## User Review Checkpoint
Before proceeding with execution, the user has approved the concept and design spec.

---

## Tasks

### Task 1: Update Companion HTML (`companion.html`)
- **File**: `windows/companion.html`
- **Actions**:
  1. Rename navigation tab button from `Antigravity` to `Agents` (`<button data-tab="agent" class="tab-btn ...">Agents</button>`).
  2. In `#tab-agent` status card, add dynamic agent header badge `#agent-type-badge`.
  3. In `#tab-chat` input controls, replace dual mode pills with three explicit mode buttons:
     - `#btn-mode-antigravity` (`Antigravity`)
     - `#btn-mode-claude` (`Claude Code`)
     - `#btn-mode-clip` (`Copy to PC`)
- **Verification**: Check HTML contains `Agents`, `#btn-mode-antigravity`, and `#btn-mode-claude`.

---

### Task 2: Update Stylesheet (`src/companion/style.css`)
- **File**: `windows/src/companion/style.css`
- **Actions**:
  1. Add Claude Code brand accents (`.mode-pill.claude`, amber/coral border & background).
  2. Add Antigravity brand accents (`.mode-pill.antigravity`, emerald border & background).
  3. Add session pill color variants for Claude Code (`.session-pill.claude`) vs Antigravity (`.session-pill.antigravity`).
- **Verification**: Zero Unicode emojis, styles properly formatted.

---

### Task 3: Remote Chat Multi-Agent Targeting (`components/RemoteChat.ts` & `ws.ts`)
- **Files**:
  - `windows/src/companion/components/RemoteChat.ts`
  - `windows/src/companion/ws.ts`
- **Actions**:
  1. Update `ChatMode` type to `"antigravity" | "claude" | "clipboard"`.
  2. Wire click events for `#btn-mode-antigravity`, `#btn-mode-claude`, and `#btn-mode-clip`.
  3. Update `client.sendChatMessage(text, mode, agent)` to include targeted agent.
  4. Show distinct dispatch toast: *"Dispatched to Antigravity!"* or *"Dispatched to Claude Code!"*.
- **Verification**: `tsc --noEmit` passes.

---

### Task 4: Dynamic Agent Card (`components/AntigravityCard.ts`)
- **File**: `windows/src/companion/components/AntigravityCard.ts`
- **Actions**:
  1. In `renderSessions()`, check `session.agent`:
     - If `agent.toLowerCase().includes("claude")`: apply amber badge and Claude branding.
     - Else (Antigravity): apply emerald badge.
  2. In `update()`, display active agent name in `#agent-type-badge` and status label.
  3. In `prompt()`, display source agent in approval card and question card.
- **Verification**: `tsc --noEmit` passes.

---

### Task 5: Backend WebSocket Protocol & Dispatch (`protocol.rs` & `server.rs`)
- **Files**:
  - `windows/src-tauri/src/web_companion/protocol.rs`
  - `windows/src-tauri/src/web_companion/server.rs`
- **Actions**:
  1. In `protocol.rs`, update `InboundMessage::ChatPrompt` to accept `target: Option<String>`.
  2. In `server.rs`, when `target` is `"claude"`:
     - Search for session with `agent == "Claude"` or `"Claude Code"`.
     - Focus Claude terminal/window and dispatch prompt to clipboard.
  3. When `target` is `"antigravity"`:
     - Search for session with `agent == "Antigravity"`.
     - Focus Antigravity terminal/window and dispatch prompt to clipboard.
- **Verification**: Cargo check / unit tests compile cleanly.

---

### Task 6: Unit Tests & Verification (`tests/companion-ui.test.mjs`)
- **File**: `windows/tests/companion-ui.test.mjs`
- **Actions**:
  1. Update tests expecting `Antigravity` tab button to expect `Agents`.
  2. Update tests expecting mode pills to verify `btn-mode-antigravity`, `btn-mode-claude`, and `btn-mode-clip`.
  3. Verify zero Unicode emojis across all files.
- **Verification**: `npm test --prefix windows` passes all 444+ tests.

---

### Task 7: Version Bump & Release
- **Files**:
  - `windows/package.json`
  - `windows/Cargo.toml`
  - `windows/Cargo.lock`
  - `windows/src-tauri/tauri.conf.json`
- **Actions**:
  1. Bump version `0.6.30` -> `0.6.31`.
  2. Commit changes with message `feat(companion): unify Antigravity and Claude Code under Agents tab (v0.6.31)`.
  3. Tag `windows-v0.6.31` and push to origin `main` and tag `windows-v0.6.31`.
  4. Monitor GitHub Actions build until `Coucou-Windows-0.6.31-setup.exe` is generated.
