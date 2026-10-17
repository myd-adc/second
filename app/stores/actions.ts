"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { deleteStore, saveStore } from "@/lib/db/stores";
import { validateStoreInput } from "@/lib/validate-store";
import { isUuid } from "@/lib/uuid";

export type ActionResult = { ok: true } | { ok: false; error: string };

const SAVE_FAILED = "Не вдалося зберегти. Спробуй ще раз.";
const DELETE_FAILED = "Не вдалося видалити магазин";

/** useActionState-compatible: (previous result, form data). Redirects on success. */
export async function saveStoreAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const raw = formData.get("payload");
  if (typeof raw !== "string") return { ok: false, error: SAVE_FAILED };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
  const parsed = validateStoreInput(json);
  if (!parsed.ok) return parsed;

  let id: string;
  try {
    id = await saveStore(parsed.value);
  } catch (err) {
    console.error("saveStoreAction failed", err);
    return { ok: false, error: SAVE_FAILED };
  }
  revalidatePath("/");
  revalidatePath("/stores");
  revalidatePath(`/stores/${id}`);
  redirect(`/stores/${id}`);
}

export async function deleteStoreAction(id: string): Promise<ActionResult> {
  if (typeof id !== "string" || !isUuid(id)) return { ok: false, error: DELETE_FAILED };
  try {
    await deleteStore(id);
  } catch (err) {
    console.error("deleteStoreAction failed", err);
    return { ok: false, error: DELETE_FAILED };
  }
  revalidatePath("/");
  revalidatePath("/stores");
  redirect("/stores");
}
