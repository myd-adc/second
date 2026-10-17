"use client";

import { useState, useTransition } from "react";
import { markDeliveryAction, type MarkResult } from "../actions";

export default function MarkButtons({ storeId, today }: { storeId: string; today: string }) {
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<MarkResult | null>(null);

  function mark(happened: boolean) {
    setResult(null);
    startTransition(async () => {
      try {
        const res = await markDeliveryAction(storeId, happened, date || today, note);
        setResult(res);
        if (res.ok) setNote("");
      } catch {
        setResult({ ok: false, error: "Не вдалося зберегти. Спробуй ще раз." });
      }
    });
  }

  return (
    <section className="mark" aria-label="Відмітити завіз">
      <div className="mark-buttons">
        <button type="button" className="btn-big btn-yes" disabled={pending} onClick={() => mark(true)}>
          Завіз був
        </button>
        <button type="button" className="btn-big btn-no" disabled={pending} onClick={() => mark(false)}>
          Завозу не було
        </button>
      </div>
      <div className="mark-fields">
        <label className="field">
          <span>Дата</span>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>Нотатка (необов’язково)</span>
          <input type="text" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      {result && !result.ok && (
        <p role="alert" className="mark-error">
          {result.error}
        </p>
      )}
      {result?.ok && (
        <p role="status" className="mark-ok">
          Збережено
        </p>
      )}
    </section>
  );
}
