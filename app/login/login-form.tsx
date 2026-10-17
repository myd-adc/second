"use client";

import { useActionState } from "react";
import { signInWithEmail, type LoginState } from "./actions";

const initial: LoginState = { status: "idle" };

export function LoginForm() {
  const [state, action, pending] = useActionState(signInWithEmail, initial);

  if (state.status === "sent") {
    return <p role="status">Перевір пошту — ми надіслали посилання для входу</p>;
  }

  return (
    <form action={action}>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required autoComplete="email" />
      <button type="submit" disabled={pending}>
        {pending ? "Надсилаємо…" : "Отримати посилання"}
      </button>
      {state.status === "error" && <p role="alert">{state.message}</p>}
    </form>
  );
}
