import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main>
      <h1>Вхід</h1>
      {error && <p role="alert">Не вдалося увійти. Спробуй ще раз.</p>}
      <LoginForm />
    </main>
  );
}
