# Coucou iPhone Web Companion (PWA) — Design Specification

**Date:** 2026-10-17  
**Status:** Approved  
**Author:** Antigravity Pair Programming Team  
**Scope:** Coucou Desktop (Windows) & iOS Mobile Companion (PWA)

---

## 1. Executive Summary

Coucou currently supports Windows with a desktop floating Dynamic Island and has an Android companion app. However, iOS users cannot use the Android app, and building a native iOS app requires macOS and Apple CloudKit sync.

This specification defines the architecture, user experience, and technical implementation for the **Coucou iPhone Web Companion (PWA)**:
* **Pure Local Architecture:** 100% self-hosted inside `coucou.exe` (embedded HTTP + WebSocket server). No external 24/7 cloud server, no VPS, no paid services, no tunneling required.
* **Zero Re-scan Network Mobility:** Uses local mDNS (`http://coucou.local:47822`) and persistent token in iOS Safari `localStorage`, allowing seamless transitions between home, kos, and office Wi-Fi networks without re-scanning QR codes.
* **Dynamic Island OLED Interface:** Fullscreen iOS PWA experience tailored for iPhone OLED displays (`#000000`), haptic feedback, and fluid transitions.
* **Core Capabilities:**
  1. **Remote Music Controller & Live Karaoke Lyrics:** Real-time track progress, album art, playback controls, and auto-scrolling synchronized lyrics with active line highlighting.
  2. **Antigravity Agent Monitor & Interactive Approval:** Live status of active agent runs, terminal outputs, and instant mobile `Allow (y)` / `Deny (n)` actions.
  3. **Mochi Animated Companion:** Canvas-based interactive Mochi avatar reflecting laptop state, battery, and agent mood.
  4. **System Metrics & Battery Indicator:** Quick overview of laptop battery, charging state, and resource load.

---

## 2. Architecture & Networking

```
+-------------------------------------------------------------------------+
|                              Windows PC                                 |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |                            Coucou.exe                             |  |
|  |                                                                   |  |
|  |  +--------------------+   +-------------------+   +------------+  |  |
|  |  |  Windows Media     |   |   Antigravity     |   |  System    |  |  |
|  |  |  Session Manager   |   |   Hook / API      |   |  Battery   |  |  |
|  |  +---------+----------+   +---------+---------+   +-----+------+  |  |
|  |            |                        |                   |         |  |
|  |            +-------------------+----+-------------------+         |  |
|  |                                |                                  |  |
|  |                    +-----------v------------+                     |  |
|  |                    | Web Companion Server   |                     |  |
|  |                    | (Embedded Rust / Axum) |                     |  |
|  |                    | Port: 47822            |                     |  |
|  |                    +-----------+------------+                     |  |
|  |                                |                                  |  |
|  |                    +-----------v------------+                     |  |
|  |                    |    mDNS Responder      |                     |  |
|  |                    |   (coucou.local)       |                     |  |
|  +--------------------+-----------+------------+---------------------+  |
+-----------------------------------|-------------------------------------+
                                    |
                 Wi-Fi Local Network (Zero Tunneling)
              WebSockets (< 5ms latency) + HTTP Static
                                    |
+-----------------------------------|-------------------------------------+
|                                   v                                     |
|                       iPhone (iOS Safari PWA)                           |
|                    http://coucou.local:47822                            |
|                                                                         |
|   +-----------------------------------------------------------------+   |
|   |                    Dynamic Island OLED Shell                    |   |
|   |                                                                 |   |
|   |  [ Tab 1: Mochi Island ]  [ Tab 2: Music ]  [ Tab 3: Antigrav ] |   |
|   |                                                                 |   |
|   |  * Karaoke Synchronized Scrolling Lyrics                        |   |
|   |  * Antigravity Allow / Deny Remote Controls                     |   |
|   |  * Haptic Feedback & Offline Cache (Service Worker)             |   |
|   +-----------------------------------------------------------------+   |
+-------------------------------------------------------------------------+
```

### 2.1 Embedded Server in `coucou.exe`
* A lightweight HTTP static server and WebSocket server running inside the Rust Tauri backend (`port 47822`).
* When `Coucou` starts on Windows, the web server starts automatically. When `Coucou` closes or the PC goes to sleep, the server shuts down gracefully.
* Serves the pre-bundled PWA assets (HTML, CSS, JS, manifest, app icons) instantly.

### 2.2 Local mDNS Discovery (`coucou.local`)
* The Windows host advertises `coucou.local` via mDNS.
* iOS Safari natively resolves `.local` Bonjour hostnames on the local Wi-Fi.
* The iPhone accesses `http://coucou.local:47822` without needing to look up fluctuating DHCP IP addresses.
* **Fallback mechanism:** If a corporate router blocks mDNS multicast packets, the PWA settings page allows entering the numeric IP directly with one tap, and remembers it.

### 2.3 Pairing & Security
1. **One-Time Pairing:**
   * Coucou Windows Settings tab displays a QR code containing `http://coucou.local:47822?token=<PAIRING_SECRET>`.
   * Scanning with iPhone Camera opens the Web Companion in Safari.
   * User taps **"Share" ➡️ "Add to Home Screen"**.
2. **Persistent Session:**
   * The pairing token is permanently stored in Safari's `localStorage`.
   * When shifting between Kos, Home, or Office Wi-Fi, the iPhone launches the PWA, resolves `coucou.local`, sends the stored token in the WebSocket handshake header, and immediately connects with zero prompt.

---

## 3. User Interface & Experience (iOS PWA)

### 3.1 Design Language
* **Canvas:** Pure Pitch Black (`#000000`) optimized for iPhone OLED Super Retina displays.
* **Surface Hierarchy:**
  * Background: `#000000`
  * Island / Pill Surfaces: `#121214` with subtle `rgba(255, 255, 255, 0.08)` border
  * Elevated Cards: `#1c1c1e`
  * Accents: iOS System Green (`#30d158`), System Blue (`#0a84ff`), System Red (`#ff453a`), System Yellow (`#ffd60a`)
* **Typography:** Apple SF Pro Display / SF Pro Text system fonts.
* **Haptics:** Uses `navigator.vibrate` / Web Haptics on interactive taps (Allow, Deny, Play/Pause, Next Track).

### 3.2 Screens & Tabs

#### Tab 1: Dynamic Island & Mochi
* **Dynamic Island Capsule:** Centered at the top mimicking the native iOS Dynamic Island.
* **Mochi Avatar:** Interactive canvas rendered Mochi cat/creature reacting with smooth physics:
  * *Idle:* Breathing and looking around.
  * *Music playing:* Bobs head to the beat.
  * *Agent active:* Typing on a tiny holographic laptop or wearing thinking glasses.
  * *Battery low:* Sleepy animation.
* **Quick Stats:** Laptop battery percentage, charging lightning indicator, CPU load pill.

#### Tab 2: Remote Music Controller & Karaoke Lyrics
* **Media Header:** High-res album art with soft blurred ambient glow behind it.
* **Track Info:** Title, artist, album name, and media source pill (Spotify / Apple Music / Browser).
* **Playback Controls:** Previous, Play/Pause (large circular button), Next, Volume Slider, and Track Scrubber.
* **Live Karaoke Lyrics:**
  * Parses synchronized LRC timestamps.
  * Auto-scrolls smoothly to keep the current singing line centered in view.
  * Active line is highlighted in crisp high-contrast white text (`#ffffff`), while past and upcoming lines fade with soft opacity (`0.35`).
  * Tapping any lyric line seeks playback to that exact timestamp on the laptop.

#### Tab 3: Antigravity Agent Controller
* **Session Status:** Displays current model tier (`flash`, `pro`), active execution status (`Idle`, `Running`, `Thinking`, `Waiting for Confirmation`).
* **Active Goal / Prompt Card:** Shows the high-level objective and the active step currently running on the laptop.
* **Remote Decision Card:**
  * When Antigravity requests bash execution or file modification approval, a prominent card appears on the iPhone with an alert sound/vibration:
  * **[Allow (y)]** (Vibrant Green button, large tap target)
  * **[Deny (n)]** (Vibrant Red button)
  * Instantly sends input back to the PC agent session.

---

## 4. WebSocket Protocol Specifications

All real-time communication between `coucou.exe` and the iPhone PWA occurs over `ws://coucou.local:47822/ws?token=<TOKEN>`.

### 4.1 Messages: Server ➡️ iPhone (Outbound)

#### 1. Full State Sync (`sync:state`)
Sent upon initial connection and reconnection:
```json
{
  "type": "sync:state",
  "payload": {
    "media": {
      "isPlaying": true,
      "title": "Song Title",
      "artist": "Artist Name",
      "albumArt": "data:image/jpeg;base64,...",
      "durationMs": 210000,
      "positionMs": 45000,
      "lyrics": [
        { "timeMs": 42000, "text": "First lyric line" },
        { "timeMs": 45000, "text": "Active singing lyric line" }
      ]
    },
    "antigravity": {
      "status": "waiting_confirmation",
      "activeGoal": "Implement iPhone PWA companion",
      "currentTool": "run_command",
      "confirmationPrompt": "Run: cargo build --release?"
    },
    "system": {
      "batteryLevel": 88,
      "isCharging": true,
      "cpuPercent": 14
    }
  }
}
```

#### 2. Media Progress Tick (`media:tick`)
Broadcast every 1000ms during playback to minimize bandwidth:
```json
{
  "type": "media:tick",
  "payload": { "positionMs": 46000 }
}
```

#### 3. Agent Confirmation Request (`agent:confirm_request`)
Triggered when Antigravity halts for user input:
```json
{
  "type": "agent:confirm_request",
  "payload": {
    "id": "req-1024",
    "prompt": "Allow running 'git push origin main'?",
    "options": ["y", "n"]
  }
}
```

### 4.2 Messages: iPhone ➡️ Server (Inbound)

#### 1. Media Control (`media:action`)
```json
{
  "type": "media:action",
  "payload": {
    "action": "play" | "pause" | "next" | "prev" | "seek" | "volume",
    "value": 45000
  }
}
```

#### 2. Agent Decision (`agent:decision`)
```json
{
  "type": "agent:decision",
  "payload": {
    "requestId": "req-1024",
    "choice": "y" | "n"
  }
}
```

---

## 5. Implementation Phases

1. **Phase 1: Rust Web Server & WebSocket Engine**
   * Integrate Axum / embedded HTTP & WebSocket server inside `src-tauri` on port `47822`.
   * Implement Windows mDNS responder for `coucou.local`.
   * Add pairing token generation and verification logic.

2. **Phase 2: iPhone PWA Frontend Bundle**
   * Build modern, lightweight PWA in `frontend/pwa` using Vite + React + Tailwind CSS (pitch black OLED theme).
   * Implement Web App Manifest (`standalone`, dark status bar, icons).
   * WebSocket client with auto-reconnect and `localStorage` token preservation.

3. **Phase 3: Media & Karaoke Lyrics Integration**
   * Connect Windows SMTC (System Media Transport Controls) state to the PWA.
   * Implement smooth auto-scrolling lyric list with active line tracking.
   * Add remote Play/Pause/Skip/Seek touch controls.

4. **Phase 4: Antigravity Controller & System Health**
   * Wire Antigravity CLI status hooks to broadcast to the PWA.
   * Build interactive Allow/Deny confirmation banner on iPhone.
   * Display live laptop battery and Mochi mood animation.

5. **Phase 5: Verification & End-to-End Testing**
   * Test pairing via QR code.
   * Test network transition (disconnect Wi-Fi, reconnect, verify auto-reconnect without re-scan).
   * Test music control & karaoke sync accuracy.
