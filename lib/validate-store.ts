import type { DayHours } from "./opening-hours";
import type { StoreInput } from "./db/types";
import { validateRule } from "./schedule/validate";
import { isUuid } from "./uuid";

export type StoreParsed = { ok: true; value: StoreInput } | { ok: false; error: string };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_NAME = 120;
const MAX_ADDRESS = 300;
const MAX_NOTES = 1000;
const MAX_RULES = 10;
const MAX_RULE_NOTE = 200;

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isTime = (v: unknown): v is string => typeof v === "string" && TIME.test(v);

function optText(v: unknown, max: number, label: string): { ok: true; value: string | null } | Fail {
  if (v === undefined || v === null) return { ok: true, value: null };
  if (typeof v !== "string") return fail(`${label}: некоректне значення`);
  const t = v.trim();
  if (t.length > max) return fail(`${label} задовге (макс. ${max} символів)`);
  return { ok: true, value: t === "" ? null : t };
}

function parseHours(v: unknown): { ok: true; value: DayHours[] } | Fail {
  if (!Array.isArray(v) || v.length !== 7) return fail("Потрібні години роботи для всіх 7 днів");
  const byDay = new Map<number, DayHours>();
  for (const raw of v) {
    if (!isObj(raw)) return fail("Некоректні години роботи");
    const wd = raw.weekday;
    if (!Number.isInteger(wd) || (wd as number) < 0 || (wd as number) > 6)
      return fail("Некоректний день тижня в годинах роботи");
    if (byDay.has(wd as number)) return fail("День тижня повторюється в годинах роботи");
    if (typeof raw.isClosed !== "boolean") return fail("Некоректні години роботи");
    if (raw.isClosed) {
      byDay.set(wd as number, { weekday: wd as number, isClosed: true, opens: null, closes: null });
    } else {
      if (!isTime(raw.opens) || !isTime(raw.closes))
        return fail("Вкажи час відкриття і закриття у форматі ГГ:ХХ або познач день вихідним");
      byDay.set(wd as number, { weekday: wd as number, isClosed: false, opens: raw.opens, closes: raw.closes });
    }
  }
  return { ok: true, value: [0, 1, 2, 3, 4, 5, 6].map((d) => byDay.get(d) as DayHours) };
}

/** Validates the untrusted form payload on the server into a clean StoreInput. */
export function validateStoreInput(payload: unknown): StoreParsed {
  if (!isObj(payload)) return fail("Некоректні дані форми");
  const p = payload;

  if (typeof p.name !== "string") return fail("Вкажи назву магазину");
  const name = p.name.trim();
  if (name === "") return fail("Вкажи назву магазину");
  if (name.length > MAX_NAME) return fail(`Назва задовга (макс. ${MAX_NAME} символів)`);

  const address = optText(p.address, MAX_ADDRESS, "Адреса");
  if (!address.ok) return address;
  const notes = optText(p.notes, MAX_NOTES, "Нотатки");
  if (!notes.ok) return notes;

  let id: string | undefined;
  if (p.id !== undefined && p.id !== null) {
    if (typeof p.id !== "string" || !isUuid(p.id)) return fail("Некоректний магазин");
    id = p.id;
  }

  const hasLat = p.lat !== undefined && p.lat !== null;
  const hasLng = p.lng !== undefined && p.lng !== null;
  if (hasLat !== hasLng) return fail("Вкажи і широту, і довготу");
  let lat: number | null = null;
  let lng: number | null = null;
  if (hasLat && hasLng) {
    if (typeof p.lat !== "number" || !Number.isFinite(p.lat) || p.lat < -90 || p.lat > 90)
      return fail("Широта має бути числом від -90 до 90");
    if (typeof p.lng !== "number" || !Number.isFinite(p.lng) || p.lng < -180 || p.lng > 180)
      return fail("Довгота має бути числом від -180 до 180");
    lat = p.lat;
    lng = p.lng;
  }

  const hours = parseHours(p.hours);
  if (!hours.ok) return hours;

  if (!Array.isArray(p.rules)) return fail("Некоректні правила завозів");
  if (p.rules.length > MAX_RULES) return fail(`Забагато правил (макс. ${MAX_RULES})`);
  const rules: StoreInput["rules"] = [];
  for (const raw of p.rules) {
    if (!isObj(raw)) return fail("Некоректне правило");
    const rule = validateRule(raw.rule);
    if (!rule.ok) return rule;
    if (raw.isActive !== undefined && typeof raw.isActive !== "boolean") return fail("Некоректне правило");
    const timeOfDay = raw.timeOfDay ?? null;
    if (timeOfDay !== null && !isTime(timeOfDay)) return fail("Некоректний час «зазвичай о» (ГГ:ХХ)");
    const note = raw.note ?? "";
    if (typeof note !== "string") return fail("Некоректна нотатка правила");
    if (note.length > MAX_RULE_NOTE) return fail(`Нотатка правила задовга (макс. ${MAX_RULE_NOTE} символів)`);
    rules.push({
      rule: rule.rule,
      isActive: raw.isActive ?? true,
      timeOfDay: timeOfDay as string | null,
      note: note.trim(),
    });
  }

  const value: StoreInput = {
    name,
    address: address.value,
    lat,
    lng,
    notes: notes.value,
    hours: hours.value,
    rules,
  };
  if (id) value.id = id;
  return { ok: true, value };
}
