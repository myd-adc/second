"use client";

import { useState, useTransition } from "react";
import { deleteStoreAction } from "../actions";

export default function DeleteStoreButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await deleteStoreAction(id); // redirects on success
        if (res && !res.ok) setError(res.error);
      } catch (err) {
        // redirect() surfaces as a framework-handled throw; rethrow anything else visibly
        if (err && typeof err === "object" && "digest" in err) throw err;
        setError("Не вдалося видалити магазин");
      }
    });
  }

  return (
    <div className="danger">
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {confirming ? (
        <div className="danger-row">
          <button type="button" className="btn-danger" disabled={pending} onClick={remove}>
            Точно видалити?
          </button>
          <button type="button" className="btn" disabled={pending} onClick={() => setConfirming(false)}>
            Скасувати
          </button>
        </div>
      ) : (
        <button type="button" className="btn-danger-outline" onClick={() => setConfirming(true)}>
          Видалити магазин
        </button>
      )}
    </div>
  );
}
