import { kyivParts } from "../opening-hours";
import type { ISODate } from "./types";

export function todayInKyiv(instant: Date): ISODate {
  return kyivParts(instant).date;
}
