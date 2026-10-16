# Full View Layout, Mini Mochi Agent Bar & Synced Lyrics Design

- **Date:** 2026-10-16
- **Target App:** Coucou Windows (`NaufalPratomo/coucou`)
- **Status:** Approved by User

---

## 1. Overview & Goals
Transform the Coucou Windows desktop notch companion from its standard split-column layout into a modern **Full View** layout with a **Mini Mochi Agent Bar** in the header and **Synced Lyrics** (real-time scrolling karaoke lyrics) supporting both **MusicGit** (custom local player) and **Comet browser** (YouTube / YouTube Music / Spotify Web).

---

## 2. Key Features & Architecture

### 2.1 Header Tab Bar (Mini Mochi Agent Bar)
- **Problem:** In standard Coucou, active agents take up 50% of the screen in a crowded 2x2 grid on the right, constraining the main card content.
- **Solution:** 
  - Move active agent and integration pills (`State.tasks`) into the top header bar (`#header .tabs`).
  - **Inactive agents:** Rendered as compact 20px circular mini Mochi icons `(••)` showing their unique agent colors (Antigravity purple, Gemini blue, Google AI, GitHub red, Music green).
  - **Active/Selected agent:** Smoothly expands horizontally into a pill `[ • Name ]` with rounded border and subtle glow.
  - Clicking any mini Mochi immediately updates `State.focusTask` to switch the full card view.

### 2.2 Full-Width Overview Card (Full View)
- Remove the separate right-hand grid column from `.view.overview`.
- Let `.left` expand to `width: 100%`, giving the selected agent, tool, or music player full horizontal space.
- Provides expansive room for rich content, task trackers, diffs, and synced lyrics.

### 2.3 Synced Lyrics Engine (LRCLIB + Dynamic Notch)
- **Source:** Free, open-source LRCLIB API (`https://lrclib.net/api/get?track_name=<title>&artist_name=<artist>`), with automatic fallback to local `.lrc` if present.
- **Parsing:** Parses LRC timestamp strings `[mm:ss.xx] Line text` into an indexed timeline `Array<{ time: number, text: string }>`.
- **Playback Sync:** Synchronized with `spotifyPosition(s, Date.now())` on every animation tick.
- **Two Display Modes:**
  1. **Compact Notch Mode (Top Bar):**
     - When notch is collapsed and music is playing:
       - Mini Mochi dances with headphones on the left.
       - The current active singing line displays on the right side of the notch with smooth crossfade animations.
       - Falls back to `Title - Artist` during instrumental breaks or if lyrics are unavailable.
  2. **Expanded Card Mode (Full View):**
     - Left side: Album artwork + Dancing Mochi + Title/Artist + Play/Pause/Prev/Next controls + progress bar.
     - Right side: Synced lyrics list showing past, current, and upcoming lines. Current line is bold white with glow; past and future lines are dimmed. Clicking any lyric line seeks playback to that point.

---

## 3. Implementation Plan
1. **Frontend Core (`windows/src/core/spotify.ts` & `lyrics.ts`):**
   - Add LRCLIB lyrics fetching and LRC parser.
   - Cache lyrics in memory by `track.title + track.artist`.
   - Add helper `currentLyricLine(position): string`.
2. **Header Bar (`windows/src/views/views.ts`):**
   - Inject mini Mochi pills for `State.tasks` into the header bar.
   - Highlight active pill and expand its label.
3. **Full View Overview (`windows/src/views/views.ts` & `style.css`):**
   - Make `.view.overview` single-column full-width.
   - Update `.view.overview .left` to `flex: 1` and `width: 100%`.
4. **Music View with Lyrics (`windows/src/views/spotify.ts`):**
   - Add the two-column music layout inside the expanded card (Player on left, Synced Lyrics on right).
5. **Compact Notch (`windows/src/island/island.ts`):**
   - Display the current active lyric line in compact island when music is playing.
6. **Bump version to v0.5.3**, push tag, and compile on GitHub Actions.
