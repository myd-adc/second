import Link from "next/link";
import type { StoreOverview } from "@/lib/schedule/overview";

function badge(daysUntil: number | null): { text: string; className: string } {
  if (daysUntil === null) return { text: "немає прогнозу", className: "badge badge-none" };
  if (daysUntil === 0) return { text: "ЗАВІЗ СЬОГОДНІ", className: "badge badge-today" };
  if (daysUntil === 1) return { text: "завтра", className: "badge badge-soon" };
  return { text: `через ${daysUntil} дн.`, className: "badge badge-soon" };
}

export default function StoreRow({ store }: { store: StoreOverview }) {
  const b = badge(store.daysUntil);
  const c = store.confidence;
  return (
    <li>
      <Link href={`/stores/${store.id}`} className="row">
        <span className="row-head">
          <span className="row-name">{store.name}</span>
          <span className={b.className}>{b.text}</span>
        </span>
        <span className={store.openNow ? "status status-open" : "status"}>
          {store.openNow && store.closesAt ? `відкрито до ${store.closesAt}` : "зараз закрито"}
        </span>
        <span className="row-meta">{store.ruleLabel}</span>
        {c?.stale && <span className="warn">дані застаріли</span>}
        {c && c.total > 0 && (
          <span className="row-meta">
            збіглося {c.matched} з {c.total}
          </span>
        )}
      </Link>
    </li>
  );
}
