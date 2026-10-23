import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { pipeline } from 'node:stream/promises';

const TAG = process.argv[2] || 'windows-v0.6.11';
const VERSION = TAG.replace(/^windows-v/, '');
const ASSET_NAME = `Coucou-Windows-${VERSION}-setup.exe`;
const TARGET_PATH = path.resolve(process.cwd(), ASSET_NAME);

function getGitHubToken() {
  try {
    const creds = cp.execSync('git credential fill', {
      input: 'protocol=https\nhost=github.com\n',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).toString();
    const token = creds.split('\n').find(l => l.startsWith('password='))?.split('=')[1]?.trim();
    return token || null;
  } catch {
    return null;
  }
}

const token = getGitHubToken();
const headers = {
  'User-Agent': 'Node-Fetch',
  ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
};

async function checkRelease() {
  try {
    const res = await fetch(`https://api.github.com/repos/NaufalPratomo/coucou/releases/tags/${TAG}`, { headers });
    if (res.ok) {
      const data = await res.json();
      const asset = data.assets?.find(a => a.name === ASSET_NAME);
      if (asset) return asset;
    }
  } catch (err) {
    console.error('Error checking release:', err.message);
  }
  return null;
}

async function checkRuns() {
  try {
    const res = await fetch(`https://api.github.com/repos/NaufalPratomo/coucou/actions/runs?per_page=20`, { headers });
    if (res.ok) {
      const data = await res.json();
      const run = data.workflow_runs?.find(r => r.name === 'Windows' && r.head_branch === TAG);
      return run || null;
    }
  } catch (err) {
    console.error('Error checking runs:', err.message);
  }
  return null;
}

async function downloadAsset(url) {
  console.log(`Downloading ${ASSET_NAME} from ${url}...`);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to download: ${res.statusText}`);
  const fileStream = fs.createWriteStream(TARGET_PATH);
  await pipeline(res.body, fileStream);
  console.log(`Downloaded ${ASSET_NAME} (${fs.statSync(TARGET_PATH).size} bytes)`);
}

async function main() {
  console.log(`Monitoring GitHub Actions build for ${TAG} (${ASSET_NAME})...`);
  let attempts = 0;
  while (true) {
    attempts++;
    const asset = await checkRelease();
    if (asset) {
      console.log(`Release found! Asset: ${asset.name}`);
      await downloadAsset(asset.browser_download_url);
      console.log(`Stopping running coucou instance...`);
      try { cp.execSync("taskkill /F /IM coucou.exe /T 2>nul", { shell: "cmd.exe" }); } catch {}
      console.log(`Installing ${ASSET_NAME} silently (/S)...`);
      try {
        cp.execSync(`"${TARGET_PATH}" /S`, { stdio: 'inherit' });
        console.log('Installation completed successfully.');
        const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || 'C:\\Users\\Nof', 'AppData', 'Local');
        const exePath = path.join(localAppData, 'Coucou', 'coucou.exe');
        if (fs.existsSync(exePath)) {
          console.log(`Starting ${exePath}...`);
          cp.spawn(exePath, [], { detached: true, stdio: 'ignore' }).unref();
          console.log('Coucou launched successfully.');
        }
      } catch (err) {
        console.error('Installation error:', err.message);
      }
      process.exit(0);
    }

    const run = await checkRuns();
    if (run) {
      console.log(`[Attempt ${attempts}] Run ID: ${run.id}, status: ${run.status}, conclusion: ${run.conclusion}`);
      if (run.conclusion === 'failure' || run.conclusion === 'cancelled') {
        throw new Error(`Build finished with conclusion: ${run.conclusion}`);
      }
    } else {
      console.log(`[Attempt ${attempts}] Waiting for workflow run to start for ${TAG}...`);
    }

    await new Promise(r => setTimeout(r, 15000));
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
