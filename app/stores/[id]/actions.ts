"use server";

import { revalidatePath } from "next/cache";
import { markDelivery } from "@/lib/db/events";
import { parseMarkInput } from "@/lib/mark-input";
import { todayInKyiv } from "@/lib/schedule/today";
import type { ISODate } from "@/lib/schedule/types";

export type MarkResult = { ok: true } | { ok: false; error: string };

export async function markDeliveryAction(
  storeId: string,
  happened: boolean,
  date?: ISODate,
  note?: string,
): Promise<MarkResult> {
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
