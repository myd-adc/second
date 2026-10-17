import { signOut } from "./actions";

export default function NoAccessPage() {
  return (
    <main>
      <h1>Немає доступу</h1>
      <p>Тебе немає в списку доступу. Попроси автора додати твій email.</p>
      <form action={signOut}>
        <button type="submit">Вийти</button>
      </form>
    </main>
  );
}
