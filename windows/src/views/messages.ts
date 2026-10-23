// Messages & Notification Center View (Laptop & iPhone NOFFF)
import { h, svg, clear, dot } from "./dom";
import { ICONS } from "./icons";
import { State } from "../core/state";
import { laptopNotificationHistory, phoneNotificationHistory, isPhoneNotification } from "../core/notifications";
import { tl } from "../i18n/i18n";

function getAppColor(appName: string): string {
  const lower = appName.toLowerCase();
  if (lower.includes("telegram")) return "#229ed9";
  if (lower.includes("whatsapp")) return "#25d366";
  if (lower.includes("slack")) return "#e01e5a";
  if (lower.includes("discord")) return "#5865f2";
  if (lower.includes("github")) return "#f4505e";
  if (lower.includes("chrome") || lower.includes("google")) return "#22c55e";
  if (lower.includes("edge")) return "#0078d4";
  if (lower.includes("comet") || lower.includes("antigravity")) return "#38bdf8";
  return "#60a5fa";
}

function formatRelativeTime(timestampMs: number): string {
  const diffSec = Math.floor((Date.now() - timestampMs) / 1000);
  if (diffSec < 15) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${Math.floor(diffHour / 24)}d ago`;
}

export function buildMessagesCard(kind: "laptop" | "phone" = "phone"): { el: HTMLElement; sync(): void } {
  const el = h("div", { class: "msg-card-container" });
  let lastKey = "";

  const isPhone = kind === "phone";
  const history = isPhone ? phoneNotificationHistory : laptopNotificationHistory;
  const cardColor = isPhone ? "#0A84FF" : "#38BDF8";
  const cardTitle = isPhone ? "NOFFF" : "Messages";
  const cardSub = isPhone ? "iPhone Connected" : "Notifications";
  const emptyText = isPhone ? "No new iPhone notifications" : "No new notifications";
  const emptyIconSvg = isPhone ? ICONS.iphone : ICONS.bell;
  const taskId = isPhone ? "integration_phone" : "integration_messages";

  function render() {
    clear(el);

    // Header
    const headDot = dot(cardColor, 8);
    const title = h("span", { class: "msg-card-title", text: cardTitle });
    const sub = h("span", { class: "msg-card-sub", text: cardSub });
    const countBadge = h("span", {
      class: "msg-card-count",
      text: `${history.length}`,
    });

    const clearBtn = h(
      "button",
      {
        class: "msg-clear-all-btn",
        onclick: (e) => {
          e.stopPropagation();
          history.length = 0;
          const task = State.tasks.find((t) => t.id === taskId);
          if (task) {
            task.state = "idle";
            task.emote = null;
            task.pillBadge = null;
            task.steps = [];
            task.stepIndex = 0;
          }
          State.notify();
        },
      },
      "Clear all",
    );

    const head = h(
      "div",
      { class: "msg-card-head" },
      headDot,
      title,
      sub,
      countBadge,
      history.length > 0 ? clearBtn : null,
    );

    // Content
    const body = h("div", { class: "msg-card-list" });

    if (history.length === 0) {
      body.style.overflow = "hidden";
      const emptyIcon = svg(emptyIconSvg, 28);
      emptyIcon.classList.add("msg-empty-icon");
      const emptyTextEl = h("div", { class: "msg-empty-text", text: emptyText });
      const emptyWrap = h("div", { class: "msg-empty-wrap" }, emptyIcon, emptyTextEl);
      body.append(emptyWrap);
    } else {
      body.style.overflow = "";
      for (let i = 0; i < history.length; i++) {
        const notif = history[i];
        const isPhoneToast = isPhoneNotification(notif.appName);
        const displayAppName = isPhoneToast
          ? notif.title.split(":")[0].replace(/[^\w\s]/gi, "").trim() || "iPhone"
          : notif.appName;
        const appColor = getAppColor(displayAppName);

        const badge = h("span", {
          class: "msg-item-badge",
          style: `background: ${appColor}22; color: ${appColor}; border: 1px solid ${appColor}44`,
          text: displayAppName,
        });

        const itemTitle = h("span", { class: "msg-item-title", text: notif.title });
        const itemTime = h("span", { class: "msg-item-time", text: formatRelativeTime(notif.timestampMs) });

        const delBtn = h(
          "button",
          {
            class: "msg-item-del",
            onclick: (e) => {
              e.stopPropagation();
              history.splice(i, 1);
              if (history.length === 0) {
                const task = State.tasks.find((t) => t.id === taskId);
                if (task) {
                  task.state = "idle";
                  task.emote = null;
                  task.pillBadge = null;
                  task.steps = [];
                  task.stepIndex = 0;
                }
              }
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
      const key = `${history.length}:${history[0]?.id ?? 0}:${history[0]?.timestampMs ?? 0}`;
      if (key !== lastKey) {
        lastKey = key;
        render();
      }
    },
  };
}

export function buildMessagesPill(
  kindOrOnFocus: ("laptop" | "phone") | (() => void) = "phone",
  maybeOnFocus?: () => void,
): { el: HTMLElement; sync(): void } {
  const isPhoneKind = typeof kindOrOnFocus === "string" ? kindOrOnFocus === "phone" : true;
  const onFocus = typeof kindOrOnFocus === "function" ? kindOrOnFocus : (maybeOnFocus ?? (() => {}));

  const pillColor = isPhoneKind ? "#0A84FF" : "#38BDF8";
  const pillName = isPhoneKind ? "NOFFF" : "Messages";
  const history = isPhoneKind ? phoneNotificationHistory : laptopNotificationHistory;

  const el = h("div", { class: "int-pill msg-pill", onclick: onFocus });
  let lastKey = "";

  function render() {
    clear(el);
    const d = dot(pillColor, 7);
    const name = h("span", { class: "int-name", text: pillName });
    const count = history.length;
    const countText = count > 0 ? (count === 1 ? "1 notification" : `${count} notifications`) : tl("Connected");
    const sub = h("span", { class: "int-sub", text: countText });
    el.append(d, name, sub);
  }

  return {
    el,
    sync() {
      const key = `${history.length}`;
      if (key !== lastKey) {
        lastKey = key;
        render();
      }
    },
  };
}
