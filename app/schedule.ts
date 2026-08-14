export type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

export type FrontlineMap = {
  id: "seal" | "shatter" | "onsal" | "worqor" | "secure";
  name: string;
  shortName: string;
  subtitle: string;
};

type FrontlineSchedule = FrontlineMap & {
  cyclePosition: number;
};

const DAY_MS = 86_400_000;
const FRONTLINE_ANCHOR: CalendarDate = { year: 2026, month: 8, day: 14 };
const HOUSING_ANCHOR: CalendarDate = { year: 2026, month: 8, day: 13 };

export const FRONTLINE_MAPS: FrontlineMap[] = [
  { id: "seal", name: "シールロック", shortName: "シルロ", subtitle: "争奪戦" },
  { id: "shatter", name: "フィールド・オブ・グローリー", shortName: "砕氷", subtitle: "砕氷戦" },
  { id: "onsal", name: "オンサル・ハカイル", shortName: "オンサル", subtitle: "終節戦" },
  { id: "worqor", name: "ウォーコー・チーテ", shortName: "ウォコチテ", subtitle: "演習戦" },
  { id: "seal", name: "シールロック", shortName: "シルロ", subtitle: "争奪戦" },
  { id: "secure", name: "外縁遺跡群", shortName: "制圧", subtitle: "制圧戦" },
  { id: "onsal", name: "オンサル・ハカイル", shortName: "オンサル", subtitle: "終節戦" },
  { id: "worqor", name: "ウォーコー・チーテ", shortName: "ウォコチテ", subtitle: "演習戦" },
];

export const CC_SEASON = {
  number: 21,
  startedLabel: "2026年7月28日",
  jpDataCenter: "Elemental DC",
  officialUrl: "https://jp.finalfantasyxiv.com/lodestone/topics/detail/7723f9b3f09f687298ce18e840da72b72b5bec3b",
};

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function toUtcDate(date: CalendarDate): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day));
}

function fromUtcDate(date: Date): CalendarDate {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function daysBetween(from: CalendarDate, to: CalendarDate): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / DAY_MS);
}

export function addDays(date: CalendarDate, amount: number): CalendarDate {
  const result = toUtcDate(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return fromUtcDate(result);
}

export function getJstToday(now = new Date()): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

export function getFrontlineForDate(date: CalendarDate): FrontlineSchedule {
  const index = modulo(daysBetween(FRONTLINE_ANCHOR, date), FRONTLINE_MAPS.length);
  return { ...FRONTLINE_MAPS[index], cyclePosition: index + 1 };
}

export function getHousingCycle(date: CalendarDate) {
  const dayInCycle = modulo(daysBetween(HOUSING_ANCHOR, date), 9);
  const cycleStart = addDays(date, -dayInCycle);
  const isEntry = dayInCycle < 5;
  const phaseStart = isEntry ? cycleStart : addDays(cycleStart, 5);
  const phaseEnd = isEntry ? addDays(cycleStart, 4) : addDays(cycleStart, 8);
  const nextPhaseDate = addDays(phaseEnd, 1);

  return {
    phase: isEntry ? "entry" as const : "result" as const,
    phaseLabel: isEntry ? "応募期間" : "結果発表期間",
    phaseDay: isEntry ? dayInCycle + 1 : dayInCycle - 4,
    phaseLength: isEntry ? 5 : 4,
    rangeLabel: `${phaseStart.month}/${phaseStart.day} 0:00 — ${phaseEnd.month}/${phaseEnd.day} 23:59`,
    nextPhaseLabel: isEntry ? "結果発表" : "応募開始",
    nextPhaseDateLabel: `${nextPhaseDate.month}/${nextPhaseDate.day} 0:00`,
  };
}

export function getCalendarDays(month: CalendarDate): CalendarDate[] {
  const first = new Date(Date.UTC(month.year, month.month - 1, 1));
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    return fromUtcDate(date);
  });
}

export function formatDateKey(date: CalendarDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

export function formatJapaneseDate(date: CalendarDate): string {
  const weekday = WEEKDAY_LABELS[toUtcDate(date).getUTCDay()];
  return `${date.year}年 ${date.month}月${date.day}日（${weekday}）`;
}

export function getMonthTitle(date: CalendarDate): string {
  return `${date.year}年 ${String(date.month).padStart(2, "0")}月`;
}

export function isSameDate(left: CalendarDate, right: CalendarDate): boolean {
  return left.year === right.year && left.month === right.month && left.day === right.day;
}
