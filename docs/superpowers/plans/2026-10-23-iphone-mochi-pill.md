# Dedicated iPhone Mochi Pill ("NOFFF") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a dedicated Mochi character and Dynamic Island pill named "NOFFF" with iOS Blue styling, unread badges, reactive emotes, and an interactive iPhone Notification Center card.

**Architecture:** Update the `integration_messages` catalog item in `core/pills.ts` with name "NOFFF" and color `#0A84FF`. Enhance `views/messages.ts` and `views/views.ts` to display the NOFFF mini Mochi tab, unread counter, and notification list. Trigger reactive Mochi emotes in `core/notifications.ts` on incoming Phone Link toasts.

**Tech Stack:** TypeScript, Tauri 2, HTML5 Canvas (BotEngine), Vite, Node.js test runner.

## Global Constraints
- Zero unicode emojis (use vector SVG only).
- Do not break existing agent hooks or integrations (Claude, Antigravity, Spotify).
- Preserve all 408+ existing unit tests (`npm test` must stay green).
- Keep system lightweight for Windows Ghost Spectre.

---

### Task 1: Update Pill Definition and Session Subtitle

**Files:**
- Modify: `windows/src/core/pills.ts:135-195`
- Test: `windows/tests/pills-nofff.test.mjs`

**Interfaces:**
- Consumes: `PILL_CATALOG`, `MESSAGES_ID` from `windows/src/core/pills.ts`
- Produces: `pillDefinition(MESSAGES_ID)` returning `{ id: "integration_messages", name: "NOFFF", color: "#0A84FF", subtitle: "iPhone Connected" }`

- [ ] **Step 1: Write the failing test**

Create `windows/tests/pills-nofff.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pillDefinition, sessionSubtitle, MESSAGES_ID } from '../src/core/pills.ts';

test('integration_messages is named NOFFF with iOS Blue color', () => {
  const def = pillDefinition(MESSAGES_ID);
  assert.ok(def, 'pill definition exists');
  assert.equal(def.name, 'NOFFF');
  assert.equal(def.color, '#0A84FF');
  assert.equal(def.subtitle, 'iPhone Connected');
  assert.equal(sessionSubtitle(MESSAGES_ID), 'NOFFF');
});
```

- [ ] **Step 2: Run test to confirm it fails**
Run `node --import ./tests/setup.mjs --test "tests/pills-nofff.test.mjs"` and verify failure.

- [ ] **Step 3: Update `windows/src/core/pills.ts`**
Update `integration_messages` catalog entry and `sessionSubtitle`:
```typescript
  { id: "integration_messages", name: "NOFFF", color: "#0A84FF", category: "service",
    subtitle: "iPhone Connected", source: "n8n", support: "yes", connect: none },
```
and:
```typescript
    case "integration_messages": return "NOFFF";
```

- [ ] **Step 4: Run test to verify it passes**
Run `node --import ./tests/setup.mjs --test "tests/pills-nofff.test.mjs"` and confirm pass.

- [ ] **Step 5: Commit changes**
`git add windows/src/core/pills.ts windows/tests/pills-nofff.test.mjs && git commit -m "feat(pills): define NOFFF iPhone pill with iOS blue color"`

---

### Task 2: Enhance Messages & Phone Card View

**Files:**
- Modify: `windows/src/views/messages.ts:1-155`
- Modify: `windows/src/core/notifications.ts:47-58`
- Test: `windows/tests/messages-card.test.mjs`

**Interfaces:**
- Consumes: `notificationHistory` from `windows/src/core/notifications.ts`
- Produces: `buildMessagesCard()`, `buildMessagesPill()` with NOFFF identity

- [ ] **Step 1: Write the failing test**

Create `windows/tests/messages-card.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessagesCard, buildMessagesPill } from '../src/views/messages.ts';

test('buildMessagesPill renders NOFFF and unread status without unicode emojis', () => {
  const pill = buildMessagesPill(() => {});
  pill.sync();
  assert.ok(pill.el.textContent.includes('NOFFF'));
  assert.doesNotMatch(pill.el.innerHTML, /[\u{1F300}-\u{1FAFF}]/u);
});

test('buildMessagesCard renders NOFFF header and empty state without unicode emojis', () => {
  const card = buildMessagesCard();
  card.sync();
  assert.ok(card.el.textContent.includes('NOFFF'));
  assert.ok(card.el.textContent.includes('iPhone Connected'));
  assert.doesNotMatch(card.el.innerHTML, /[\u{1F300}-\u{1FAFF}]/u);
});
```

- [ ] **Step 2: Run test to confirm it fails**
Run `node --import ./tests/setup.mjs --test "tests/messages-card.test.mjs"`.

- [ ] **Step 3: Update `windows/src/views/messages.ts`**
Update `buildMessagesCard` and `buildMessagesPill`:
- Header dot: `#0A84FF`.
- Title: `"NOFFF"`.
- Sub: `"iPhone Connected"`.
- Empty text: `"No new iPhone notifications"`.
- Pill name: `"NOFFF"`.
- Pill sub: `count > 0 ? (count === 1 ? "1 notification" : `${count} notifications`) : "Connected"`.

- [ ] **Step 4: Update `windows/src/core/notifications.ts`**
Ensure incoming notifications set Mochi emote to `surprised` or `proud`:
```typescript
    const msgTask = State.tasks.find((t) => t.id === "integration_messages");
    if (msgTask) {
      msgTask.name = "NOFFF";
      msgTask.color = "#0A84FF";
      msgTask.state = "thinking";
      msgTask.emote = "surprised";
      msgTask.pillBadge = "approval";
      msgTask.steps = [notif.appName, `${notif.title}: ${notif.body}`];
      msgTask.stepIndex = 1;
    }
```

- [ ] **Step 5: Run tests to verify pass**
Run `node --import ./tests/setup.mjs --test "tests/messages-card.test.mjs"`.

- [ ] **Step 6: Commit changes**
`git add windows/src/views/messages.ts windows/src/core/notifications.ts windows/tests/messages-card.test.mjs && git commit -m "feat(views): customize Messages card and pill for NOFFF iPhone"`

---

### Task 3: Island Header Binding & Styling

**Files:**
- Modify: `windows/src/views/views.ts:140-185`
- Modify: `windows/src/style.css:250-290`
- Test: `windows/tests/nofff-ui.test.mjs`

**Interfaces:**
- Consumes: `State.tasks`, `MESSAGES_ID`
- Produces: Header tab for NOFFF with mini Mochi and badge counter

- [ ] **Step 1: Write UI verification test**

Create `windows/tests/nofff-ui.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { State } from '../src/core/state.ts';
import { MESSAGES_ID } from '../src/core/pills.ts';
import { buildHeader } from '../src/views/views.ts';

test('island header displays NOFFF tab for MESSAGES_ID', () => {
  State.tasks = [
    { id: MESSAGES_ID, name: 'NOFFF', color: '#0A84FF', state: 'idle', steps: [] },
  ];
  const header = buildHeader({
    setView: () => {},
    setFocus: () => {},
    blip: () => {},
  });
  header.sync();
  assert.ok(header.el.innerHTML.includes('NOFFF') || header.el.querySelector('.agent-tab'));
});
```

- [ ] **Step 2: Run test and verify**
Run `node --import ./tests/setup.mjs --test "tests/nofff-ui.test.mjs"`.

- [ ] **Step 3: Update `windows/src/views/views.ts` and `windows/src/style.css`**
- In `syncAgentTabs`: add `.iphone-tab` class when `task.id === MESSAGES_ID` for subtle iOS blue hover and active glow.
- Add `.notif-badge.phone` and `.msg-card-head` styling polish in `windows/src/style.css`.

- [ ] **Step 4: Verify test suite and TypeScript build**
Run:
`npx tsc --noEmit && npx vite build && npm test`
Ensure all tests (410+ tests) pass with exit code 0.

- [ ] **Step 5: Commit changes**
`git add windows/src/views/views.ts windows/src/style.css windows/tests/nofff-ui.test.mjs && git commit -m "feat(island): bind NOFFF mini Mochi tab and polish styling"`

---

### Task 4: Version Bump, Release Build, and Deploy

**Files:**
- Modify: `windows/package.json`
- Modify: `windows/src-tauri/tauri.conf.json`
- Modify: `windows/Cargo.toml`
- Modify: `windows/Cargo.lock`

- [ ] **Step 1: Bump version to 0.6.15 across all manifests**
- [ ] **Step 2: Commit and push tag `windows-v0.6.15`**
- [ ] **Step 3: Run `wait-and-download-release.mjs windows-v0.6.15`**
- [ ] **Step 4: Confirm Coucou process is running with fresh PID**
