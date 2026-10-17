import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("companion.html and companion scripts contain zero unicode emojis", () => {
  const files = [
    "companion.html",
    "src/companion/main.ts",
    "src/companion/ws.ts",
    "src/companion/components/MusicPlayer.ts",
    "src/companion/components/KaraokeLyrics.ts",
    "src/companion/components/RemoteChat.ts",
    "src/companion/components/AntigravityCard.ts",
    "src/companion/components/MochiCanvas.ts",
  ];

  // Regex detecting common emojis including lightning bolt ⚡ and miscellaneous symbols
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

  for (const f of files) {
    const content = readFileSync(resolve(process.cwd(), f), "utf8");
    const match = content.match(emojiRegex);
    assert.strictEqual(
      match,
      null,
      `File ${f} must not contain unicode emoji, found: ${match ? match[0] : ""}`
    );
  }
});

test("companion.html has vector SVG battery indicator elements", () => {
  const html = readFileSync(resolve(process.cwd(), "companion.html"), "utf8");
  assert.ok(html.includes('id="battery-indicator"'), "must have battery indicator container");
  assert.ok(html.includes('id="battery-level"'), "must have battery level text span");
  assert.ok(html.includes('id="battery-icon"'), "must have vector battery SVG icon");
  assert.ok(html.includes('id="battery-fill"'), "must have dynamic battery fill rect");
  assert.ok(html.includes('id="battery-bolt"'), "must have vector SVG charging bolt");
});

test("companion.html has track seek scrubber and volume slider", () => {
  const html = readFileSync(resolve(process.cwd(), "companion.html"), "utf8");
  assert.ok(html.includes('id="track-scrubber"'), "must have track seek range input");
  assert.ok(html.includes('id="time-current"'), "must have elapsed time label");
  assert.ok(html.includes('id="time-duration"'), "must have total duration label");
  assert.ok(html.includes('id="volume-slider"'), "must have volume range input");
  assert.ok(html.includes('id="btn-mute"'), "must have mute button");
  assert.ok(html.includes('id="volume-icon"'), "must have vector speaker volume icon");
});

test("companion.html has spacious remote chat layout and mode pills", () => {
  const html = readFileSync(resolve(process.cwd(), "companion.html"), "utf8");
  assert.ok(html.includes('id="tab-chat"'), "must have remote chat tab");
  assert.ok(html.includes('id="chat-messages"'), "must have message thread container");
  assert.ok(html.includes('chat-input-bar'), "must have chat input bar with safe area padding");
  assert.ok(html.includes('id="chat-input"'), "must have chat text input");
  assert.ok(html.includes('id="btn-chat-send"'), "must have send button");
  assert.ok(html.includes('id="btn-mode-ai"'), "must have Ask AI mode button");
  assert.ok(html.includes('id="btn-mode-clip"'), "must have Copy to PC mode button");
});
