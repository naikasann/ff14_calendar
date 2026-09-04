import officialEventData from "../public/data/official-events.json";

import { formatDateKey, type CalendarDate } from "./schedule";

export type OfficialEventType = "maintenance" | "patch" | "pvp" | "season" | "event" | "broadcast" | "campaign";

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

export type OfficialEventSummary = {
  label: string;
  title: string;
  type: OfficialEventType | "update";
  combinedCount: number;
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
  return OFFICIAL_EVENTS.filter((event) => {
    const startDate = event.start.slice(0, 10);
    const endDate = event.end.slice(0, 10);
    return event.allDay
      ? dateKey >= startDate && dateKey < endDate
      : dateKey >= startDate && dateKey <= endDate;
  });
}

function getCompactEventTitle(event: OfficialEvent): string {
  if (event.type === "pvp") {
    return event.title.replace(/^PvPシリーズ/, "PvP").replace(/予定$/, "");
  }
  if (event.type === "season") {
    return event.title.replace(/^クリコン\s*/, "").replace(/予定$/, "");
  }
  return event.title;
}

export function summarizeOfficialEvents(events: OfficialEvent[]): OfficialEventSummary | undefined {
  if (events.length === 0) return undefined;

  const maintenance = events.find((event) => event.type === "maintenance");
  const patch = events.find((event) => event.type === "patch");
  const pvpEvents = events.filter((event) => event.type === "pvp" || event.type === "season");

  if (maintenance && (patch || pvpEvents.length > 0)) {
    const versionSource = [patch?.title, ...pvpEvents.map((event) => `${event.title} ${event.description}`)]
      .filter(Boolean)
      .join(" ");
    const version = versionSource.match(/(?:パッチ)?(\d+\.\d+)/)?.[1];
    const parts = [version ? `${version}更新・メンテ` : "更新メンテ", ...pvpEvents.map(getCompactEventTitle)];
    return {
      label: "更新",
      title: parts.join(" / "),
      type: "update",
      combinedCount: events.length,
    };
  }

  const first = events[0];
  return {
    label: getOfficialEventTypeLabel(first.type),
    title: getCompactEventTitle(first),
    type: first.type,
    combinedCount: 1,
  };
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
    event: "イベント",
    broadcast: "放送",
    campaign: "企画",
  };
  return labels[type];
}
