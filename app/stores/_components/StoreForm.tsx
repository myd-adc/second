"use client";

import { useActionState, useId, useState } from "react";
import { weekdayOf } from "@/lib/schedule/dates";
import type { ISODate } from "@/lib/schedule/types";
import { saveStoreAction, type ActionResult } from "../actions";
import LocationPicker from "./LocationPicker";
import {
  emptyFormState,
  newRuleState,
  toPayload,
  type FormState,
  type HoursState,
  type RuleKind,
  type RuleState,
} from "./form-state";

const DAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "нд"];
const KINDS: Array<{ value: RuleKind; label: string }> = [
  { value: "weekly", label: "щотижня" },
  { value: "every_n_weeks", label: "кожні N тижнів" },
  { value: "monthly_nth", label: "n-й день місяця" },
  { value: "irregular", label: "без графіка" },
];
const NTHS = [
  { value: "1", label: "1-й" },
  { value: "2", label: "2-й" },
  { value: "3", label: "3-й" },
  { value: "4", label: "4-й" },
  { value: "-1", label: "останній" },
];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function WeekdaySelect({ id, value, onChange }: { id: string; value: number; onChange: (v: number) => void }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {DAYS.map((d, i) => (
        <option key={d} value={i}>
          {d}
        </option>
      ))}
    </select>
  );
}

function RuleEditor({
  rule,
  index,
  onChange,
  onRemove,
}: {
  rule: RuleState;
  index: number;
  onChange: (patch: Partial<RuleState>) => void;
  onRemove: () => void;
}) {
  const uid = useId();
  const f = (name: string) => `${uid}-${name}`;
  return (
    <fieldset className="rule">
      <legend>Правило {index + 1}</legend>
      <div className="field">
        <label htmlFor={f("kind")}>Тип</label>
        <select id={f("kind")} value={rule.kind} onChange={(e) => onChange({ kind: e.target.value as RuleKind })}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>

      {(rule.kind === "weekly" || rule.kind === "monthly_nth") && (
        <div className="field">
          <label htmlFor={f("weekday")}>День тижня</label>
          <WeekdaySelect id={f("weekday")} value={rule.weekday} onChange={(weekday) => onChange({ weekday })} />
        </div>
      )}

      {rule.kind === "monthly_nth" && (
        <div className="field">
          <label htmlFor={f("nth")}>Який за рахунком</label>
          <select id={f("nth")} value={rule.nth} onChange={(e) => onChange({ nth: e.target.value })}>
            {NTHS.map((n) => (
              <option key={n.value} value={n.value}>
                {n.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {rule.kind === "every_n_weeks" && (
        <>
          <div className="field">
            <label htmlFor={f("interval")}>Раз на скільки тижнів (2–8)</label>
            <input
              id={f("interval")}
              type="number"
              inputMode="numeric"
              min={2}
              max={8}
              step={1}
              value={rule.intervalWeeks}
              onChange={(e) => onChange({ intervalWeeks: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor={f("anchor")}>Опорна дата завозу</label>
            <input
              id={f("anchor")}
              type="date"
              value={rule.anchorDate}
              onChange={(e) => onChange({ anchorDate: e.target.value })}
            />
            <span className="row-meta">
              день тижня: {ISO.test(rule.anchorDate) ? DAYS[weekdayOf(rule.anchorDate)] : "—"}
            </span>
          </div>
        </>
      )}

      {rule.kind === "irregular" && (
        <p className="row-meta">Без графіка: прогноз будується з журналу підтверджень</p>
      )}

      <div className="field">
        <label htmlFor={f("time")}>зазвичай о (необов’язково)</label>
        <input id={f("time")} type="time" value={rule.timeOfDay} onChange={(e) => onChange({ timeOfDay: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor={f("note")}>Нотатка (необов’язково)</label>
        <input
          id={f("note")}
          type="text"
          maxLength={200}
          value={rule.note}
          onChange={(e) => onChange({ note: e.target.value })}
        />
      </div>
      <label className="check">
        <input type="checkbox" checked={rule.isActive} onChange={(e) => onChange({ isActive: e.target.checked })} />
        <span>активне</span>
      </label>
      <button type="button" className="btn-danger-outline" onClick={onRemove}>
        Видалити правило
      </button>
    </fieldset>
  );
}

export default function StoreForm({ initial, today }: { initial?: FormState; today: ISODate }) {
  const [state, setState] = useState<FormState>(initial ?? emptyFormState());
  const [nextKey, setNextKey] = useState(1000);
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(saveStoreAction, null);
  const uid = useId();

  const patch = (p: Partial<FormState>) => setState((s) => ({ ...s, ...p }));
  const patchHours = (i: number, p: Partial<HoursState>) =>
    setState((s) => ({ ...s, hours: s.hours.map((h, j) => (j === i ? { ...h, ...p } : h)) }));
  const patchRule = (key: string, p: Partial<RuleState>) =>
    setState((s) => ({ ...s, rules: s.rules.map((r) => (r.key === key ? { ...r, ...p } : r)) }));

  function addRule() {
    setState((s) => ({ ...s, rules: [...s.rules, newRuleState(today, `n${nextKey}`)] }));
    setNextKey((k) => k + 1);
  }

  return (
    <form action={action} className="form">
      <input type="hidden" name="payload" value={JSON.stringify(toPayload(state))} />

      <div className="field">
        <label htmlFor={`${uid}-name`}>Назва *</label>
        <input
          id={`${uid}-name`}
          type="text"
          required
          maxLength={120}
          value={state.name}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={`${uid}-address`}>Адреса</label>
        <input
          id={`${uid}-address`}
          type="text"
          maxLength={300}
          value={state.address}
          onChange={(e) => patch({ address: e.target.value })}
        />
      </div>

      <LocationPicker
        address={state.address}
        coordinates={state.coordinates}
        onChange={(coordinates) => patch({ coordinates })}
      />
      <div className="field">
        <label htmlFor={`${uid}-notes`}>Нотатки</label>
        <textarea
          id={`${uid}-notes`}
          rows={3}
          maxLength={1000}
          value={state.notes}
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </div>

      <h2>Години роботи</h2>
      <ul className="plain hours-edit">
        {DAYS.map((d, i) => {
          const h = state.hours[i];
          return (
            <li key={d} className="hours-row">
              <span className="hours-day">{d}</span>
              <label className="check">
                <input type="checkbox" checked={h.closed} onChange={(e) => patchHours(i, { closed: e.target.checked })} />
                <span>вихідний</span>
              </label>
              <label className="visually-hidden" htmlFor={`${uid}-o${i}`}>
                {d}: відкриття
              </label>
              <input
                id={`${uid}-o${i}`}
                type="time"
                disabled={h.closed}
                required={!h.closed}
                value={h.opens}
                onChange={(e) => patchHours(i, { opens: e.target.value })}
              />
              <label className="visually-hidden" htmlFor={`${uid}-c${i}`}>
                {d}: закриття
              </label>
              <input
                id={`${uid}-c${i}`}
                type="time"
                disabled={h.closed}
                required={!h.closed}
                value={h.closes}
                onChange={(e) => patchHours(i, { closes: e.target.value })}
              />
            </li>
          );
        })}
      </ul>

      <h2>Графік завозів</h2>
      {state.rules.length === 0 && <p className="row-meta">Правил немає — магазин буде «без графіка».</p>}
      {state.rules.map((r, i) => (
        <RuleEditor
          key={r.key}
          rule={r}
          index={i}
          onChange={(p) => patchRule(r.key, p)}
          onRemove={() => setState((s) => ({ ...s, rules: s.rules.filter((x) => x.key !== r.key) }))}
        />
      ))}
      {state.rules.length < 10 && (
        <button type="button" className="btn" onClick={addRule}>
          + Додати правило
        </button>
      )}

      {result && !result.ok && (
        <p role="alert" className="form-error">
          {result.error}
        </p>
      )}
      <button type="submit" className="btn-big btn-yes" disabled={pending}>
        {pending ? "Зберігаю…" : "Зберегти"}
      </button>
    </form>
  );
}
