import test from "node:test";
import assert from "node:assert/strict";

import { classifyNotificationCategory } from "../src/core/notifications.ts";
import { getBatteryColor, getBatteryFillWidth } from "../src/views/icons.ts";

test("classifyNotificationCategory identifies chat apps", () => {
  assert.equal(classifyNotificationCategory("WhatsApp"), "chat");
  assert.equal(classifyNotificationCategory("WhatsApp Business"), "chat");
  assert.equal(classifyNotificationCategory("Telegram"), "chat");
  assert.equal(classifyNotificationCategory("Discord"), "chat");
  assert.equal(classifyNotificationCategory("Messages"), "chat");
  assert.equal(classifyNotificationCategory("Signal"), "chat");
});

test("classifyNotificationCategory identifies shopping apps", () => {
  assert.equal(classifyNotificationCategory("Tokopedia"), "shop");
  assert.equal(classifyNotificationCategory("Shopee"), "shop");
  assert.equal(classifyNotificationCategory("Lazada"), "shop");
  assert.equal(classifyNotificationCategory("Blibli"), "shop");
  assert.equal(classifyNotificationCategory("Amazon"), "shop");
  assert.equal(classifyNotificationCategory("Gojek"), "shop");
  assert.equal(classifyNotificationCategory("Grab"), "shop");
});

test("classifyNotificationCategory identifies email apps", () => {
  assert.equal(classifyNotificationCategory("Gmail"), "mail");
  assert.equal(classifyNotificationCategory("Outlook"), "mail");
  assert.equal(classifyNotificationCategory("Mail"), "mail");
  assert.equal(classifyNotificationCategory("Yahoo Mail"), "mail");
  assert.equal(classifyNotificationCategory("Spark"), "mail");
});

test("classifyNotificationCategory falls back to other", () => {
  assert.equal(classifyNotificationCategory("Settings"), "other");
  assert.equal(classifyNotificationCategory("Windows Update"), "other");
});

test("getBatteryColor returns expected colors based on charge and connection", () => {
  // Connected
  assert.equal(getBatteryColor(100, true), "#22C55E"); // iOS Green (>40%)
  assert.equal(getBatteryColor(50, true), "#22C55E");
  assert.equal(getBatteryColor(40, true), "#F59E0B"); // Amber (21-40%)
  assert.equal(getBatteryColor(25, true), "#F59E0B");
  assert.equal(getBatteryColor(20, true), "#EF4444"); // Red (<=20%)
  assert.equal(getBatteryColor(5, true), "#EF4444");

  // Disconnected
  assert.equal(getBatteryColor(100, false), "#64748B"); // Muted slate
  assert.equal(getBatteryColor(20, false), "#64748B");
});

test("getBatteryFillWidth scales correctly from 0 to 100", () => {
  assert.equal(getBatteryFillWidth(100), 10);
  assert.equal(getBatteryFillWidth(50), 5);
  assert.equal(getBatteryFillWidth(0), 1);
  assert.equal(getBatteryFillWidth(20), 2);
});
