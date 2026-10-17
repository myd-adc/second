import Link from "next/link";
import { TIMEZONE } from "@/lib/config";
import { listStores } from "@/lib/db/stores";
import { buildOverview } from "@/lib/schedule/overview";
import StoreRow from "./_components/StoreRow";

export const dynamic = "force-dynamic";

function heading(now: Date): string {
  const f = new Intl.DateTimeFormat("uk-UA", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return `Сьогодні, ${f.format(now)}`;
}

export default async function Home() {
  const now = new Date();
  const overview = buildOverview(await listStores(), now);

  return (
    <main className="page">
      <h1>{heading(now)}</h1>
      {overview.length === 0 ? (
        <div className="empty">
          <p>Магазинів ще немає</p>
          <Link href="/stores/new" className="btn">
            + Додати магазин
          </Link>
        </div>
      ) : (
        <ul className="list">
          {overview.map((s) => (
            <StoreRow key={s.id} store={s} />
          ))}
        </ul>
      )}
      <nav className="foot">
        <Link href="/stores" className="btn">
          Усі магазини
        </Link>
      </nav>
    </main>
  );
}
