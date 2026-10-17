"use client";

import { useGeo } from "./GeoProvider";

export default function GeoButton({ label = "📍 Показати відстань" }: { label?: string }) {
  const { status, request } = useGeo();
  if (status === "granted") return null;
  return (
    <div className="geo">
      <button type="button" className="btn geo-btn" onClick={request} disabled={status === "loading"}>
        {status === "loading" ? "Визначаємо місце…" : label}
      </button>
      {status === "denied" && (
        <p role="status" className="geo-note">
          Не вдалося отримати геолокацію
        </p>
      )}
    </div>
  );
}
