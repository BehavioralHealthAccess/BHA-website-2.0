"use client";

import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";

type MapFacility = {
  facility_name?: string;
  city?: string;
  state?: string;
  zip?: string;
  tier_name?: string;
  _score: number;
  lat?: number;
  lng?: number;
};

type FacilityMapProps = {
  facilities: MapFacility[];
};

export default function FacilityMap({ facilities }: FacilityMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);

  const points = useMemo(
    () =>
      facilities
        .filter((f) => Number.isFinite(f.lat) && Number.isFinite(f.lng))
        .slice(0, 350),
    [facilities],
  );

  const center = useMemo(() => {
    if (!points.length) return [39.5, -98.35] as [number, number];
    const lat = points.reduce((sum, p) => sum + Number(p.lat), 0) / points.length;
    const lng = points.reduce((sum, p) => sum + Number(p.lng), 0) / points.length;
    return [lat, lng] as [number, number];
  }, [points]);

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;
    const map = L.map(mapRef.current, { zoomControl: true, zoomAnimation: false }).setView(
      [39.5, -98.35],
      4,
      { animate: false },
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    leafletMapRef.current = map;
    return () => {
      map.stop();
      map.remove();
      leafletMapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!leafletMapRef.current) return;
    const map = leafletMapRef.current;
    const layerGroup = L.layerGroup().addTo(map);

    const pinIcon = (color: string, size = 28) =>
      L.divIcon({
        className: "",
        html: `<svg width="${size}" height="${Math.round(size * 1.3)}" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
          <path d="M13 0C7.477 0 3 4.477 3 10c0 7.5 10 24 10 24s10-16.5 10-24c0-5.523-4.477-10-10-10z" fill="${color}" stroke="white" stroke-width="1.5"/>
          <circle cx="13" cy="10" r="4.5" fill="white"/>
        </svg>`,
        iconSize: [size, Math.round(size * 1.3)],
        iconAnchor: [size / 2, Math.round(size * 1.3)],
        popupAnchor: [0, -Math.round(size * 1.2)],
      });

    const iconBlue = pinIcon("#0EA5E9", 26);
    const iconGold = pinIcon("#F59E0B", 30);
    const iconRed = pinIcon("#EF4444", 32);

    points.forEach((f, rank) => {
      const lat = Number(f.lat);
      const lng = Number(f.lng);
      const icon = rank === 0 ? iconRed : rank < 3 ? iconGold : iconBlue;
      const marker = L.marker([lat, lng], { icon });
      marker.bindPopup(
        `<div style="min-width:180px">
          <div style="font-weight:700">${f.facility_name || "Unnamed facility"}</div>
          <div>${f.city || ""}, ${f.state || ""} ${f.zip || ""}</div>
          ${f.tier_name ? `<div>Tier: ${f.tier_name}</div>` : ""}
          <div>Match: ${f._score}/100</div>
        </div>`,
      );
      marker.addTo(layerGroup);
    });

    if (points.length) {
      const bounds = L.latLngBounds(points.map((p) => [Number(p.lat), Number(p.lng)] as [number, number]));
      map.fitBounds(bounds, { padding: [20, 20], maxZoom: 10, animate: false });
    } else {
      map.setView(center, 4, { animate: false });
    }

    return () => {
      layerGroup.remove();
    };
  }, [points, center]);

  return (
    <div className="overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-sky-100 px-4 py-3">
        <h3 className="text-sm font-medium text-slate-800">Facility Map</h3>
        <span className="text-xs text-slate-500">{points.length} mapped rows</span>
      </div>
      <div className="h-[420px]">
        <div ref={mapRef} className="h-full w-full" />
      </div>
    </div>
  );
}
