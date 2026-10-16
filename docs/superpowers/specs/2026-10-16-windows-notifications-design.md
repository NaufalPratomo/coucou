# Windows Toast Notification Interceptor & Coucou Notch Messages Design

- **Date:** 2026-10-16
- **Target App:** Coucou Windows (`NaufalPratomo/coucou`)
- **Target Version:** `v0.6.0`
- **Status:** Approved / In Development

---

## 1. Overview & Problem Statement
In Windows, toast notifications appear in the bottom-right corner of the screen by default. This often distracts users during focused coding/work sessions or gets overlooked. Furthermore, users running Coucou want incoming client messages (from WhatsApp, Telegram, Slack, Comet/Chrome, Discord, Mail) to pop up directly at the top of their screen inside the Coucou Dynamic Island / Notch, so no client messages are ever missed.

---

## 2. Architecture & Components

### 2.1 Backend: Windows Toast Interceptor (`src-tauri/src/notifications.rs`)
- Uses Windows Runtime (`WinRT`) API:
  - `Windows.UI.Notifications.Management.UserNotificationListener`
  - `Windows.UI.Notifications.NotificationKinds::Toast`
- **Access Check:** Verified working on target system (`GetAccessStatus() == Allowed`).
- **Data Extracted:**
  - `id`: Notification ID
  - `app_name`: Display name of the application (e.g. "WhatsApp", "Antigravity IDE", "Slack", "Comet")
  - `title`: Sender or notification title
  - `body`: Text content of the message
  - `timestamp_ms`: Unix timestamp in milliseconds
- **Event Emission:**
  - Emits `windows-notification` event to Tauri webview whenever a new toast arrives.

### 2.2 Frontend Core (`src/core/notifications.ts`)
- Manages an in-memory ring buffer of the latest 30 notifications.
- Emits notification alerts to the Island controller.
- Deduplicates notifications by `id` and content hash.

### 2.3 UI: Coucou Notch Auto-Popup & Messages List
1. **Dynamic Notch Banner (Compact & Expanded):**
   - When a new notification arrives:
     - The Notch gently expands with a smooth spring animation:
       `[ (••) [AppName] Sender: "Message snippet..." ]`
     - Mochi turns his head, blinks, and displays a friendly greeting or alert emote.
     - Auto-folds back after 6 seconds if untouched.
     - Click on the banner opens/focuses the notification or expands the details.
2. **Mini Mochi Header Integration:**
   - Active message count badge on the header.
   - Allows user to see the recent client messages timeline in full view.

---

## 3. Disabling Default Windows Bottom-Right Popups
Users can easily turn off default bottom-right toast banners in:
`Windows Settings > System > Notifications` (or by enabling Focus Assist), allowing Coucou to become the exclusive, distraction-free notification center at the top of the screen.
