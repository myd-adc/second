import Link from "next/link";
import { listStores } from "@/lib/db/stores";
import { buildOverview } from "@/lib/schedule/overview";
import { formatTodayHeader } from "@/lib/schedule/today";
import GeoButton from "./_components/GeoButton";
import GeoProvider from "./_components/GeoProvider";
import StoreRow from "./_components/StoreRow";
import StoresMap from "./_components/StoresMap";
import { buildMapMarkers } from "./_components/mapMarkers";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const now = new Date();
  const stores = await listStores();
  const overview = buildOverview(stores, now);
  const view = (await searchParams).view === "map" ? "map" : "list";
  const { markers, withoutPlace } = buildMapMarkers(stores, now);

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
          <nav className="tabs" aria-label="Вигляд">
            <Link href="/?view=list" className="tab" aria-current={view === "list" ? "page" : undefined}>
              Список
            </Link>
            <Link href="/?view=map" className="tab" aria-current={view === "map" ? "page" : undefined}>
              Карта
            </Link>
          </nav>
          {view === "list" ? (
            <>
              <GeoButton />
              <ul className="list">
                {overview.map((s) => (
                  <StoreRow key={s.id} store={s} />
                ))}
              </ul>
            </>
          ) : (
            <>
              <GeoButton label="📍 Де я" />
              {markers.length === 0 ? (
                <p className="empty">
                  Ще жоден магазин не має місця на карті. Відкрий магазин → «Редагувати» → «Місце на карті».
                </p>
              ) : (
                <StoresMap markers={markers} />
              )}
              {withoutPlace > 0 && markers.length > 0 && (
                <p className="row-meta">
                  Без місця на карті: {withoutPlace}. Додай його в редагуванні магазину.
                </p>
              )}
            </>
          )}
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
