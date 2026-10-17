"use server";

import { revalidatePath } from "next/cache";
import { deleteDelivery, markDelivery } from "@/lib/db/events";
import { parseDeleteInput, parseMarkInput } from "@/lib/mark-input";
import { todayInKyiv } from "@/lib/schedule/today";
import type { ISODate } from "@/lib/schedule/types";

export type MarkResult = { ok: true } | { ok: false; error: string };

export async function markDeliveryAction(
  storeId: string,
  happened: boolean,
  date?: ISODate,
  note?: string,
): Promise<MarkResult> {
  if (typeof happened !== "boolean") return { ok: false, error: "Некоректна відмітка" };
  const parsed = parseMarkInput({ storeId, date, note }, todayInKyiv(new Date()));
  if (!parsed.ok) return parsed;
  try {
    await markDelivery(parsed.value.storeId, parsed.value.date, happened, parsed.value.note ?? undefined);
  } catch (err) {
    console.error("markDeliveryAction failed", err);
    return { ok: false, error: "Не вдалося зберегти. Спробуй ще раз." };
  }
  revalidatePath("/");
  revalidatePath(`/stores/${parsed.value.storeId}`);
  return { ok: true };
}

/** Undo the signed-in user's own mark. Never throws to the client. */
export async function deleteDeliveryAction(storeId: string, entryId: string): Promise<MarkResult> {
  const parsed = parseDeleteInput(storeId, entryId);
  if (!parsed.ok) return parsed;
  try {
    await deleteDelivery(parsed.value.entryId);
  } catch (err) {
    console.error("deleteDeliveryAction failed", err);
    return { ok: false, error: "Не вдалося скасувати відмітку. Спробуй ще раз." };
  }
  revalidatePath("/");
  revalidatePath(`/stores/${parsed.value.storeId}`);
  return { ok: true };
}
