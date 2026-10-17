import type { ISODate } from "./schedule/types";

export type MarkInput = { storeId: string; date?: string; note?: string };
export type MarkParsed =
  | { ok: true; value: { storeId: string; date: ISODate; note: string | null } }
  | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
export const MAX_NOTE = 200;

export function isUuid(s: string): boolean {
  return UUID.test(s);
}

function isRealDate(s: string): boolean {
  const m = ISO.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function parseMarkInput(input: MarkInput, today: ISODate): MarkParsed {
  if (!isUuid(input.storeId)) return { ok: false, error: "Некоректний магазин" };
  const date = input.date ?? today;
  if (!isRealDate(date)) return { ok: false, error: "Некоректна дата" };
  if (date > today) return { ok: false, error: "Дата не може бути в майбутньому" };
  const trimmed = (input.note ?? "").trim();
  if (trimmed.length > MAX_NOTE) return { ok: false, error: "Нотатка задовга (макс. 200 символів)" };
  return { ok: true, value: { storeId: input.storeId, date, note: trimmed === "" ? null : trimmed } };
}
