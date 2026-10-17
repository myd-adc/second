"use client";

import { useId, useState } from "react";
import LeafletMap from "@/app/_components/LeafletMap";
import { formatCoordinates, parseCoordinates } from "@/lib/coordinates";
import type { GeocodeResult } from "@/lib/geocode";
import { searchAddressAction } from "../geocode-action";

type Props = {
  /** The address typed in the form: it is what «Знайти на карті» searches for. */
  address: string;
  /** Raw "lat, lng" text kept in the form state (empty = no place). */
  coordinates: string;
  onChange: (coordinates: string) => void;
};

type Search =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "found"; results: GeocodeResult[] }
  | { phase: "error"; message: string };

export default function LocationPicker({ address, coordinates, onChange }: Props) {
  const uid = useId();
  const [search, setSearch] = useState<Search>({ phase: "idle" });
  const parsed = parseCoordinates(coordinates);
  const point = parsed !== null && parsed !== "invalid" ? parsed : null;

  async function find() {
    setSearch({ phase: "loading" });
    try {
      const res = await searchAddressAction(address);
      setSearch(res.ok ? { phase: "found", results: res.results } : { phase: "error", message: res.error });
    } catch {
      setSearch({ phase: "error", message: "Не вдалося знайти адресу. Спробуй ще раз." });
    }
  }

  function choose(r: GeocodeResult) {
    onChange(formatCoordinates(r.lat, r.lng));
    setSearch({ phase: "idle" });
  }

  return (
    <fieldset className="field location">
      <legend>Місце на карті</legend>
      <button type="button" className="btn" onClick={find} disabled={search.phase === "loading"}>
        📍 Знайти на карті за адресою
      </button>
      <span className="row-meta">
        Введи адресу вище й натисни кнопку. Потім можна клікнути на карті або перетягнути маркер, щоб уточнити.
      </span>

      <div role="status" aria-live="polite">
        {search.phase === "loading" && <p className="row-meta">Шукаю…</p>}
        {search.phase === "error" && <p className="form-error">{search.message}</p>}
        {search.phase === "found" && search.results.length === 0 && (
          <p className="row-meta">Нічого не знайдено. Уточни адресу (місто, вулиця, номер) або клікни на карті.</p>
        )}
      </div>
      {search.phase === "found" && search.results.length > 0 && (
        <ul className="plain geo-results">
          {search.results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button type="button" className="btn geo-result" onClick={() => choose(r)}>
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <LeafletMap
        lat={point?.lat ?? null}
        lng={point?.lng ?? null}
        onPick={(lat, lng) => onChange(formatCoordinates(lat, lng))}
        label="Карта: клікни, щоб поставити маркер магазину"
      />

      {point && (
        <p className="row-meta">
          Місце вибрано ({coordinates.trim()}){" "}
          <button type="button" className="link-btn" onClick={() => onChange("")}>
            Прибрати
          </button>
        </p>
      )}

      <details>
        <summary>Ввести координати вручну</summary>
        <label htmlFor={`${uid}-coords`}>Координати (широта, довгота)</label>
        <input
          id={`${uid}-coords`}
          type="text"
          inputMode="text"
          autoComplete="off"
          placeholder="50.4501, 30.5234"
          value={coordinates}
          onChange={(e) => onChange(e.target.value)}
        />
        {parsed === "invalid" && <span className="form-error">Формат: 50.4501, 30.5234 (через крапку)</span>}
      </details>
    </fieldset>
  );
}
