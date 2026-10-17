"use client";

import { distanceKm, formatDistance } from "@/lib/geo";
import { useGeo } from "./GeoProvider";

export default function Distance({ lat, lng }: { lat: number | null; lng: number | null }) {
  const { position } = useGeo();
  if (!position || lat === null || lng === null) return null;
  return <span className="row-meta">за {formatDistance(distanceKm(position, { lat, lng }))}</span>;
}
