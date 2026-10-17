import { describe, expect, it } from "vitest";
import { parseDeleteInput, parseMarkInput } from "./mark-input";

const ID = "3f2b8c1e-5a4d-4e8f-9b0a-1c2d3e4f5a6b";
const TODAY = "2026-10-17";

describe("parseMarkInput", () => {
  it("defaults date to today and note to null", () => {
    expect(parseMarkInput({ storeId: ID }, TODAY)).toEqual({
      ok: true,
      value: { storeId: ID, date: TODAY, note: null },
    });
  });
  it("accepts uppercase UUIDs and any version", () => {
    expect(parseMarkInput({ storeId: ID.toUpperCase() }, TODAY).ok).toBe(true);
    expect(parseMarkInput({ storeId: "00000000-0000-1000-8000-000000000000" }, TODAY).ok).toBe(true);
  });
  it("rejects a bad store id", () => {
    expect(parseMarkInput({ storeId: "abc" }, TODAY)).toEqual({ ok: false, error: "Некоректний магазин" });
    expect(parseMarkInput({ storeId: "" }, TODAY)).toEqual({ ok: false, error: "Некоректний магазин" });
  });
  it("rejects malformed and non-existent dates", () => {
    for (const date of ["17.10.2026", "2026-2-3", "2026-02-30", "2026-13-01", "nope"]) {
      expect(parseMarkInput({ storeId: ID, date }, TODAY)).toEqual({ ok: false, error: "Некоректна дата" });
    }
  });
  it("accepts a leap day and today, rejects the future", () => {
    expect(parseMarkInput({ storeId: ID, date: "2024-02-29" }, TODAY).ok).toBe(true);
    expect(parseMarkInput({ storeId: ID, date: TODAY }, TODAY).ok).toBe(true);
    expect(parseMarkInput({ storeId: ID, date: "2026-10-18" }, TODAY)).toEqual({
      ok: false,
      error: "Дата не може бути в майбутньому",
    });
  });
  it("trims the note, maps empty to null, caps at 200", () => {
    expect(parseMarkInput({ storeId: ID, note: "  привіт  " }, TODAY)).toMatchObject({ value: { note: "привіт" } });
    expect(parseMarkInput({ storeId: ID, note: "   " }, TODAY)).toMatchObject({ value: { note: null } });
    expect(parseMarkInput({ storeId: ID, note: "a".repeat(200) }, TODAY).ok).toBe(true);
    expect(parseMarkInput({ storeId: ID, note: "a".repeat(201) }, TODAY)).toEqual({
      ok: false,
      error: "Нотатка задовга (макс. 200 символів)",
    });
  });
});

describe("parseDeleteInput", () => {
  it("accepts two UUIDs", () => {
    expect(parseDeleteInput(ID, ID.toUpperCase())).toEqual({ ok: true, value: { storeId: ID, entryId: ID.toUpperCase() } });
  });
  it("rejects a bad store id or entry id with a Ukrainian message", () => {
    expect(parseDeleteInput("nope", ID)).toEqual({ ok: false, error: "Некоректний магазин" });
    expect(parseDeleteInput(ID, "nope")).toEqual({ ok: false, error: "Некоректний запис" });
    expect(parseDeleteInput(ID, undefined)).toEqual({ ok: false, error: "Некоректний запис" });
    expect(parseDeleteInput(null, ID).ok).toBe(false);
  });
});
