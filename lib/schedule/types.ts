export type ISODate = string;

export type Rule =
  | { kind: "weekly"; weekday: number }
  | { kind: "every_n_weeks"; weekday: number; intervalWeeks: number; anchorDate: ISODate }
  | { kind: "monthly_nth"; weekday: number; nth: 1 | 2 | 3 | 4 | -1 }
  | { kind: "irregular" };

export type DeliveryEvent = { date: ISODate; happened: boolean };
