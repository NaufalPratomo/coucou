// Coucou Web Companion — Real-time PC Hardware Telemetry Card
// Strictly Zero Unicode Emojis — pure vector SVGs

import type { CompanionClient, PcStats } from "../ws";

export function formatUptime(uptimeSecs: number): string {
  if (uptimeSecs <= 0) return "0s";
  const days = Math.floor(uptimeSecs / 86400);
  const hours = Math.floor((uptimeSecs % 86400) / 3600);
  const mins = Math.floor((uptimeSecs % 3600) / 60);
  const secs = Math.floor(uptimeSecs % 60);

  if (days > 0) {
    return `${days}d ${hours}h ${mins}m`;
  }
  if (hours > 0) {
    return `${hours}h ${mins}m ${secs}s`;
  }
  return `${mins}m ${secs}s`;
}

export function getMetricColor(pct: number): { text: string; bg: string; border: string } {
  if (pct >= 85) {
    return { text: "text-rose-400", bg: "bg-rose-500", border: "border-rose-500/40" };
  }
  if (pct >= 70) {
    return { text: "text-amber-400", bg: "bg-amber-400", border: "border-amber-400/40" };
  }
  return { text: "text-emerald-400", bg: "bg-emerald-400", border: "border-emerald-500/30" };
}

export function setupPcStatsCard(_client: CompanionClient) {
  const cpuPercentEl = document.getElementById("stats-cpu-pct");
  const cpuBarEl = document.getElementById("stats-cpu-bar");
  const cpuTempEl = document.getElementById("stats-cpu-temp");
  const cpuTempBadge = document.getElementById("stats-cpu-temp-badge");

  const gpuPercentEl = document.getElementById("stats-gpu-pct");
  const gpuBarEl = document.getElementById("stats-gpu-bar");
  const gpuTempEl = document.getElementById("stats-gpu-temp");
  const gpuNameEl = document.getElementById("stats-gpu-name");
  const gpuTempBadge = document.getElementById("stats-gpu-temp-badge");

  const ramUsedEl = document.getElementById("stats-ram-used");
  const ramTotalEl = document.getElementById("stats-ram-total");
  const ramPercentEl = document.getElementById("stats-ram-pct");
  const ramBarEl = document.getElementById("stats-ram-bar");

  const uptimeEl = document.getElementById("stats-uptime");
  const powerEl = document.getElementById("stats-power");
  const powerStatusEl = document.getElementById("stats-power-status");

  return {
    update(stats?: PcStats) {
      if (!stats) return;

      // 1. CPU
      const cpuPct = Math.max(0, Math.min(100, stats.cpuPercent));
      const cpuCol = getMetricColor(cpuPct);
      if (cpuPercentEl) {
        cpuPercentEl.textContent = `${cpuPct.toFixed(1)}%`;
        cpuPercentEl.className = `text-2xl font-bold font-mono tabular-nums ${cpuCol.text}`;
      }
      if (cpuBarEl) {
        cpuBarEl.style.width = `${cpuPct}%`;
        cpuBarEl.className = `stats-bar-fill h-full transition-all duration-300 rounded-full ${cpuCol.bg}`;
      }
      if (cpuTempEl && cpuTempBadge) {
        if (typeof stats.cpuTemp === "number" && stats.cpuTemp > 0) {
          cpuTempEl.textContent = `${stats.cpuTemp.toFixed(1)}°C`;
          cpuTempBadge.classList.remove("hidden");
          if (stats.cpuTemp >= 85) {
            cpuTempBadge.className = "flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30";
          } else if (stats.cpuTemp >= 75) {
            cpuTempBadge.className = "flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-amber-400/20 text-amber-400 border border-amber-400/30";
          } else {
            cpuTempBadge.className = "flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700";
          }
        } else {
          cpuTempBadge.classList.add("hidden");
        }
      }

      // 2. GPU
      if (stats.gpuName && gpuNameEl) {
        gpuNameEl.textContent = stats.gpuName;
      }
      if (typeof stats.gpuPercent === "number") {
        const gpuPct = Math.max(0, Math.min(100, stats.gpuPercent));
        const gpuCol = getMetricColor(gpuPct);
        if (gpuPercentEl) {
          gpuPercentEl.textContent = `${gpuPct.toFixed(0)}%`;
          gpuPercentEl.className = `text-2xl font-bold font-mono tabular-nums ${gpuCol.text}`;
        }
        if (gpuBarEl) {
          gpuBarEl.style.width = `${gpuPct}%`;
          gpuBarEl.className = `stats-bar-fill h-full transition-all duration-300 rounded-full ${gpuCol.bg}`;
        }
      } else if (gpuPercentEl) {
        gpuPercentEl.textContent = "--%";
        if (gpuBarEl) gpuBarEl.style.width = "0%";
      }

      if (gpuTempEl && gpuTempBadge) {
        if (typeof stats.gpuTemp === "number" && stats.gpuTemp > 0) {
          gpuTempEl.textContent = `${stats.gpuTemp.toFixed(0)}°C`;
          gpuTempBadge.classList.remove("hidden");
          if (stats.gpuTemp >= 85) {
            gpuTempBadge.className = "flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30";
          } else if (stats.gpuTemp >= 75) {
            gpuTempBadge.className = "flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-amber-400/20 text-amber-400 border border-amber-400/30";
          } else {
            gpuTempBadge.className = "flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700";
          }
        } else {
          gpuTempBadge.classList.add("hidden");
        }
      }

      // 3. RAM
      const ramPct = Math.max(0, Math.min(100, stats.ramPercent));
      const ramCol = getMetricColor(ramPct);
      if (ramUsedEl) ramUsedEl.textContent = `${stats.ramUsedGb.toFixed(1)} GB`;
      if (ramTotalEl) ramTotalEl.textContent = `/ ${stats.ramTotalGb.toFixed(1)} GB`;
      if (ramPercentEl) {
        ramPercentEl.textContent = `${ramPct.toFixed(0)}%`;
        ramPercentEl.className = `text-2xl font-bold font-mono tabular-nums ${ramCol.text}`;
      }
      if (ramBarEl) {
        ramBarEl.style.width = `${ramPct}%`;
        ramBarEl.className = `stats-bar-fill h-full transition-all duration-300 rounded-full ${ramCol.bg}`;
      }

      // 4. System Uptime & Power
      if (uptimeEl) {
        uptimeEl.textContent = formatUptime(stats.uptimeSecs);
      }
      if (powerEl) {
        powerEl.textContent = `${stats.batteryPercent}%`;
      }
      if (powerStatusEl) {
        powerStatusEl.textContent = stats.isCharging ? "Charging (AC)" : "On Battery";
        powerStatusEl.className = stats.isCharging
          ? "text-[11px] font-mono font-semibold text-emerald-400"
          : "text-[11px] font-mono font-semibold text-neutral-400";
      }
    },
  };
}
