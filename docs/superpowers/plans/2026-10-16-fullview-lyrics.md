# Full View Layout, Mini Mochi Agent Bar & Synced Lyrics Implementation Plan

> **Goal:** Transform Coucou Windows into a full-view experience with mini Mochi agent icons in the header and real-time synced lyrics for MusicGit and Comet.
> **Target Version:** `0.5.3`

---

### Task 1: Create Lyrics Engine (`windows/src/core/lyrics.ts`)
- **Action:** Create `windows/src/core/lyrics.ts` containing:
  - `ParsedLyric` interface: `{ time: number; text: string }`.
  - `parseLRC(lrcText: string): ParsedLyric[]`.
  - `fetchLRCLyrics(title: string, artist: string, duration?: number): Promise<ParsedLyric[] | null>`.
  - LRCLIB API query: `https://lrclib.net/api/get?track_name=${title}&artist_name=${artist}`.
  - In-memory cache by `cleanKey(title, artist)`.
  - `getActiveLyricIndex(lyrics: ParsedLyric[], currentSec: number): number`.

### Task 2: Build Mini Mochi Agent Bar in Header (`windows/src/views/views.ts`)
- **Action:** In `buildHeader`:
  - Iterate `State.tasks` (active integrations & agents like Antigravity, Gemini, MusicGit, GitHub).
  - Create a mini Mochi pill container `#header .agent-tabs`.
  - For each task:
    - Inactive: 20px round button with mini Mochi bot `createMiniBot(task, 16)`.
    - Active (`task.id === State.focusTask?.id`): Expands with label `[ • Name ]`.
    - On click: calls `actions.setFocus(task.id)` and `actions.setView("overview")`.

### Task 3: Full-Width Overview Layout (`windows/src/views/views.ts` & `windows/src/style.css`)
- **Action:** 
  - In `buildOverview`: Remove/hide the right 2x2 pills column (`.right`) since all pills are now accessible in the header.
  - In `style.css`: Set `.view.overview` and `.view.overview .left` to `width: 100%`, `max-width: 100%`, `flex: 1`.
  - Style `.agent-tabs` in header with smooth CSS transitions.

### Task 4: Dual-Column Music Card with Synced Lyrics (`windows/src/views/spotify.ts` & `style.css`)
- **Action:**
  - Update `buildSpotifyCard`:
    - Layout: Left column (Cover art, metadata, controls, progress bar), Right column (Lyrics box).
    - Render lyrics container with `.lyrics-container` and `.lyric-line`.
    - Active line gets `.active` class (bold white + glow).
    - Smooth auto-scroll to keep active line centered.
    - Click lyric line: triggers `seek(line.time)`!

### Task 5: Synced Lyrics in Compact Notch Mode (`windows/src/island/island.ts` & `windows/src/island/spotify.ts`)
- **Action:**
  - In `syncPillName`: When music is playing and lyrics are available for the current timestamp, display the current active lyric line as the notch label.
  - When instrumental or no lyrics: show `Track Title`.

### Task 6: Test Locally with npm run build / typecheck, Bump Version to 0.5.3 & Push Tag
- **Action:**
  - Run TypeScript compile check in `windows`.
  - Bump version to `0.5.3` in `Cargo.toml`, `package.json`, and `tauri.conf.json`.
  - Commit, tag `windows-v0.5.3`, and push to GitHub.
  - Monitor GitHub Actions build, download, and install.
