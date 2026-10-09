import type { OfficialEvent } from "./official-events";

const ENDING_SOON_MS = 3 * 24 * 60 * 60 * 1000;

export function getOfficialEventStatus(event: OfficialEvent, now: number | null): "開催中" | "終了間近" | undefined {
  if (now === null || event.type === "maintenance" || event.type === "broadcast" || event.type === "patch") return undefined;
  const start = Date.parse(event.allDay ? `${event.start}T00:00:00+09:00` : event.start);
  const end = Date.parse(event.allDay ? `${event.end}T00:00:00+09:00` : event.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || now >= end) return undefined;
  if (end - now <= ENDING_SOON_MS) return "終了間近";
  return now >= start ? "開催中" : undefined;
}

export function getOfficialEventLastDate(event: OfficialEvent): string {
  if (!event.allDay) return event.end.slice(0, 10);
  // All-day events use an exclusive end; show the marker on the previous JST date.
  return new Date(Date.parse(`${event.end}T00:00:00Z`) - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function getFeaturedCalendarEvents(events: OfficialEvent[], dateKey: string): OfficialEvent[] {
  const priority = (event: OfficialEvent) => event.type === "maintenance" ? 0 : event.type === "broadcast" ? 1 : 2;
  return events.filter((event) =>
    event.type === "maintenance" || event.type === "broadcast" || event.type === "patch"
    || event.start.slice(0, 10) === dateKey || getOfficialEventLastDate(event) === dateKey)
    .sort((left, right) => priority(left) - priority(right));
}

export function getCalendarBoundaryLabel(event: OfficialEvent, dateKey: string): "開始" | "終了" | undefined {
  if (["maintenance", "broadcast", "patch"].includes(event.type)) return undefined;
  const startDate = event.start.slice(0, 10);
  const lastDate = getOfficialEventLastDate(event);
  if (startDate === lastDate) return undefined;
  return dateKey === startDate ? "開始" : dateKey === lastDate ? "終了" : undefined;
}
