"use client";

import { useActionState } from "react";
import { signInWithEmail, verifyCodeAction, type LoginState, type VerifyState } from "./actions";

const initial: LoginState = { status: "idle" };
const initialVerify: VerifyState = { error: null };

function CodeForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(verifyCodeAction, initialVerify);
  return (
    <form action={action}>
      <input type="hidden" name="email" value={email} />
      <label htmlFor="token">Або введи код з листа</label>
      <input
        id="token"
        name="token"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        required
      />
      <button type="submit" disabled={pending}>
        {pending ? "Перевіряємо…" : "Увійти з кодом"}
      </button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState(signInWithEmail, initial);

  if (state.status === "sent") {
    return (
      <>
        <p role="status">Перевір пошту — ми надіслали посилання для входу</p>
        <CodeForm email={state.email} />
      </>
    );
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
