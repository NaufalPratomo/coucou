// Messages & Notification Center View
import { h, svg, clear, dot } from "./dom";
import { ICONS } from "./icons";
import { State } from "../core/state";
import { notificationHistory } from "../core/notifications";

function getAppColor(appName: string): string {
  const lower = appName.toLowerCase();
  if (lower.includes("telegram")) return "#229ed9";
  if (lower.includes("whatsapp")) return "#25d366";
  if (lower.includes("slack")) return "#e01e5a";
  if (lower.includes("discord")) return "#5865f2";
  if (lower.includes("github")) return "#f4505e";
  if (lower.includes("comet") || lower.includes("antigravity")) return "#38bdf8";
  return "#60a5fa";
}

function formatRelativeTime(timestampMs: number): string {
  const diffSec = Math.floor((Date.now() - timestampMs) / 1000);
  if (diffSec < 15) return "Baru saja";
  if (diffSec < 60) return `${diffSec}d lalu`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}j lalu`;
  return `${Math.floor(diffHour / 24)}h lalu`;
}

export function buildMessagesCard(): { el: HTMLElement; sync(): void } {
  const el = h("div", { class: "msg-card-container" });
  let lastKey = "";

  function render() {
    clear(el);

    // Header
    const headDot = dot("#38BDF8", 8);
    const title = h("span", { class: "msg-card-title", text: "Messages" });
    const sub = h("span", { class: "msg-card-sub", text: "Notifications" });
    const countBadge = h("span", {
      class: "msg-card-count",
      text: `${notificationHistory.length}`,
    });

    const clearBtn = h(
      "button",
      {
        class: "msg-clear-all-btn",
        onclick: (e) => {
          e.stopPropagation();
          notificationHistory.length = 0;
          State.notify();
        },
      },
      "Hapus Semua",
    );

    const head = h(
      "div",
      { class: "msg-card-head" },
      headDot,
      title,
      sub,
      countBadge,
      notificationHistory.length > 0 ? clearBtn : null,
    );

    // Content
    const body = h("div", { class: "msg-card-list" });

    if (notificationHistory.length === 0) {
      const emptyIcon = svg(ICONS.bubble, 28);
      emptyIcon.classList.add("msg-empty-icon");
      const emptyText = h("div", { class: "msg-empty-text", text: "Belum ada notifikasi baru" });
      const emptySub = h("div", {
        class: "msg-empty-sub",
        text: "Pesan dari Telegram, WhatsApp, Slack, Comet, dll. akan muncul di sini.",
      });
      const emptyWrap = h("div", { class: "msg-empty-wrap" }, emptyIcon, emptyText, emptySub);
      body.append(emptyWrap);
    } else {
      for (let i = 0; i < notificationHistory.length; i++) {
        const notif = notificationHistory[i];
        const appColor = getAppColor(notif.appName);

        const badge = h("span", {
          class: "msg-item-badge",
          style: `background: ${appColor}22; color: ${appColor}; border: 1px solid ${appColor}44`,
          text: notif.appName,
        });

        const itemTitle = h("span", { class: "msg-item-title", text: notif.title });
        const itemTime = h("span", { class: "msg-item-time", text: formatRelativeTime(notif.timestampMs) });

        const delBtn = h(
          "button",
          {
            class: "msg-item-del",
            onclick: (e) => {
              e.stopPropagation();
              notificationHistory.splice(i, 1);
              State.notify();
            },
          },
          "×",
        );

        const topRow = h("div", { class: "msg-item-top" }, badge, itemTitle, itemTime, delBtn);
        const textRow = h("div", { class: "msg-item-body", text: notif.body });

        const itemEl = h("div", { class: "msg-item" }, topRow, textRow);
        body.append(itemEl);
      }
    }

    el.append(head, body);
  }

  return {
    el,
    sync() {
      const key = `${notificationHistory.length}:${notificationHistory[0]?.id ?? 0}:${notificationHistory[0]?.timestampMs ?? 0}`;
      if (key !== lastKey) {
        lastKey = key;
        render();
      }
    },
  };
}

export function buildMessagesPill(onFocus: () => void): { el: HTMLElement; sync(): void } {
  const el = h("div", { class: "int-pill msg-pill", onclick: onFocus });
  let lastKey = "";

  function render() {
    clear(el);
    const d = dot("#38BDF8", 7);
    const name = h("span", { class: "int-name", text: "Messages" });
    const count = notificationHistory.length;
    const countText = count > 0 ? `${count} notif` : "Empty";
    const sub = h("span", { class: "int-sub", text: countText });
    el.append(d, name, sub);
  }

  return {
    el,
    sync() {
      const key = `${notificationHistory.length}`;
      if (key !== lastKey) {
        lastKey = key;
        render();
      }
    },
  };
}
