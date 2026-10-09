import assert from "node:assert/strict";
import test from "node:test";
import type { OfficialEvent } from "./official-events";
import { getCalendarBoundaryLabel, getFeaturedCalendarEvents } from "./official-event-status.ts";

const event: OfficialEvent = {
  id: "event", type: "event", title: "期間イベント", start: "2026-10-01", end: "2026-10-16",
  allDay: true, description: "", url: "",
};

test("期間イベントは開始日と最終日だけ代表表示し、途中はまとめる", () => {
  assert.equal(getFeaturedCalendarEvents([event], "2026-10-01").length, 1);
  assert.equal(getFeaturedCalendarEvents([event], "2026-10-09").length, 0);
  assert.equal(getFeaturedCalendarEvents([event], "2026-10-15").length, 1);
  assert.equal(getCalendarBoundaryLabel(event, "2026-10-01"), "開始");
  assert.equal(getCalendarBoundaryLabel(event, "2026-10-15"), "終了");
});

test("継続中のメンテと放送を埋もれさせず、元データは変更しない", () => {
  const maintenance = { ...event, id: "maintenance", type: "maintenance" as const };
  const broadcast = { ...event, id: "broadcast", type: "broadcast" as const };
  const source = [event, broadcast, maintenance];
  assert.deepEqual(getFeaturedCalendarEvents(source, "2026-10-09").map(({ id }) => id), ["maintenance", "broadcast"]);
  assert.deepEqual(source.map(({ id }) => id), ["event", "broadcast", "maintenance"]);
});
