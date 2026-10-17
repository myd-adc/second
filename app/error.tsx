"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="page notice">
      <h1>Щось пішло не так</h1>
      <p>Не вдалося завантажити дані. Перевір зв&apos;язок і спробуй ще раз.</p>
      <button type="button" className="btn" onClick={reset}>
        Спробувати ще раз
      </button>
      {error.digest && <p className="code">Код: {error.digest}</p>}
    </main>
  );
}
