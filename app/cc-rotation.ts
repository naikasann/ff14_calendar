export type CrystallineConflictMap = {
  id: "palaistra" | "volcanic" | "bayside" | "cloud-nine" | "clockwork" | "harmonia" | "red-sands";
  name: string;
  shortName: string;
};

export type CrystallineConflictSlot = {
  map: CrystallineConflictMap;
  startsAt: Date;
  endsAt: Date;
};

export const CC_MAPS: CrystallineConflictMap[] = [
  { id: "palaistra", name: "パライストラ", shortName: "パライストラ" },
  { id: "volcanic", name: "ヴォルカニック・ハート", shortName: "ヴォルカニック" },
  { id: "bayside", name: "ベイサイド・バトルグラウンド", shortName: "ベイサイド" },
  { id: "cloud-nine", name: "クラウドナイン", shortName: "クラウドナイン" },
  { id: "clockwork", name: "東方絡繰御殿", shortName: "絡繰御殿" },
  { id: "harmonia", name: "ハルモニア戦争図書館", shortName: "ハルモニア" },
  { id: "red-sands", name: "レッド・サンズ", shortName: "レッド・サンズ" },
];

export const CC_ROTATION_INTERVAL_MS = 60 * 60 * 1000;

// Calibrated from the in-game Duty Finder on 2026-08-25: 20:00 JST was Harmonia,
// which places the next Palaistra slot at 22:00 JST.
// The official notes define the order and 60-minute interval but do not expose a live-map API.
export const CC_ROTATION_ANCHOR_MS = Date.parse("2026-08-25T22:00:00+09:00");

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

export function getCrystallineConflictSlot(now: Date): CrystallineConflictSlot {
  const slotNumber = Math.floor((now.getTime() - CC_ROTATION_ANCHOR_MS) / CC_ROTATION_INTERVAL_MS);
  const startsAtMs = CC_ROTATION_ANCHOR_MS + slotNumber * CC_ROTATION_INTERVAL_MS;
  return {
    map: CC_MAPS[modulo(slotNumber, CC_MAPS.length)],
    startsAt: new Date(startsAtMs),
    endsAt: new Date(startsAtMs + CC_ROTATION_INTERVAL_MS),
  };
}

export function getCrystallineConflictSchedule(now: Date, count = 7): CrystallineConflictSlot[] {
  const current = getCrystallineConflictSlot(now);
  const currentIndex = CC_MAPS.findIndex((map) => map.id === current.map.id);
  return Array.from({ length: count }, (_, offset) => ({
    map: CC_MAPS[(currentIndex + offset) % CC_MAPS.length],
    startsAt: new Date(current.startsAt.getTime() + offset * CC_ROTATION_INTERVAL_MS),
    endsAt: new Date(current.endsAt.getTime() + offset * CC_ROTATION_INTERVAL_MS),
  }));
}

export function formatCcRemaining(now: Date, endsAt: Date): string {
  const seconds = Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}分 ${String(seconds % 60).padStart(2, "0")}秒`;
}
