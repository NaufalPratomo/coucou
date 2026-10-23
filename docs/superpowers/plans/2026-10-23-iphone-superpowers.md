# iPhone Superpowers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement real-time iPhone battery percentage & dynamic icon, proximity & connection status, app category filtering, low-battery warning alerts, and Coucou Web Companion pairing QR for the NOFFF iPhone Mochi.

**Architecture:** A native Windows `cfgmgr32.dll` background poller in Tauri/Rust reads `DEVPKEY_Device_BatteryPercentage` and `DEVPKEY_Device_IsConnected` without spawning external processes. Events stream to the TypeScript frontend where State, Island pill, and Card view update with dynamic vector SVG battery indicators, category filters, and companion pairing.

**Tech Stack:** Rust (Tauri 2, Win32 cfgmgr32), TypeScript, Vite, Node test runner (`node --test`).

## Global Constraints

- Strictly zero unicode emojis (vector SVGs only).
- Do not break existing Laptop Messages Mochi (`integration_messages`) or NOFFF iPhone Mochi (`integration_phone`).
- All existing tests in `windows/` (415+ tests) must pass.
- Clean code with no heavy external dependencies.

---

### Task 1: Backend Native BLE Battery & Proximity Poller

**Files:**
- Create: `windows/src-tauri/src/phone_battery.rs`
- Modify: `windows/src-tauri/src/lib.rs`
- Test: `windows/src-tauri/src/phone_battery.rs` (internal unit tests)

**Interfaces:**
- Produces Tauri event: `"phone-battery"` with payload `{"device_id": String, "level": u8, "connected": bool}`
- Produces Tauri command: `get_phone_battery() -> Option<PhoneBatteryInfo>`

- [ ] **Step 1: Write `phone_battery.rs` module with native `cfgmgr32` bindings**
  Implement `read_battery_status()` and `start_poller()`.
- [ ] **Step 2: Register module and Tauri command in `windows/src-tauri/src/lib.rs`**
  Add `pub mod phone_battery;` and invoke `phone_battery::setup(&handle);` in Tauri setup.
- [ ] **Step 3: Verify Rust compilation**
  Run `cargo check -p coucou` in `windows/` to verify zero compiler errors.

---

### Task 2: Dynamic Vector Battery SVG and Category Classifier

**Files:**
- Modify: `windows/src/views/icons.ts`
- Modify: `windows/src/core/notifications.ts`
- Create: `windows/tests/battery-and-categories.test.mjs`

**Interfaces:**
- Consumes: Notification item and app name.
- Produces: `batteryIcon(level: number, connected: boolean, size?: number): SVGElement`
- Produces: `classifyNotificationCategory(appName: string, title?: string): "chat" | "shop" | "mail" | "other"`

- [ ] **Step 1: Write the failing unit tests for battery icon and category classifier**
  Test SVG element structure, fill percentage clamping, color codes (>40% green, 21-40% yellow, <=20% red), and app classifications (WhatsApp -> chat, Tokopedia -> shop, Gmail -> mail).
- [ ] **Step 2: Implement `batteryIcon` in `windows/src/views/icons.ts`**
- [ ] **Step 3: Implement `classifyNotificationCategory` in `windows/src/core/notifications.ts`**
- [ ] **Step 4: Run tests to verify all tests pass**
  Run `node --test windows/tests/battery-and-categories.test.mjs`.

---

### Task 3: Core Battery State & Low-Battery Alert Monitoring

**Files:**
- Create: `windows/src/core/battery.ts`
- Modify: `windows/src/core/state.ts`
- Test: `windows/tests/battery-state.test.mjs`

**Interfaces:**
- Consumes: Tauri event `"phone-battery"`
- Produces: `State.phoneBattery` updated live.
- Produces: Low-battery trigger on `integration_phone` (emote: `"worried"`, active island alert banner when level <= 20).

- [ ] **Step 1: Write unit tests for battery state updates and low-battery triggers**
- [ ] **Step 2: Implement `windows/src/core/battery.ts` with `initBatteryMonitoring()`**
- [ ] **Step 3: Add `phoneBattery` to `State` in `windows/src/core/state.ts`**
- [ ] **Step 4: Run tests and verify zero regressions**

---

### Task 4: UI Pill & Header with Live Battery Percentage

**Files:**
- Modify: `windows/src/views/messages.ts`
- Modify: `windows/src/views/views.ts`
- Modify: `windows/tests/messages-card.test.mjs`
- Modify: `windows/tests/nofff-ui.test.mjs`

**Interfaces:**
- Consumes: `State.phoneBattery`
- Produces: Dynamic Island header pill displaying `NOFFF` with battery percentage badge and dynamic vector battery icon.

- [ ] **Step 1: Update `buildMessagesPill` in `windows/src/views/messages.ts`**
  When `taskId === "integration_phone"` and `State.phoneBattery` is present:
  If connected: show battery icon + `${level}%`.
  If disconnected: show muted disconnected badge.
- [ ] **Step 2: Update header tab rendering in `windows/src/views/views.ts`**
  Ensure Island header pill displays battery badge when NOFFF is active.
- [ ] **Step 3: Run existing and updated tests**
  Run `node --test windows/tests/nofff-ui.test.mjs`.

---

### Task 5: UI Card Enhancement with Proximity Status, Category Filter Chips, and Web Companion Pairing QR Modal

**Files:**
- Modify: `windows/src/views/messages.ts`
- Modify: `windows/src/style.css`
- Modify: `windows/tests/messages-card.test.mjs`

**Interfaces:**
- Consumes: `get_companion_pairing` Tauri command.
- Produces:
  1. Card header with live proximity dot (green connected, gray disconnected) and battery badge.
  2. Category filter chip bar ("All", "Chat", "Shop", "Mail") with badge counters.
  3. "Pair iPhone" action button opening QR Code overlay modal with companion URL.

- [ ] **Step 1: Write tests for category filtering in messages card**
- [ ] **Step 2: Add category filter chips and state to `buildMessagesCard`**
- [ ] **Step 3: Add Web Companion Pairing button & QR modal to `buildMessagesCard`**
- [ ] **Step 4: Add styling for filter chips, battery badge, and companion QR modal in `windows/src/style.css`**
- [ ] **Step 5: Run tests to verify all pass**

---

### Task 6: Full Verification, TypeScript Compilation & Test Suite Execution

**Files:**
- All modified files

- [ ] **Step 1: Run TypeScript typechecker**
  `cd windows && npx tsc --noEmit`
- [ ] **Step 2: Run all unit tests**
  `cd windows && npm test`
- [ ] **Step 3: Build release binary or verify cargo build**
  `cargo check --manifest-path windows/Cargo.toml`
