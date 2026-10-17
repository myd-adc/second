import type { DayHours } from "../opening-hours";
import type { DeliveryEvent, ISODate, Rule } from "../schedule/types";

export type RuleRow = {
  id: string;
  rule: Rule;
  isActive: boolean;
  timeOfDay: string | null;
  note: string;
};

export type StoreWithDetails = {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  createdBy: string;
  hours: DayHours[];
  rules: RuleRow[];
  events: DeliveryEvent[];
};

export type StoreInput = {
  id?: string;
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
  hours: DayHours[];
  rules: Array<{ rule: Rule; isActive: boolean; timeOfDay?: string | null; note?: string }>;
};

export type JournalEntry = {
  id: string;
  date: ISODate;
  happened: boolean;
  note: string | null;
  reporterName: string;
  reportedByMe: boolean;
};
