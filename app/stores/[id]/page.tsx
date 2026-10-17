import Link from "next/link";
import { notFound } from "next/navigation";
import { deliveryBadge } from "@/app/_components/deliveryBadge";
import { getJournal } from "@/lib/db/events";
import { getStore } from "@/lib/db/stores";
import { isUuid } from "@/lib/mark-input";
import { kyivParts } from "@/lib/opening-hours";
import { formatDayHours } from "@/lib/opening-hours/format";
import { buildOverview, ruleLabel } from "@/lib/schedule/overview";
import { todayInKyiv } from "@/lib/schedule/today";
import CancelMarkButton from "./_components/CancelMarkButton";
import MarkButtons from "./_components/MarkButtons";

export const dynamic = "force-dynamic";

const DAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "нд"];

function ddmm(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
}

export default async function StorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const store = await getStore(id);
  if (!store) notFound();

  const now = new Date();
  const today = todayInKyiv(now);
  const todayWeekday = kyivParts(now).weekday;
  const o = buildOverview([store], now)[0];
  const badge = deliveryBadge(o.daysUntil);
  const c = o.confidence;
  const journal = await getJournal(id, 10);
  const activeRules = store.rules.filter((r) => r.isActive);

  return (
    <main className="page">
      <Link href="/" className="back">
        ← Сьогодні
      </Link>
      <h1>{store.name}</h1>
      {store.address && <p className="meta">{store.address}</p>}
      {store.notes && <p className="meta">{store.notes}</p>}

      <section className="card" aria-label="Статус">
        <div className="row-head">
          <span>Наступний завіз</span>
          <span className={badge.className}>{badge.text}</span>
        </div>
        <span className={o.openNow ? "status status-open" : "status"}>
          {o.openNow && o.closesAt ? `відкрито до ${o.closesAt}` : "зараз закрито"}
        </span>
        {c?.stale && <span className="warn">дані застаріли</span>}
        {c && c.total > 0 && (
          <span className="row-meta">
            збіглося {c.matched} з {c.total}
          </span>
        )}
        <span className="row-meta">
          {c?.daysSinceLastEvent == null
            ? "ще немає підтверджень"
            : `останнє підтвердження ${c.daysSinceLastEvent} дн. тому`}
        </span>
      </section>

      <MarkButtons storeId={store.id} today={today} />

      <h2>Години роботи</h2>
      <ul className="plain hours">
        {DAYS.map((d, i) => (
          <li key={d} className={i === todayWeekday ? "hours-today" : undefined}>
            <span>{d}</span>
            <span>{formatDayHours(store.hours.find((h) => h.weekday === i))}</span>
          </li>
        ))}
      </ul>

      <h2>Графік завозів</h2>
      {activeRules.length === 0 ? (
        <p className="meta">без графіка</p>
      ) : (
        <ul className="plain">
          {activeRules.map((r) => (
            <li key={r.id}>
              {ruleLabel(r.rule)}
              {r.timeOfDay && ` · зазвичай ~${r.timeOfDay}`}
              {r.note && <span className="row-meta"> · {r.note}</span>}
            </li>
          ))}
        </ul>
      )}

      <h2>Журнал</h2>
      {journal.length === 0 ? (
        <p className="meta">ще немає відміток</p>
      ) : (
        <ul className="plain journal">
          {journal.map((e) => (
            <li key={e.id}>
              {e.reporterName}
              {e.reportedByMe && " (ти)"} · {ddmm(e.date)} · {e.happened ? "завіз був" : "завозу не було"}
              {e.note && <span className="row-meta"> — {e.note}</span>}
              {e.reportedByMe && <CancelMarkButton storeId={store.id} entryId={e.id} />}
            </li>
          ))}
        </ul>
      )}

      <nav className="foot">
        <Link href={`/stores/${store.id}/edit`} className="btn">
          Редагувати
        </Link>
      </nav>
    </main>
  );
}
