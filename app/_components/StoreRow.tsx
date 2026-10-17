import Link from "next/link";
import type { StoreOverview } from "@/lib/schedule/overview";
import { deliveryBadge } from "./deliveryBadge";

export default function StoreRow({ store }: { store: StoreOverview }) {
  const b = deliveryBadge(store.daysUntil);
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
