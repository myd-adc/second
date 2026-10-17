import Link from "next/link";
import { listStores } from "@/lib/db/stores";
import { filterStores } from "@/lib/filter-stores";

export const dynamic = "force-dynamic";

export default async function StoresPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "";
  const all = await listStores();
  const stores = filterStores(all, q);

  return (
    <main className="page">
      <Link href="/" className="back">
        ← Сьогодні
      </Link>
      <div className="title-row">
        <h1>Усі магазини</h1>
        <Link href="/stores/new" className="btn">
          + Додати
        </Link>
      </div>
      <form method="get" action="/stores" role="search" className="search">
        <label htmlFor="q" className="visually-hidden">
          Пошук за назвою або адресою
        </label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Назва або адреса" />
        <button type="submit" className="btn">
          Шукати
        </button>
      </form>
      {stores.length === 0 ? (
        <div className="empty">
          <p>{all.length === 0 ? "Магазинів ще немає" : "Нічого не знайдено"}</p>
        </div>
      ) : (
        <ul className="list">
          {stores.map((s) => (
            <li key={s.id}>
              <Link href={`/stores/${s.id}`} className="row">
                <span className="row-name">{s.name}</span>
                {s.address && <span className="row-meta">{s.address}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
