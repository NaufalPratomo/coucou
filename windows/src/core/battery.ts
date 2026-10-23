import { onEvent, Bridge } from "./bridge";
import type { RawPhoneBatteryPayload } from "./bridge";
import { State } from "./state";
import { triggerLowBatteryBanner } from "./notifications";

export type { RawPhoneBatteryPayload };

let hasWarnedLowBattery = false;

export function handlePhoneBatteryUpdate(payload: RawPhoneBatteryPayload) {
  State.phoneBattery = {
    deviceId: payload.device_id,
    level: payload.level,
    connected: payload.connected,
  };

  const phoneTask = State.tasks.find((t) => t.id === "integration_phone");
  if (phoneTask) {
    if (payload.connected && payload.level <= 20) {
      phoneTask.emote = "worried";
      phoneTask.pillBadge = "approval";
      if (!hasWarnedLowBattery) {
        hasWarnedLowBattery = true;
        triggerLowBatteryBanner(payload.level);
      }
    } else {
      if (payload.level > 20) {
        hasWarnedLowBattery = false;
      }
      if (phoneTask.emote === "worried") {
        phoneTask.emote = "idle";
      }
      if (phoneTask.pillBadge === "approval") {
        phoneTask.pillBadge = null;
      }
    }
  }

  State.notify();
}

export function registerBatteryHandlers() {
  void onEvent<RawPhoneBatteryPayload>("phone-battery", (payload) => {
    handlePhoneBatteryUpdate(payload);
  });

  // Query initial battery status at startup
  void Bridge.getPhoneBattery()
    .then((initial: RawPhoneBatteryPayload | null) => {
      if (initial) {
        handlePhoneBatteryUpdate(initial);
      }
    })
    .catch(() => {
      // Ignore if not in Tauri
    });
}

export const initBatteryMonitoring = registerBatteryHandlers;
