import type { DayHours } from "./index";

/** Human text for one weekday's hours: "10:00–19:00", "вихідний", "немає даних". */
export function formatDayHours(h: DayHours | undefined): string {
  if (!h) return "немає даних";
  if (h.isClosed) return "вихідний";
  if (h.opens === null || h.closes === null) return "немає даних";
  return `${h.opens}–${h.closes}`;
}
