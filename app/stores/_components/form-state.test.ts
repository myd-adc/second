import { describe, expect, it } from "vitest";
import type { StoreWithDetails } from "@/lib/db/types";
import { validateStoreInput } from "@/lib/validate-store";
import { emptyFormState, formStateFromStore, newRuleState, toPayload } from "./form-state";

const TODAY = "2026-10-17"; // Saturday

describe("form-state", () => {
  it("new store defaults: seven open days 10:00-19:00", () => {
    const s = emptyFormState();
    expect(s.hours).toHaveLength(7);
    expect(s.hours.every((h) => !h.closed && h.opens === "10:00" && h.closes === "19:00")).toBe(true);
    expect(s.rules).toEqual([]);
  });

  it("empty state with a name round-trips through toPayload -> validateStoreInput", () => {
    const r = validateStoreInput(JSON.parse(JSON.stringify(toPayload({ ...emptyFormState(), name: "Бук" }))));
    expect(r.ok).toBe(true);
  });

  it("every_n_weeks derives weekday from the anchor date", () => {
    const state = {
      ...emptyFormState(),
      name: "Ласка",
      hours: emptyFormState().hours.map((h, i) => (i === 6 ? { ...h, closed: true } : h)),
      rules: [
        { ...newRuleState(TODAY, "a"), kind: "every_n_weeks" as const, intervalWeeks: "3", anchorDate: "2026-10-14", timeOfDay: "11:30" },
        { ...newRuleState(TODAY, "b"), kind: "monthly_nth" as const, weekday: 4, nth: "-1" },
        { ...newRuleState(TODAY, "c"), kind: "irregular" as const, weekday: 5, isActive: false },
        { ...newRuleState(TODAY, "d"), kind: "weekly" as const, weekday: 1, note: "вранці" },
      ],
    };
    const payload = JSON.parse(JSON.stringify(toPayload(state)));
    expect(payload.rules[0].rule).toEqual({ kind: "every_n_weeks", weekday: 2, intervalWeeks: 3, anchorDate: "2026-10-14" });
    const r = validateStoreInput(payload);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.rules[0].timeOfDay).toBe("11:30");
      expect(r.value.rules[1].rule).toEqual({ kind: "monthly_nth", weekday: 4, nth: -1 });
      expect(r.value.rules[2]).toMatchObject({ rule: { kind: "irregular" }, isActive: false });
      expect(r.value.hours[6]).toMatchObject({ isClosed: true, opens: null });
    }
  });

  it("new every_n_weeks rule defaults anchor to today; interval below 2 is rejected by the server validator", () => {
    const rule = { ...newRuleState(TODAY, "a"), kind: "every_n_weeks" as const, intervalWeeks: "1" };
    expect(rule.anchorDate).toBe(TODAY);
    expect(validateStoreInput(toPayload({ ...emptyFormState(), name: "x", rules: [rule] })).ok).toBe(false);
  });

  it("garbage anchor yields a validation error, not a crash", () => {
    const rule = { ...newRuleState(TODAY, "a"), kind: "every_n_weeks" as const, intervalWeeks: "2", anchorDate: "" };
    expect(validateStoreInput(toPayload({ ...emptyFormState(), name: "x", rules: [rule] })).ok).toBe(false);
  });

  it("formStateFromStore keeps all rules (incl. inactive), id, lat/lng; missing hours default open 10-19", () => {
    const store: StoreWithDetails = {
      id: "3f2b8c1e-5a4d-4e8f-9b0a-1c2d3e4f5a6b",
      name: "Бук",
      address: null,
      lat: 50.1,
      lng: 30.2,
      notes: "n",
      createdBy: "u",
      hours: [{ weekday: 0, opens: "08:00", closes: "20:00", isClosed: false }, { weekday: 6, opens: null, closes: null, isClosed: true }],
      rules: [
        { id: "r1", rule: { kind: "every_n_weeks", weekday: 2, intervalWeeks: 2, anchorDate: "2026-10-14" }, isActive: false, timeOfDay: "09:00", note: "" },
        { id: "r2", rule: { kind: "irregular" }, isActive: true, timeOfDay: null, note: "x" },
      ],
      events: [],
    };
    const s = formStateFromStore(store);
    expect(s.hours[0]).toMatchObject({ closed: false, opens: "08:00", closes: "20:00" });
    expect(s.hours[3]).toMatchObject({ closed: false, opens: "10:00", closes: "19:00" });
    expect(s.hours[6].closed).toBe(true);
    expect(s.rules).toHaveLength(2);
    expect(s.rules[0]).toMatchObject({ kind: "every_n_weeks", isActive: false, timeOfDay: "09:00" });
    const r = validateStoreInput(JSON.parse(JSON.stringify(toPayload(s))));
    expect(r.ok && r.value).toMatchObject({ id: store.id, lat: 50.1, lng: 30.2, address: null });
  });
});
