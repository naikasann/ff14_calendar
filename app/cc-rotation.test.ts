import assert from "node:assert/strict";
import test from "node:test";

import {
  CC_MAPS,
  getCrystallineConflictSchedule,
  getCrystallineConflictSlot,
} from "./cc-rotation.ts";

test("基準時刻はパライストラ", () => {
  assert.equal(getCrystallineConflictSlot(new Date("2026-04-28T18:00:00+09:00")).map.id, "palaistra");
});

test("59分59秒までは同じマップで、60分後に次へ切り替わる", () => {
  assert.equal(getCrystallineConflictSlot(new Date("2026-04-28T18:59:59+09:00")).map.id, "palaistra");
  assert.equal(getCrystallineConflictSlot(new Date("2026-04-28T19:00:00+09:00")).map.id, "volcanic");
});

test("7枠で全マップを公式順に一巡する", () => {
  const schedule = getCrystallineConflictSchedule(new Date("2026-04-28T18:30:00+09:00"));
  assert.deepEqual(schedule.map((slot) => slot.map.id), CC_MAPS.map((map) => map.id));
});

test("7時間後は先頭のマップに戻る", () => {
  assert.equal(getCrystallineConflictSlot(new Date("2026-04-29T01:00:00+09:00")).map.id, "palaistra");
});
