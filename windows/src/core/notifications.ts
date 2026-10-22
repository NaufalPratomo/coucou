// Windows Notification Interceptor & Queue
import { onEvent } from "./bridge";
import { Sound } from "./sound";
import { State } from "./state";

export interface WindowsNotification {
  id: number;
  appName: string;
  title: string;
  body: string;
  timestampMs: number;
}

export interface RawNotificationPayload {
  id: number;
  app_name: string;
  title: string;
  body: string;
  timestamp_ms: number;
}

const MAX_HISTORY = 30;
export const notificationHistory: WindowsNotification[] = [];
export let activeNotifBanner: WindowsNotification | null = null;
let bannerTimeout: number | null = null;

export function registerNotificationHandlers(onNewNotification?: (n: WindowsNotification) => void) {
  void onEvent<RawNotificationPayload>("windows-notification", (raw) => {
    const notif: WindowsNotification = {
      id: raw.id,
      appName: raw.app_name,
      title: raw.title,
      body: raw.body,
      timestampMs: raw.timestamp_ms,
    };

    // Deduplicate
    if (notificationHistory.some((n) => n.id === notif.id)) {
      return;
    }

    notificationHistory.unshift(notif);
    while (notificationHistory.length > MAX_HISTORY) {
      notificationHistory.pop();
    }

    // Update Messages task state if present
    const msgTask = State.tasks.find((t) => t.id === "integration_messages");
    if (msgTask) {
      msgTask.state = "thinking";
      msgTask.emote = "surprised";
      msgTask.pillBadge = "approval";
      msgTask.steps = [notif.appName, `${notif.title}: ${notif.body}`];
      msgTask.stepIndex = 1;
    }

    // Set active banner & play gentle pop sound
    activeNotifBanner = notif;
    try {
      Sound.play("pop");
    } catch {
      // Audio autoplay may be constrained
    }
    State.notify();
    onNewNotification?.(notif);

    if (bannerTimeout != null) {
      window.clearTimeout(bannerTimeout);
    }
    bannerTimeout = window.setTimeout(() => {
      if (activeNotifBanner?.id === notif.id) {
        activeNotifBanner = null;
        State.notify();
      }
    }, 6000); // 6s banner duration
  });
}

export function dismissNotificationBanner() {
  if (bannerTimeout != null) {
    window.clearTimeout(bannerTimeout);
    bannerTimeout = null;
  }
  activeNotifBanner = null;
  State.notify();
}
