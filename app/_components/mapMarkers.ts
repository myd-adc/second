import type { StoreWithDetails } from "@/lib/db/types";
import { formatNextOpening, nextOpening } from "@/lib/opening-hours/next-open";
import { buildOverview } from "@/lib/schedule/overview";
import { deliveryBadge } from "./deliveryBadge";

export type MapMarker = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  openNow: boolean;
  deliveryToday: boolean;
  /** «відкрито до 19:00» / «зараз зачинено, відкриється завтра о 10:00» */
  statusText: string;
  /** «ЗАВІЗ СЬОГОДНІ» / «завтра» / «через N дн.» / «немає прогнозу» */
  deliveryText: string;
};

/** Plain, serialisable data for the map: only stores that have a place; the rest are just counted. */
export function buildMapMarkers(
  stores: StoreWithDetails[],
  now: Date,
): { markers: MapMarker[]; withoutPlace: number } {
  const hoursById = new Map(stores.map((s) => [s.id, s.hours]));
  const markers: MapMarker[] = [];
  let withoutPlace = 0;

  for (const o of buildOverview(stores, now)) {
    if (o.lat === null || o.lng === null) {
      withoutPlace++;
      continue;
    }
    let statusText: string;
    if (o.openNow && o.closesAt) {
      statusText = `відкрито до ${o.closesAt}`;
    } else {
      const next = nextOpening(hoursById.get(o.id) ?? [], now);
      statusText = next ? `зараз зачинено, відкриється ${formatNextOpening(next)}` : "зараз зачинено";
    }
    markers.push({
      id: o.id,
      name: o.name,
      lat: o.lat,
      lng: o.lng,
      openNow: o.openNow,
      deliveryToday: o.daysUntil === 0,
      statusText,
      deliveryText: deliveryBadge(o.daysUntil).text,
    });
  }
  return { markers, withoutPlace };
}
