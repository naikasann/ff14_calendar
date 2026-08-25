import officialEventData from "../public/data/official-events.json";

import { formatDateKey, type CalendarDate } from "./schedule";

export type OfficialEventType = "maintenance" | "patch" | "pvp" | "season";

export type OfficialEvent = {
  id: string;
  type: OfficialEventType;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  description: string;
  url: string;
};

type OfficialEventFile = {
  generatedAt: string | null;
  events: OfficialEvent[];
};

const data = officialEventData as OfficialEventFile;

export const OFFICIAL_EVENTS = data.events;
export const OFFICIAL_EVENTS_UPDATED_AT = data.generatedAt;

export function getOfficialEventsForDate(date: CalendarDate): OfficialEvent[] {
  const dateKey = formatDateKey(date);
  return OFFICIAL_EVENTS.filter((event) => event.start.slice(0, 10) === dateKey);
}

export function getUpcomingOfficialEvents(today: CalendarDate, limit = 6): OfficialEvent[] {
  const todayKey = formatDateKey(today);
  return OFFICIAL_EVENTS
    .filter((event) => event.end.slice(0, 10) >= todayKey)
    .sort((left, right) => left.start.localeCompare(right.start))
    .slice(0, limit);
}

export function getCurrentPvpSeriesEvent(today: CalendarDate): OfficialEvent | undefined {
  const todayKey = formatDateKey(today);
  return OFFICIAL_EVENTS.find((event) => event.type === "pvp" && event.end.slice(0, 10) >= todayKey);
}

export function getOfficialEventTypeLabel(type: OfficialEventType): string {
  const labels: Record<OfficialEventType, string> = {
    maintenance: "メンテ",
    patch: "パッチ",
    pvp: "PvP",
    season: "クリコン",
  };
  return labels[type];
}
