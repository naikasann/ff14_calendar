import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore Node's native TypeScript test runner requires the .ts extension.
import { addDays, formatDateKey, getCalendarDays } from "./schedule.ts";

const cases = [
  { year: 2026, month: 2, weeks: 4, first: "2026-02-01", last: "2026-02-28", days: 28 },
  { year: 2026, month: 10, weeks: 5, first: "2026-09-27", last: "2026-10-31", days: 31 },
  { year: 2026, month: 5, weeks: 6, first: "2026-04-26", last: "2026-06-06", days: 31 },
  { year: 2026, month: 11, weeks: 5, first: "2026-11-01", last: "2026-12-05", days: 30 },
  { year: 2024, month: 2, weeks: 5, first: "2024-01-28", last: "2024-03-02", days: 29 },
  { year: 2026, month: 1, weeks: 5, first: "2025-12-28", last: "2026-01-31", days: 31 },
  { year: 2026, month: 12, weeks: 5, first: "2026-11-29", last: "2027-01-02", days: 31 },
];

for (const { year, month, weeks, first, last, days: daysInMonth } of cases) {
  test(`${year}-${month}: ${weeks} complete weeks, including every date through month end`, () => {
    const days = getCalendarDays({ year, month, day: 1 });
    assert.equal(days.length, weeks * 7);
    assert.equal(formatDateKey(days[0]), first);
    assert.equal(formatDateKey(days.at(-1)!), last);
    assert.equal(new Date(`${first}T00:00:00Z`).getUTCDay(), 0);
    assert.equal(new Date(`${last}T00:00:00Z`).getUTCDay(), 6);
    assert.deepEqual(
      days.filter((date) => date.year === year && date.month === month).map((date) => date.day),
      Array.from({ length: daysInMonth }, (_, index) => index + 1),
    );
    days.slice(1).forEach((date, index) => assert.deepEqual(date, addDays(days[index], 1)));
    assert.ok(days.slice(0, 7).some((date) => date.month === month));
    assert.ok(days.slice(-7).some((date) => date.month === month));
    assert.deepEqual(getCalendarDays({ year, month, day: daysInMonth }), days);
  });
}
