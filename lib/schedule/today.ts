import { TIMEZONE } from "../config";
import { kyivParts } from "../opening-hours";
import type { ISODate } from "./types";

export function todayInKyiv(instant: Date): ISODate {
  return kyivParts(instant).date;
}

const headerWeekday = new Intl.DateTimeFormat("uk-UA", { timeZone: TIMEZONE, weekday: "long" });
const headerDayMonth = new Intl.DateTimeFormat("uk-UA", { timeZone: TIMEZONE, day: "numeric", month: "long" });

export function formatTodayHeader(instant: Date): string {
  return `Сьогодні, ${headerWeekday.format(instant)} ${headerDayMonth.format(instant)}`;
}
