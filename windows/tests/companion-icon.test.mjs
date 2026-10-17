import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("companion.html includes apple-touch-icon and icon link tags for iOS PWA", () => {
  const html = readFileSync(resolve(process.cwd(), "companion.html"), "utf8");
  assert.ok(
    html.includes('<link rel="apple-touch-icon" sizes="180x180" href="/icon.png">'),
    "must include apple-touch-icon link tag"
  );
  assert.ok(
    html.includes('<link rel="icon" type="image/png" href="/icon.png">'),
    "must include icon link tag"
  );
});

test("manifest.json defines /icon.png with 512x512 and maskable entries", () => {
  const manifestRaw = readFileSync(resolve(process.cwd(), "src/companion/manifest.json"), "utf8");
  const manifest = JSON.parse(manifestRaw);
  assert.ok(Array.isArray(manifest.icons), "manifest must have icons array");
  
  const standardIcon = manifest.icons.find(i => i.src === "/icon.png" && i.sizes === "512x512");
  assert.ok(standardIcon, "manifest must contain standard 512x512 /icon.png");
  
  const maskableIcon = manifest.icons.find(i => i.src === "/icon.png" && i.purpose === "maskable");
  assert.ok(maskableIcon, "manifest must contain maskable /icon.png");
});
