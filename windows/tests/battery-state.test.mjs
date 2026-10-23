import test from "node:test";
import assert from "node:assert/strict";

import { State } from "../src/core/state.ts";
import { handlePhoneBatteryUpdate } from "../src/core/battery.ts";

test("handlePhoneBatteryUpdate updates State.phoneBattery", () => {
  State.phoneBattery = null;
  handlePhoneBatteryUpdate({
    device_id: "4789559B9584",
    level: 85,
    connected: true,
  });

  assert.ok(State.phoneBattery);
  assert.equal(State.phoneBattery.level, 85);
  assert.equal(State.phoneBattery.connected, true);
});

test("handlePhoneBatteryUpdate triggers worried emote when battery is <= 20%", () => {
  State.tasks = [
    {
      id: "integration_phone",
      name: "NOFFF",
      color: "#0A84FF",
      state: "idle",
      emote: null,
      stepIndex: 0,
      steps: [],
      source: "service",
      isIntegration: true,
    },
  ];

  handlePhoneBatteryUpdate({
    device_id: "4789559B9584",
    level: 15,
    connected: true,
  });

  const task = State.tasks.find((t) => t.id === "integration_phone");
  assert.equal(task?.emote, "worried");
});

test("handlePhoneBatteryUpdate restores idle emote when battery charges above 20%", () => {
  const task = State.tasks.find((t) => t.id === "integration_phone");
  if (task) task.emote = "worried";

  handlePhoneBatteryUpdate({
    device_id: "4789559B9584",
    level: 50,
    connected: true,
  });

  assert.equal(task?.emote, "idle");
});
