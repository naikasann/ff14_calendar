import type { OfficialEvent } from "./official-events";

const CALENDAR_TYPE_PRIORITY: Record<OfficialEvent["type"], number> = {
  maintenance: 0,
  patch: 1,
  pvp: 2,
  season: 3,
  event: 4,
  broadcast: 5,
  campaign: 6,
};

export function compareOfficialEventsForCalendar(left: OfficialEvent, right: OfficialEvent): number {
  return CALENDAR_TYPE_PRIORITY[left.type] - CALENDAR_TYPE_PRIORITY[right.type]
    || left.start.localeCompare(right.start)
    || left.id.localeCompare(right.id);
}
