import Link from "next/link";
import { listStores } from "@/lib/db/stores";
import { buildOverview } from "@/lib/schedule/overview";
import { formatTodayHeader } from "@/lib/schedule/today";
import GeoButton from "./_components/GeoButton";
import GeoProvider from "./_components/GeoProvider";
import StoreRow from "./_components/StoreRow";

export const dynamic = "force-dynamic";

export default async function Home() {
  const now = new Date();
  const overview = buildOverview(await listStores(), now);

  return (
    <main className="page">
      <h1>{formatTodayHeader(now)}</h1>
      {overview.length === 0 ? (
        <div className="empty">
          <p>Магазинів ще немає</p>
          <Link href="/stores/new" className="btn">
            + Додати магазин
          </Link>
        </div>
      ) : (
        <GeoProvider>
          <GeoButton />
          <ul className="list">
            {overview.map((s) => (
              <StoreRow key={s.id} store={s} />
            ))}
          </ul>
        </GeoProvider>
      )}
      <nav className="foot">
        <Link href="/stores" className="btn">
          Усі магазини
        </Link>
      </nav>
    </main>
  );
}
