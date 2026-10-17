"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { LatLng } from "@/lib/geo";

type GeoStatus = "idle" | "loading" | "granted" | "denied";
type GeoValue = { position: LatLng | null; status: GeoStatus; request: () => void };

const GeoContext = createContext<GeoValue>({ position: null, status: "idle", request: () => {} });

export function useGeo(): GeoValue {
  return useContext(GeoContext);
}

export default function GeoProvider({ children }: { children: React.ReactNode }) {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<GeoStatus>("idle");

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("denied");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude });
        setStatus("granted");
      },
      () => setStatus("denied"),
      { maximumAge: 5 * 60_000, timeout: 10_000 },
    );
  }, []);

  // Never prompt on load: only fetch silently if permission was already granted.
  useEffect(() => {
    let cancelled = false;
    try {
      navigator.permissions
        ?.query({ name: "geolocation" })
        .then((r) => {
          if (!cancelled && r.state === "granted") request();
        })
        .catch(() => {});
    } catch {
      // permissions API unavailable: stay idle
    }
    return () => {
      cancelled = true;
    };
  }, [request]);

  const value = useMemo(() => ({ position, status, request }), [position, status, request]);
  return <GeoContext.Provider value={value}>{children}</GeoContext.Provider>;
}
