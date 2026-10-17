"use client";

import { useState, useTransition } from "react";
import { deleteDeliveryAction } from "../actions";

/** Two-step «Скасувати» for the user's own journal entry (same pattern as DeleteStoreButton). */
export default function CancelMarkButton({ storeId, entryId }: { storeId: string; entryId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function cancel() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await deleteDeliveryAction(storeId, entryId);
        if (!res.ok) setError(res.error);
      } catch {
        setError("Не вдалося скасувати відмітку. Спробуй ще раз.");
      }
    });
  }

  return (
    <span className="cancel-mark">
      {confirming ? (
        <>
          <button type="button" className="btn-danger" disabled={pending} onClick={cancel}>
            Точно скасувати?
          </button>{" "}
          <button type="button" className="btn" disabled={pending} onClick={() => setConfirming(false)}>
            Ні
          </button>
        </>
      ) : (
        <button type="button" className="btn-danger-outline" onClick={() => setConfirming(true)}>
          Скасувати
        </button>
      )}
      {error && (
        <span role="alert" className="form-error">
          {" "}
          {error}
        </span>
      )}
    </span>
  );
}
