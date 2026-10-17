"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMapInstance, CircleMarker } from "leaflet";
import { useGeo } from "./GeoProvider";
import type { MapMarker } from "./mapMarkers";

const START: [number, number] = [50.4501, 30.5234]; // Kyiv, used only when there is nothing to fit
const START_ZOOM = 11;
const MAX_FIT_ZOOM = 16;

/** Popup content as DOM nodes (textContent only) so store names can never inject markup. */
function popupContent(m: MapMarker): HTMLElement {
  const box = document.createElement("div");
  box.className = "map-popup";
  const add = (tag: string, text: string, className?: string) => {
    const el = document.createElement(tag);
    el.textContent = text;
    if (className) el.className = className;
    box.appendChild(el);
    return el;
  };
  add("strong", m.name);
  add("span", m.statusText);
  add("span", m.deliveryText, m.deliveryToday ? "map-popup-today" : "map-popup-meta");
  const link = add("a", "Відкрити магазин", "map-popup-link") as HTMLAnchorElement;
  link.href = `/stores/${m.id}`;
  return box;
}

export default function StoresMap({ markers }: { markers: MapMarker[] }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMapInstance | null>(null);
  const me = useRef<CircleMarker | null>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const { position } = useGeo();
  const positionRef = useRef(position);
  // declared before the effects that call fit(), so they always see the latest position
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  /** Blue «I am here» dot from the latest position (no-op until both the map and the position exist). */
  function drawMe() {
    const L = leaflet.current;
    const m = map.current;
    if (!L || !m) return;
    me.current?.remove();
    me.current = null;
    const p = positionRef.current;
    if (!p) return;
    me.current = L.circleMarker([p.lat, p.lng], {
      radius: 8,
      color: "#ffffff",
      weight: 3,
      fillColor: "#2563eb",
      fillOpacity: 1,
    })
      .bindTooltip("Ви тут")
      .addTo(m);
  }

  function fit() {
    const L = leaflet.current;
    const m = map.current;
    if (!L || !m) return;
    const points: Array<[number, number]> = markers.map((x) => [x.lat, x.lng]);
    const p = positionRef.current;
    if (p) points.push([p.lat, p.lng]);
    if (points.length === 0) return;
    if (points.length === 1) m.setView(points[0], 15);
    else m.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: MAX_FIT_ZOOM });
  }

  // Create the map and the store markers once (and again if the set of stores changes).
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
      for (const mk of markers) {
        const cls = ["map-dot", mk.openNow ? "map-dot-open" : "map-dot-closed", mk.deliveryToday ? "map-dot-today" : ""]
          .filter(Boolean)
          .join(" ");
        L.marker([mk.lat, mk.lng], {
          title: mk.name,
          icon: L.divIcon({ className: cls, html: "<span></span>", iconSize: [26, 26], iconAnchor: [13, 13] }),
        })
          .bindPopup(popupContent(mk))
          .addTo(m);
      }
      map.current = m;
      drawMe(); // the position may have arrived before Leaflet finished loading
      fit();
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      me.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

  // «Де я»: draw the dot, and widen the view to include it.
  useEffect(() => {
    drawMe();
    fit();
  }, [position]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={box}
      className="map map-stores"
      role="application"
      aria-label="Карта магазинів: зелена мітка — відкрито, сіра — зачинено"
      data-testid="stores-map"
    />
  );
}
