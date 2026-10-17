"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMapInstance, Marker } from "leaflet";

// Kyiv: where the map starts when no place is chosen yet.
const START: [number, number] = [50.4501, 30.5234];
const START_ZOOM = 11;
const PLACED_ZOOM = 16;

type Props = {
  lat: number | null;
  lng: number | null;
  /** When given the map is editable: tap/click moves the pin and the pin is draggable. */
  onPick?: (lat: number, lng: number) => void;
  label: string;
  height?: number;
};

const round = (n: number) => Math.round(n * 1e6) / 1e6;

export default function LeafletMap({ lat, lng, onPick, label, height = 260 }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMapInstance | null>(null);
  const pin = useRef<Marker | null>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const editable = onPick !== undefined;

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !box.current) return;
      leaflet.current = L;
      const m = L.map(box.current, { scrollWheelZoom: false }).setView(START, START_ZOOM);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      if (editable) m.on("click", (e) => onPickRef.current?.(round(e.latlng.lat), round(e.latlng.lng)));
      map.current = m;
      sync();
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      pin.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sync() {
    const L = leaflet.current;
    const m = map.current;
    if (!L || !m) return;
    if (lat === null || lng === null) {
      pin.current?.remove();
      pin.current = null;
      return;
    }
    if (!pin.current) {
      pin.current = L.marker([lat, lng], {
        draggable: editable,
        keyboard: false,
        icon: L.divIcon({ className: "map-pin", html: "<span></span>", iconSize: [28, 28], iconAnchor: [14, 28] }),
      }).addTo(m);
      pin.current.on("dragend", () => {
        const p = pin.current?.getLatLng();
        if (p) onPickRef.current?.(round(p.lat), round(p.lng));
      });
    } else {
      pin.current.setLatLng([lat, lng]);
    }
    m.setView([lat, lng], Math.max(m.getZoom(), PLACED_ZOOM));
  }

  // Follow the coordinates from outside (search result, manual input, prefill).
  useEffect(sync, [lat, lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={box}
      className="map"
      style={{ height }}
      role="application"
      aria-label={label}
      data-testid="leaflet-map"
    />
  );
}
