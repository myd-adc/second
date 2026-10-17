import { weekdayOf } from "./dates";
import type { Rule } from "./types";

export type RuleResult = { ok: true; rule: Rule } | { ok: false; error: string };

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRealDate(s: string): boolean {
  const m = ISO.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

const fail = (error: string): RuleResult => ({ ok: false, error });
const isWeekday = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 6;

/** Validates untrusted input into a clean Rule (unknown fields are dropped). */
export function validateRule(input: unknown): RuleResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return fail("Некоректне правило");
  const o = input as Record<string, unknown>;

  switch (o.kind) {
    case "weekly":
      if (!isWeekday(o.weekday)) return fail("Некоректний день тижня");
      return { ok: true, rule: { kind: "weekly", weekday: o.weekday } };
    case "every_n_weeks": {
      if (!isWeekday(o.weekday)) return fail("Некоректний день тижня");
      // upper bound: fetchEvents' history window must cover 5 occurrences (5 x 8 weeks), and keeps the smallint column safe
      if (!Number.isInteger(o.intervalWeeks) || (o.intervalWeeks as number) < 2 || (o.intervalWeeks as number) > 8)
        return fail("Інтервал має бути цілим числом від 2 до 8 тижнів");
      if (typeof o.anchorDate !== "string" || !isRealDate(o.anchorDate))
        return fail("Вкажи коректну опорну дату");
      if (weekdayOf(o.anchorDate) !== o.weekday)
        return fail("Опорна дата має припадати на вибраний день тижня");
      return {
        ok: true,
        rule: {
          kind: "every_n_weeks",
          weekday: o.weekday,
          intervalWeeks: o.intervalWeeks as number,
          anchorDate: o.anchorDate,
        },
      };
    }
    case "monthly_nth": {
      if (!isWeekday(o.weekday)) return fail("Некоректний день тижня");
      if (![1, 2, 3, 4, -1].includes(o.nth as number)) return fail("Некоректний номер дня в місяці");
      return { ok: true, rule: { kind: "monthly_nth", weekday: o.weekday, nth: o.nth as 1 | 2 | 3 | 4 | -1 } };
    }
    case "irregular":
      if (o.weekday !== undefined && o.weekday !== null) return fail("Правило без графіка не має дня тижня");
      return { ok: true, rule: { kind: "irregular" } };
    default:
      return fail("Невідомий тип правила");
  }
}
