import assert from "node:assert/strict";
import test from "node:test";

import type { OfficialEvent } from "./official-events";
import { compareOfficialEventsForCalendar } from "./official-event-order.ts";

function event(id: string, type: OfficialEvent["type"], start: string): OfficialEvent {
  return {
    id,
    type,
    title: id,
    start,
    end: start,
    allDay: false,
    description: id,
    url: "https://example.com",
  };
}

test("同日の公式予定はメンテナンスを最優先にする", () => {
  const events = [
    event("campaign", "campaign", "2026-10-12"),
    event("maintenance", "maintenance", "2026-10-12T19:00:00+09:00"),
    event("event", "event", "2026-10-12T09:00:00+09:00"),
  ];

  assert.deepEqual(events.sort(compareOfficialEventsForCalendar).map(({ id }) => id), [
    "maintenance",
    "event",
    "campaign",
  ]);
});
