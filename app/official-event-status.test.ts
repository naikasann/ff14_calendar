import assert from "node:assert/strict";
import test from "node:test";
import { getOfficialEventLastDate, getOfficialEventStatus } from "./official-event-status.ts";
import type { OfficialEvent } from "./official-events";

const event: OfficialEvent = {
  id: "test", type: "event", title: "test", description: "", url: "",
  start: "2026-10-01T17:00:00+09:00", end: "2026-10-12T23:59:00+09:00", allDay: false,
};

test("開催前・開催中・終了3日前・終了後を区別する", () => {
  assert.equal(getOfficialEventStatus(event, null), undefined);
  assert.equal(getOfficialEventStatus(event, Date.parse("2026-09-30T00:00:00+09:00")), undefined);
  assert.equal(getOfficialEventStatus(event, Date.parse("2026-10-08T00:00:00+09:00")), "開催中");
  assert.equal(getOfficialEventStatus(event, Date.parse("2026-10-09T23:59:00+09:00")), "終了間近");
  assert.equal(getOfficialEventStatus(event, Date.parse(event.end)), undefined);
});

test("終日予定の排他的な終了日を締切表示に使わない", () => {
  const allDay = { ...event, start: "2026-10-01", end: "2026-10-13", allDay: true };
  assert.equal(getOfficialEventLastDate(allDay), "2026-10-12");
  assert.equal(getOfficialEventLastDate(event), "2026-10-12");
  assert.equal(getOfficialEventStatus(allDay, Date.parse("2026-10-13T00:00:00+09:00")), undefined);
});

test("メンテナンス・放送には終了間近バッジを出さない", () => {
  for (const type of ["maintenance", "broadcast", "patch"] as const) {
    assert.equal(getOfficialEventStatus({ ...event, type }, Date.parse("2026-10-12T12:00:00+09:00")), undefined);
  }
});
