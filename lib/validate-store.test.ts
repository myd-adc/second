import { describe, expect, it } from "vitest";
import { validateStoreInput } from "./validate-store";

const ID = "3f2b8c1e-5a4d-4e8f-9b0a-1c2d3e4f5a6b";
const hours = (over: Record<number, unknown> = {}) =>
  Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    isClosed: false,
    opens: "10:00",
    closes: "19:00",
    ...((over[weekday] as object) ?? {}),
  }));
const base = (over: Record<string, unknown> = {}) => ({ name: "Second Hand", hours: hours(), rules: [], ...over });
const err = (p: unknown) => {
  const r = validateStoreInput(p);
  expect(r.ok).toBe(false);
  return r.ok ? "" : r.error;
};

describe("validateStoreInput", () => {
  it("accepts a minimal store with no rules (schedule-less store is valid)", () => {
    const r = validateStoreInput(base());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.rules).toEqual([]);
      expect(r.value.address).toBeNull();
      expect(r.value.notes).toBeNull();
      expect(r.value.lat).toBeNull();
      expect(r.value.lng).toBeNull();
      expect(r.value.id).toBeUndefined();
      expect(r.value.hours).toHaveLength(7);
    }
  });
  it("trims; empty address/notes become null", () => {
    const r = validateStoreInput(base({ name: "  Х  ", address: "  ", notes: " n " }));
    expect(r.ok && r.value).toMatchObject({ name: "Х", address: null, notes: "n" });
  });
  it("name required and ≤120", () => {
    err(base({ name: "   " }));
    err(base({ name: 5 }));
    err(base({ name: "a".repeat(121) }));
    expect(validateStoreInput(base({ name: "a".repeat(120) })).ok).toBe(true);
  });
  it("address ≤300, notes ≤1000", () => {
    err(base({ address: "a".repeat(301) }));
    err(base({ notes: "a".repeat(1001) }));
    expect(validateStoreInput(base({ address: "a".repeat(300), notes: "a".repeat(1000) })).ok).toBe(true);
  });
  it("id must be a UUID when present", () => {
    err(base({ id: "nope" }));
    const r = validateStoreInput(base({ id: ID }));
    expect(r.ok && r.value.id).toBe(ID);
  });
  it("lat/lng both or neither, in range", () => {
    err(base({ lat: 10 }));
    err(base({ lng: 10 }));
    err(base({ lat: 91, lng: 0 }));
    err(base({ lat: 0, lng: 181 }));
    err(base({ lat: Number.NaN, lng: 0 }));
    err(base({ lat: "1", lng: 0 }));
    const r = validateStoreInput(base({ lat: 50.45, lng: 30.52 }));
    expect(r.ok && r.value).toMatchObject({ lat: 50.45, lng: 30.52 });
  });
  it("hours: exactly 7, each weekday once", () => {
    err(base({ hours: hours().slice(0, 6) }));
    err(base({ hours: [...hours(), hours()[0]] }));
    err(base({ hours: hours({ 6: { weekday: 0 } }) }));
    err(base({ hours: hours({ 1: { weekday: 7 } }) }));
    err(base({ hours: "x" }));
  });
  it("hours normalised to weekday order", () => {
    const r = validateStoreInput(base({ hours: hours().reverse() }));
    expect(r.ok && r.value.hours.map((h) => h.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
  it("closed day nulls the times; open day needs valid times", () => {
    const r = validateStoreInput(base({ hours: hours({ 6: { isClosed: true } }) }));
    expect(r.ok && r.value.hours[6]).toEqual({ weekday: 6, isClosed: true, opens: null, closes: null });
    err(base({ hours: hours({ 0: { opens: null } }) }));
    err(base({ hours: hours({ 0: { closes: "" } }) }));
    err(base({ hours: hours({ 0: { opens: "24:00" } }) }));
    err(base({ hours: hours({ 0: { opens: "9:00" } }) }));
    err(base({ hours: hours({ 0: { closes: "10:60" } }) }));
    err(base({ hours: hours({ 0: { isClosed: "no" } }) }));
  });
  it("overnight (closes <= opens) is allowed", () => {
    expect(validateStoreInput(base({ hours: hours({ 4: { opens: "18:00", closes: "02:00" } }) })).ok).toBe(true);
    expect(validateStoreInput(base({ hours: hours({ 4: { opens: "10:00", closes: "10:00" } }) })).ok).toBe(true);
  });
  it("rules: irregular valid, saved with no weekday", () => {
    const r = validateStoreInput(base({ rules: [{ rule: { kind: "irregular" } }] }));
    expect(r.ok && r.value.rules).toEqual([
      { rule: { kind: "irregular" }, isActive: true, timeOfDay: null, note: "" },
    ]);
  });
  it("rules: defaults and fields", () => {
    const r = validateStoreInput(
      base({ rules: [{ rule: { kind: "weekly", weekday: 1 }, isActive: false, timeOfDay: "12:30", note: "x" }] }),
    );
    expect(r.ok && r.value.rules[0]).toEqual({
      rule: { kind: "weekly", weekday: 1 },
      isActive: false,
      timeOfDay: "12:30",
      note: "x",
    });
  });
  it("rules: rejects bad rule, isActive, timeOfDay, note, >10", () => {
    err(base({ rules: [{ rule: { kind: "weekly", weekday: 9 } }] }));
    err(base({ rules: [{ rule: { kind: "irregular" }, isActive: "yes" }] }));
    err(base({ rules: [{ rule: { kind: "irregular" }, timeOfDay: "25:00" }] }));
    err(base({ rules: [{ rule: { kind: "irregular" }, note: "a".repeat(201) }] }));
    err(base({ rules: Array.from({ length: 11 }, () => ({ rule: { kind: "irregular" } })) }));
    err(base({ rules: "x" }));
    err(base({ rules: [null] }));
    expect(validateStoreInput(base({ rules: Array.from({ length: 10 }, () => ({ rule: { kind: "irregular" } })) })).ok).toBe(true);
  });
  it("rejects non-object payloads", () => {
    err(null);
    err("x");
    err([]);
  });
});
