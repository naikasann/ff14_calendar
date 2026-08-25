import assert from "node:assert/strict";
import test from "node:test";

import {
  CC_MAPS,
  getCrystallineConflictSchedule,
  getCrystallineConflictSlot,
} from "./cc-rotation.ts";

test("確認済みの基準時刻はハルモニア", () => {
  assert.equal(getCrystallineConflictSlot(new Date("2026-08-25T20:00:00+09:00")).map.id, "harmonia");
});

test("59分59秒までは同じマップで、60分後に次へ切り替わる", () => {
  assert.equal(getCrystallineConflictSlot(new Date("2026-08-25T20:59:59+09:00")).map.id, "harmonia");
  assert.equal(getCrystallineConflictSlot(new Date("2026-08-25T21:00:00+09:00")).map.id, "red-sands");
});

test("7枠で全マップを公式順に一巡する", () => {
  const schedule = getCrystallineConflictSchedule(new Date("2026-08-25T22:30:00+09:00"));
  assert.deepEqual(schedule.map((slot) => slot.map.id), CC_MAPS.map((map) => map.id));
});

test("7時間後は先頭のマップに戻る", () => {
  assert.equal(getCrystallineConflictSlot(new Date("2026-08-26T03:00:00+09:00")).map.id, "harmonia");
});
