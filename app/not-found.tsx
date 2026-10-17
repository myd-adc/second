import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page notice">
      <h1>Сторінку не знайдено</h1>
      <Link href="/" className="back">
        ← Сьогодні
      </Link>
    </main>
  );
}
