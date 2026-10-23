// Messages & Notification Center View (Laptop & iPhone NOFFF)
import { h, svg, clear, dot } from "./dom";
import { ICONS, batteryIcon, getBatteryColor } from "./icons";
import { State } from "../core/state";
import {
  laptopNotificationHistory,
  phoneNotificationHistory,
  isPhoneNotification,
  classifyNotificationCategory,
  type NotificationCategory,
} from "../core/notifications";
import { Bridge, type CompanionPairing } from "../core/bridge";
import { t, tl } from "../i18n/i18n";

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
  const el = h("div", { class: "msg-card-container", style: "position:relative;" });
  let lastKey = "";

  const isPhone = kind === "phone";
  const history = isPhone ? phoneNotificationHistory : laptopNotificationHistory;
  const cardColor = isPhone ? "#0A84FF" : "#38BDF8";
  const cardTitle = isPhone ? "NOFFF" : "Messages";
  const taskId = isPhone ? "integration_phone" : "integration_messages";

  let selectedCategory: "all" | NotificationCategory = "all";
  let showPairModal = false;
  let pairingData: CompanionPairing | null = null;
  let loadingPairing = false;

  function render() {
    clear(el);

    // Connection & Battery Status
    let headDotColor = isPhone ? "#22C55E" : cardColor;
    let cardSub = isPhone ? "iPhone Connected" : "Notifications";

    if (isPhone && State.phoneBattery) {
      const bat = State.phoneBattery;
      headDotColor = bat.connected ? "#22C55E" : "#64748B";
      cardSub = bat.connected ? "iPhone Connected" : "Disconnected";
    }

    const headDot = dot(headDotColor, 8);
    const title = h("span", { class: "msg-card-title", text: cardTitle });
    const sub = h("span", { class: "msg-card-sub", text: cardSub });

    // Battery badge if phone and battery known
    let batBadge: HTMLElement | null = null;
    if (isPhone && State.phoneBattery) {
      const bat = State.phoneBattery;
      batBadge = h(
        "span",
        {
          class: "nofff-bat-badge",
          title: `Battery ${bat.level}% (${bat.connected ? t("Connected") : "Disconnected"})`,
        },
        batteryIcon(bat.level, bat.connected, 14),
        h("span", {
          text: `${bat.level}%`,
          style: `color:${getBatteryColor(bat.level, bat.connected)};font-size:10.5px;font-weight:600;`,
        }),
      );
    }

    // Filter history by category
    const filtered = isPhone && selectedCategory !== "all"
      ? history.filter((notif) => {
          const isPhoneToast = isPhoneNotification(notif.appName);
          const displayAppName = isPhoneToast
            ? notif.title.split(":")[0].replace(/[^\w\s]/gi, "").trim() || "iPhone"
            : notif.appName;
          return classifyNotificationCategory(displayAppName, notif.title, notif.body) === selectedCategory;
        })
      : history;

    const countBadge = h("span", {
      class: "msg-card-count",
      text: `${filtered.length}`,
    });

    // Pair iPhone button (opens QR modal)
    let pairBtn: HTMLElement | null = null;
    if (isPhone) {
      pairBtn = h(
        "button",
        {
          class: "nofff-pair-btn",
          title: "Pair iPhone Companion (PWA)",
          onclick: (e) => {
            e.stopPropagation();
            showPairModal = true;
            render();
            if (!pairingData && !loadingPairing) {
              loadingPairing = true;
              Bridge.getCompanionPairing()
                .then((res) => {
                  pairingData = res;
                  loadingPairing = false;
                  if (showPairModal) render();
                })
                .catch(() => {
                  loadingPairing = false;
                });
            }
          },
        },
        svg(ICONS.qrcode, 12),
        h("span", { text: "Pair iPhone Companion" }),
      );
    }

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
            const isLowBat = isPhone && State.phoneBattery?.connected && State.phoneBattery.level <= 20;
            task.emote = isLowBat ? "worried" : null;
            task.pillBadge = isLowBat ? "approval" : null;
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
      batBadge,
      countBadge,
      pairBtn,
      history.length > 0 ? clearBtn : null,
    );

    // Category chips for phone
    let catBar: HTMLElement | null = null;
    if (isPhone) {
      catBar = h("div", { class: "nofff-cat-bar" });
      const categories: { id: "all" | NotificationCategory; label: string }[] = [
        { id: "all", label: t("All") },
        { id: "chat", label: t("Chat") },
        { id: "shop", label: "Shop" },
        { id: "mail", label: "Mail" },
      ];

      for (const cat of categories) {
        const catCount = cat.id === "all"
          ? history.length
          : history.filter((n) => {
              const isPhoneToast = isPhoneNotification(n.appName);
              const displayAppName = isPhoneToast
                ? n.title.split(":")[0].replace(/[^\w\s]/gi, "").trim() || "iPhone"
                : n.appName;
              return classifyNotificationCategory(displayAppName, n.title, n.body) === cat.id;
            }).length;

        const isAct = selectedCategory === cat.id;
        const chip = h(
          "button",
          {
            class: `nofff-cat-chip${isAct ? " active" : ""}`,
            onclick: (e) => {
              e.stopPropagation();
              selectedCategory = cat.id;
              render();
            },
          },
          catCount > 0 ? `${cat.label} (${catCount})` : cat.label,
        );
        catBar.append(chip);
      }
    }

    // Notifications List
    const body = h("div", { class: "msg-card-list" });

    if (filtered.length === 0) {
      body.style.overflow = "hidden";
      const emptyText = history.length === 0
        ? (isPhone ? "No new iPhone notifications" : "No new notifications")
        : `No ${selectedCategory} notifications`;
      const emptyIconSvg = isPhone ? ICONS.iphone : ICONS.bell;
      const emptyIcon = svg(emptyIconSvg, 28);
      emptyIcon.classList.add("msg-empty-icon");
      const emptyTextEl = h("div", { class: "msg-empty-text", text: emptyText });
      const emptyWrap = h("div", { class: "msg-empty-wrap" }, emptyIcon, emptyTextEl);
      body.append(emptyWrap);
    } else {
      body.style.overflow = "";
      for (let i = 0; i < filtered.length; i++) {
        const notif = filtered[i];
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
              const idx = history.indexOf(notif);
              if (idx !== -1) {
                history.splice(idx, 1);
              }
              if (history.length === 0) {
                const task = State.tasks.find((t) => t.id === taskId);
                if (task) {
                  task.state = "idle";
                  const isLowBat = isPhone && State.phoneBattery?.connected && State.phoneBattery.level <= 20;
                  task.emote = isLowBat ? "worried" : null;
                  task.pillBadge = isLowBat ? "approval" : null;
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

    el.append(head);
    if (catBar) el.append(catBar);
    el.append(body);

    // QR Modal Overlay if open
    if (isPhone && showPairModal) {
      const modal = h("div", {
        class: "nofff-qr-modal",
        onclick: (e) => {
          if (!e.target || e.target === modal) {
            e.stopPropagation();
            showPairModal = false;
            render();
          }
        },
      });
      const closeBtn = h(
        "button",
        {
          class: "nofff-qr-close",
          onclick: (e) => {
            e.stopPropagation();
            showPairModal = false;
            render();
          },
        },
        "×",
      );

      const modalTitle = h("div", { class: "nofff-qr-title", text: "Pair iPhone Companion" });
      const modalSub = h("div", {
        class: "nofff-qr-sub",
        text: "Scan with iPhone Camera to open Web Companion (PWA on :47822)",
      });

      const qrBox = h("div", { class: "nofff-qr-box" });
      if (loadingPairing) {
        qrBox.textContent = "Loading QR Code...";
      } else if (pairingData?.qr) {
        clear(qrBox);
        let rendered = false;
        if (typeof DOMParser !== "undefined") {
          try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(pairingData.qr, "image/svg+xml");
            const svgEl = doc.documentElement;
            if (svgEl && svgEl.tagName.toLowerCase() === "svg") {
              qrBox.append(svgEl as unknown as HTMLElement);
              rendered = true;
            }
          } catch {
            // Fallback
          }
        }
        if (!rendered) {
          qrBox.textContent = pairingData.url;
        }
      } else {
        qrBox.textContent = "Could not load companion pairing";
      }

      const urlRow = h("div", { class: "nofff-qr-url-row" });
      if (pairingData?.url) {
        const link = h("a", {
          class: "nofff-qr-link",
          href: pairingData.url,
          text: pairingData.url,
          onclick: (e) => {
            e.preventDefault();
            void Bridge.openUrl(pairingData!.url);
          },
        });
        const copyBtn = h(
          "button",
          {
            class: "nofff-qr-copy-btn",
            onclick: (e) => {
              e.stopPropagation();
              void navigator.clipboard?.writeText(pairingData!.url).then(() => {
                copyBtn.textContent = "Copied!";
                window.setTimeout(() => (copyBtn.textContent = "Copy Link"), 1500);
              });
            },
          },
          "Copy Link",
        );
        urlRow.append(link, copyBtn);
      }

      const pwaHint = h("div", {
        class: "nofff-qr-pwa-hint",
        text: "Safari: Tap Share → 'Add to Home Screen' for standalone OLED PWA",
      });

      modal.append(closeBtn, modalTitle, modalSub, qrBox, urlRow, pwaHint);
      el.append(modal);
    }
  }

  return {
    el,
    sync() {
      const batKey = isPhone && State.phoneBattery
        ? `${State.phoneBattery.level}:${State.phoneBattery.connected}`
        : "";
      const key = `${history.length}:${history[0]?.id ?? 0}:${history[0]?.timestampMs ?? 0}:${batKey}:${selectedCategory}:${showPairModal}:${loadingPairing}:${pairingData?.token ?? ""}`;
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

    if (isPhoneKind && State.phoneBattery) {
      const bat = State.phoneBattery;
      const sub = h("span", { class: "int-sub", style: "display:inline-flex;align-items:center;gap:4px;" });
      const batIcon = batteryIcon(bat.level, bat.connected, 13);
      const batText = bat.connected ? `${bat.level}%` : "Disconnected";
      const countPart = count > 0 ? ` · ${count}` : "";
      const textEl = h("span", { text: `${batText}${countPart}` });
      sub.append(batIcon, textEl);
      el.append(d, name, sub);
    } else {
      const countText = count > 0 ? (count === 1 ? "1 notification" : `${count} notifications`) : tl("Connected");
      const sub = h("span", { class: "int-sub", text: countText });
      el.append(d, name, sub);
    }
  }

  return {
    el,
    sync() {
      const batKey = isPhoneKind && State.phoneBattery ? `${State.phoneBattery.level}:${State.phoneBattery.connected}` : "";
      const key = `${history.length}:${batKey}`;
      if (key !== lastKey) {
        lastKey = key;
        render();
      }
    },
  };
}
