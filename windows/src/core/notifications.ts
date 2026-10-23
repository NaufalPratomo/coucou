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
export const laptopNotificationHistory: WindowsNotification[] = [];
export const phoneNotificationHistory: WindowsNotification[] = [];
export let activeNotifBanner: WindowsNotification | null = null;
let bannerTimeout: number | null = null;
let notificationListener: ((n: WindowsNotification) => void) | null = null;

export function isPhoneNotification(appName: string): boolean {
  return /phone|telepon|link to windows|nofff/i.test(appName);
}

export function registerNotificationHandlers(onNewNotification?: (n: WindowsNotification) => void) {
  notificationListener = onNewNotification ?? null;
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

    const isPhone = isPhoneNotification(notif.appName);
    if (isPhone) {
      phoneNotificationHistory.unshift(notif);
      while (phoneNotificationHistory.length > MAX_HISTORY) {
        phoneNotificationHistory.pop();
      }
      const phoneTask = State.tasks.find((t) => t.id === "integration_phone");
      if (phoneTask) {
        phoneTask.name = "NOFFF";
        phoneTask.color = "#0A84FF";
        phoneTask.state = "thinking";
        phoneTask.emote = "surprised";
        phoneTask.pillBadge = "approval";
        phoneTask.steps = [notif.appName, `${notif.title}: ${notif.body}`];
        phoneTask.stepIndex = 1;
      }
    } else {
      laptopNotificationHistory.unshift(notif);
      while (laptopNotificationHistory.length > MAX_HISTORY) {
        laptopNotificationHistory.pop();
      }
      const msgTask = State.tasks.find((t) => t.id === "integration_messages");
      if (msgTask) {
        msgTask.name = "Messages";
        msgTask.color = "#38BDF8";
        msgTask.state = "thinking";
        msgTask.emote = "surprised";
        msgTask.pillBadge = "approval";
        msgTask.steps = [notif.appName, `${notif.title}: ${notif.body}`];
        msgTask.stepIndex = 1;
      }
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

export function triggerLowBatteryBanner(level: number) {
  const notif: WindowsNotification = {
    id: 999990,
    appName: "NOFFF",
    title: "Low Battery",
    body: `iPhone battery is at ${level}%. Please charge your phone.`,
    timestampMs: Date.now(),
  };
  activeNotifBanner = notif;
  try {
    Sound.play("pop");
  } catch {
    // Audio autoplay may be constrained
  }
  State.notify();
  notificationListener?.(notif);

  if (bannerTimeout != null) {
    window.clearTimeout(bannerTimeout);
  }
  bannerTimeout = window.setTimeout(() => {
    if (activeNotifBanner?.id === notif.id) {
      activeNotifBanner = null;
      State.notify();
    }
  }, 6000);
}

export type NotificationCategory = "chat" | "shop" | "mail" | "other";

export function classifyNotificationCategory(appName: string, title?: string, body?: string): NotificationCategory {
  const combined = `${appName} ${title || ""} ${body || ""}`.toLowerCase();
  if (/whatsapp|telegram|discord|messages|pesan|signal|line|wechat|slack|teams|skype|messenger/i.test(combined)) {
    return "chat";
  }
  if (/tokopedia|shopee|lazada|blibli|amazon|gojek|grab|tiktok shop|bukalapak|aliexpress/i.test(combined)) {
    return "shop";
  }
  if (/gmail|outlook|mail|surat|yahoo mail|spark|thunderbird/i.test(combined)) {
    return "mail";
  }
  return "other";
}
