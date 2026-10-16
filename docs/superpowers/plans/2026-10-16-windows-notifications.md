# Windows Toast Notification Interceptor Implementation Plan (v0.6.0)

> **Goal:** Intercept Windows system notifications in real-time using `UserNotificationListener` and display them in Coucou's dynamic island notch at the top of the screen as auto-popup message banners.

---

### Step 1: Rust Backend (`src-tauri/src/notifications.rs` & `Cargo.toml`)
1. Enable `UI_Notifications`, `UI_Notifications_Management`, `ApplicationModel` in `Cargo.toml` under `windows = { ... }`.
2. Implement `notifications::setup(&AppHandle)`:
   - Request access via `UserNotificationListener::Current()`.
   - Poll / listen for Toast notifications.
   - Extract `app_name`, `title`, `body`, and `timestamp_ms`.
   - Emit `windows-notification` event to Tauri webview.

### Step 2: Frontend Core (`src/core/notifications.ts`)
1. Listen for `windows-notification` event from Tauri.
2. Maintain notification ring buffer `notificationHistory` (up to 30 items).
3. Set active notification banner with 6-second auto-dismiss timeout.

### Step 3: Dynamic Island Banner UI (`src/island/island.ts` & `src/style.css`)
1. Add `#notif-banner` container inside `#island`.
2. Animate expansion when `activeNotifBanner != null`.
3. Support clicking to dismiss or open.
4. Auto-restore notch size after dismiss.
