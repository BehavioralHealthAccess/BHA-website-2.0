"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

type Facility = {
  facility_name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  intake1?: string;
  type_of_care?: string;
  service_setting?: string;
  payment_funding?: string;
  payment_assistance?: string;
  special_programs_groups?: string;
  emergency_services?: string;
  age_groups_accepted?: string;
  treatment_approaches?: string;
  ancillary_services?: string;
  recovery_support?: string;
  language_services?: string;
  cluster_label?: number | string;
  tier_name?: string;
  lat?: number;
  lng?: number;
};

type ScoredFacility = Facility & { _score: number; _dist: number | null };
const FacilityMap = dynamic(() => import("@/components/FacilityMap"), { ssr: false });

const COMPLEXITY = {
  high: new Set([0, 2]),
  moderate: new Set([1, 3]),
  low: new Set([4]),
};

function includesText(value: string | undefined, needle: string) {
  if (!needle) return true;
  return (value || "").toLowerCase().includes(needle.toLowerCase());
}

function clusterNumber(value: number | string | undefined): number | null {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function weightedComponent(active: boolean, matches: boolean, weight: number, neutral = 0.55) {
  if (!active) return weight * neutral;
  return matches ? weight : 0;
}

function scoreFacilityV2(args: {
  facility: Facility;
  care: string;
  setting: string;
  insurance: string;
  population: string;
  emergency: string;
  complexity: string;
  dist: number | null;
  radiusMiles: number | null;
}) {
  const { facility: f, care, setting, insurance, population, emergency, complexity, dist, radiusMiles } =
    args;

  const insuranceMatch =
    insurance === "sliding"
      ? includesText(f.payment_assistance, "sliding")
      : includesText(f.payment_funding, insurance);

  const populationMatch =
    includesText(f.special_programs_groups, population) ||
    includesText(f.age_groups_accepted, population);

  const complexityMatch = (() => {
    if (!complexity) return true;
    const cluster = clusterNumber(f.cluster_label);
    if (cluster === null) return false;
    return COMPLEXITY[complexity as keyof typeof COMPLEXITY]?.has(cluster) ?? false;
  })();

  const accessSignals = [
    includesText(f.payment_assistance, "sliding"),
    includesText(f.treatment_approaches, "telehealth"),
    includesText(f.language_services, "spanish"),
    includesText(f.recovery_support, "peer"),
  ].filter(Boolean).length;
  const accessScore = Math.min(8, accessSignals * 2);

  let distanceScore = 0;
  if (radiusMiles && radiusMiles > 0 && dist !== null) {
    const closeness = Math.max(0, 1 - dist / radiusMiles);
    distanceScore = closeness * 7;
  } else if (!radiusMiles) {
    // Neutral contribution when distance is not part of the query.
    distanceScore = 3.5;
  }

  const total =
    weightedComponent(Boolean(care), includesText(f.type_of_care, care), 22) +
    weightedComponent(Boolean(setting), includesText(f.service_setting, setting), 18) +
    weightedComponent(Boolean(insurance), insuranceMatch, 15) +
    weightedComponent(Boolean(population), populationMatch, 10) +
    weightedComponent(Boolean(emergency), includesText(f.emergency_services, emergency), 10) +
    weightedComponent(Boolean(complexity), complexityMatch, 10) +
    accessScore +
    distanceScore;

  return clampScore(total);
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeZip(zip: string) {
  const digits = (zip || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.slice(0, 5).padStart(5, "0");
}

function splitList(value?: string, limit = 6): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function cleanField(value?: string): string | null {
  const v = (value || "").trim();
  if (!v) return null;
  if (/^(na|n\/a|none|null|not reported)$/i.test(v)) return null;
  return v;
}

export default function NavigatorPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [complexity, setComplexity] = useState("");
  const [care, setCare] = useState("");
  const [setting, setSetting] = useState("");
  const [insurance, setInsurance] = useState("");
  const [zip, setZip] = useState("");
  const [radius, setRadius] = useState("");
  const [population, setPopulation] = useState("");
  const [emergency, setEmergency] = useState("");
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [geoStatus, setGeoStatus] = useState("");
  const [aiQuery, setAiQuery] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiRanked, setAiRanked] = useState<ScoredFacility[] | null>(null);
  const [aiFilterKey, setAiFilterKey] = useState("");

  useEffect(() => {
    async function run() {
      try {
        const res = await fetch("/api/facilities");
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = (await res.json()) as Facility[];
        setFacilities(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    void run();
  }, []);

  useEffect(() => {
    // Auto-detect ZIP once for better default ranking.
    if (zip) return;
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
          );
          if (!res.ok) return;
          const payload = (await res.json()) as { address?: { postcode?: string } };
          const detectedZip = normalizeZip(payload.address?.postcode || "");
          if (!detectedZip) return;
          setZip(detectedZip);
          setGeoStatus(`Auto-detected ZIP: ${detectedZip}`);
        } catch {
          // Silently fail; manual ZIP entry remains available.
        }
      },
      () => {
        // Permission denied or unavailable: keep silent fallback UX.
      },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 },
    );
  }, [zip]);

  const states = useMemo(
    () =>
      Array.from(new Set(facilities.map((f) => f.state || "").filter(Boolean))).sort(),
    [facilities],
  );

  const tiers = useMemo(
    () =>
      Array.from(new Set(facilities.map((f) => f.tier_name || "").filter(Boolean))).sort(),
    [facilities],
  );

  const tiersForComplexity = useMemo(() => {
    if (!complexity) return tiers;
    const allowed = COMPLEXITY[complexity as keyof typeof COMPLEXITY];
    if (!allowed) return tiers;
    return Array.from(
      new Set(
        facilities
          .filter((f) => {
            const cluster = clusterNumber(f.cluster_label);
            return cluster !== null && allowed.has(cluster);
          })
          .map((f) => f.tier_name || "")
          .filter(Boolean),
      ),
    ).sort();
  }, [complexity, facilities, tiers]);
  const effectiveTierFilter =
    tierFilter && tiersForComplexity.includes(tierFilter) ? tierFilter : "";

  const zipCoords = useMemo(() => {
    const map: Record<string, [number, number]> = {};
    facilities.forEach((f) => {
      const z = normalizeZip(String(f.zip || ""));
      const lat = Number(f.lat);
      const lng = Number(f.lng);
      if (z && Number.isFinite(lat) && Number.isFinite(lng) && !map[z]) {
        map[z] = [lat, lng];
      }
    });
    return map;
  }, [facilities]);

  const inferredStateFromZip = useMemo(() => {
    const z = normalizeZip(zip);
    if (!z) return "";
    const match = facilities.find((f) => normalizeZip(String(f.zip || "")) === z && (f.state || ""));
    return (match?.state || "").trim();
  }, [zip, facilities]);

  const effectiveStateFilter = stateFilter || inferredStateFromZip;

  const filtered = useMemo<ScoredFacility[]>(() => {
    const userZip = normalizeZip(zip);
    const userCoords = userZip ? zipCoords[userZip] : null;
    const radiusMiles = Number.parseFloat(radius);

    const rows = facilities.filter((f) => {
      if (effectiveStateFilter && f.state !== effectiveStateFilter) return false;
      if (effectiveTierFilter && f.tier_name !== effectiveTierFilter) return false;
      if (complexity) {
        const cluster = clusterNumber(f.cluster_label);
        if (cluster === null || !COMPLEXITY[complexity as keyof typeof COMPLEXITY].has(cluster)) {
          return false;
        }
      }
      if (care && !includesText(f.type_of_care, care)) return false;
      if (setting && !includesText(f.service_setting, setting)) return false;
      if (insurance && !includesText(f.payment_funding, insurance)) return false;
      if (population) {
        const hit =
          includesText(f.special_programs_groups, population) ||
          includesText(f.age_groups_accepted, population);
        if (!hit) return false;
      }
      if (emergency && !includesText(f.emergency_services, emergency)) return false;
      return true;
    });

    const hasPreferenceFilters = Boolean(
      effectiveStateFilter ||
        effectiveTierFilter ||
        complexity ||
        care ||
        setting ||
        insurance ||
        population ||
        emergency,
    );

    const scored: ScoredFacility[] = rows
      .map((f) => {
        const lat = Number(f.lat);
        const lng = Number(f.lng);
        const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
        const dist = userCoords && hasCoords ? haversine(userCoords[0], userCoords[1], lat, lng) : null;
        return {
          ...f,
          _score: scoreFacilityV2({
            facility: f,
            care,
            setting,
            insurance,
            population,
            emergency,
            complexity,
            dist,
            radiusMiles: Number.isNaN(radiusMiles) ? null : radiusMiles,
          }),
          _dist: dist,
        };
      })
      .filter((f) => {
        if (!userCoords || !radius || Number.isNaN(radiusMiles)) return true;
        return f._dist !== null && f._dist <= radiusMiles;
      })
      .sort((a, b) => {
        if (userCoords && !hasPreferenceFilters) {
          if (a._dist !== null && b._dist !== null) return a._dist - b._dist;
          if (a._dist !== null) return -1;
          if (b._dist !== null) return 1;
        }
        const s = b._score - a._score;
        if (Math.abs(s) > 1) return s;
        if (a._dist !== null && b._dist !== null) return a._dist - b._dist;
        return 0;
      });
    return scored.slice(0, 150);
  }, [
    facilities,
    effectiveStateFilter,
    effectiveTierFilter,
    complexity,
    care,
    setting,
    insurance,
    population,
    emergency,
    zip,
    radius,
    zipCoords,
  ]);

  const filterKey = `${effectiveStateFilter}|${effectiveTierFilter}|${complexity}|${care}|${setting}|${insurance}|${population}|${emergency}|${zip}|${radius}`;

  async function runAiRank() {
    if (!aiQuery.trim()) {
      setAiMessage("Enter a case description first.");
      return;
    }
    const pool = filtered.slice(0, 60);
    if (!pool.length) {
      setAiMessage("No facilities in current filtered pool.");
      return;
    }

    setAiBusy(true);
    setAiMessage("AI is re-ranking the current shortlist...");
    try {
      const facList = pool
        .map(
          (f, i) =>
            `[${i}] ${f.facility_name} (${f.city}, ${f.state}) | Tier:${f.tier_name || "n/a"} | Setting:${f.service_setting || "n/a"} | Care:${f.type_of_care || "n/a"} | Insurance:${f.payment_funding || "n/a"}`,
        )
        .join("\n");

      const system = `You are a behavioral health access navigator. Re-rank facilities for user query using semantic fit. Return ONLY:
MATCHES: comma-separated indices most→least relevant (up to 20)
SCORES: comma-separated 0-100 semantic scores matching each index
REASON: one concise sentence for top match`;

      const userContent = `Query: "${aiQuery}"\n\nFacilities:\n${facList}`;
      const res = await fetch("/api/ai-rank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_tokens: 700,
          system,
          user_content: userContent,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        content?: Array<{ text?: string }>;
      };
      if (!res.ok || data.error) {
        setAiMessage(data.error || `AI ranking failed (${res.status}). Showing rule ranking.`);
        setAiRanked(null);
        return;
      }

      const text = data.content?.[0]?.text || "";
      const matchLine = text.match(/MATCHES:\s*([0-9,\s]+)/i);
      const scoreLine = text.match(/SCORES:\s*([0-9,\s.]+)/i);
      const reasonLine = text.match(/REASON:\s*([\s\S]+)/i);
      if (!matchLine) {
        setAiMessage("AI returned no parseable ranking. Showing rule ranking.");
        setAiRanked(null);
        return;
      }

      const idxs = matchLine[1]
        .split(",")
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isInteger(n) && n >= 0 && n < pool.length);

      const semScores = (scoreLine?.[1] || "")
        .split(",")
        .map((s) => Number.parseFloat(s.trim()))
        .filter((n) => Number.isFinite(n));

      const reranked: ScoredFacility[] = idxs.map((poolIdx, rankIdx) => {
        const base = pool[poolIdx];
        const sem = semScores[rankIdx] ?? 60;
        return {
          ...base,
          _score: Math.round(0.6 * sem + 0.4 * base._score),
        };
      });
      setAiRanked(reranked);
      setAiFilterKey(filterKey);
      setAiMessage(reasonLine?.[1]?.trim() || `AI ranked ${reranked.length} facilities.`);
    } catch (error) {
      setAiMessage(
        `AI is unavailable right now (${error instanceof Error ? error.message : String(error)}).`,
      );
      setAiRanked(null);
      setAiFilterKey("");
    } finally {
      setAiBusy(false);
    }
  }

  const displayed = aiRanked && aiFilterKey === filterKey ? aiRanked : filtered;
  const activeIdx = selectedIdx < displayed.length ? selectedIdx : 0;
  const selectedFacility = displayed[activeIdx] || null;
  const selectedPhone = cleanField(selectedFacility?.phone);
  const selectedIntake = cleanField(selectedFacility?.intake1);
  const mapsUrl = selectedFacility
    ? `https://maps.google.com/?q=${encodeURIComponent(
        `${selectedFacility.address || ""} ${selectedFacility.city || ""} ${selectedFacility.state || ""} ${selectedFacility.zip || ""}`.trim(),
      )}`
    : "#";

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-indigo-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-sky-600">Raptor Rise Navigator</p>
            <h1 className="text-3xl font-semibold">Clinical Care-Bundle Explorer</h1>
          </div>
          <Link
            href="/"
            className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm text-slate-700 hover:border-sky-400 hover:text-sky-700"
          >
            Back to Home
          </Link>
        </div>

        <section className="mb-5 grid gap-3 rounded-2xl border border-sky-200 bg-white/90 p-4 shadow-sm md:grid-cols-5">
          <input
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            placeholder="ZIP (e.g. 10001)"
            maxLength={5}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
          />
          <select
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white pl-3 pr-9 py-2 text-sm"
          >
            <option value="">Any radius</option>
            <option value="10">{`<= 10 mi`}</option>
            <option value="25">{`<= 25 mi`}</option>
            <option value="50">{`<= 50 mi`}</option>
            <option value="100">{`<= 100 mi`}</option>
          </select>
          <select
            value={effectiveStateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white pl-3 pr-9 py-2 text-sm"
          >
            <option value="">All states</option>
            {states.map((state) => (
              <option value={state} key={state}>
                {state}
              </option>
            ))}
          </select>
          <select
            value={complexity}
            onChange={(e) => setComplexity(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white pl-3 pr-9 py-2 text-sm"
          >
            <option value="">Any complexity</option>
            <option value="high">High</option>
            <option value="moderate">Moderate</option>
            <option value="low">Low</option>
          </select>
          <select
            value={effectiveTierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white pl-3 pr-9 py-2 text-sm"
          >
            <option value="">Any tier</option>
            {tiersForComplexity.map((tier) => (
              <option value={tier} key={tier}>
                {tier}
              </option>
            ))}
          </select>
          <select
            value={care}
            onChange={(e) => setCare(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white pl-3 pr-9 py-2 text-sm"
          >
            <option value="">Any care type</option>
            <option value="mental health">Mental health</option>
            <option value="substance use">Substance use</option>
            <option value="co-occurring">Co-occurring</option>
          </select>
          <select
            value={setting}
            onChange={(e) => setSetting(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white pl-3 pr-9 py-2 text-sm"
          >
            <option value="">Any setting</option>
            <option value="outpatient">Outpatient</option>
            <option value="residential">Residential</option>
            <option value="hospital inpatient">Hospital inpatient</option>
          </select>
          <select
            value={insurance}
            onChange={(e) => setInsurance(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white pl-3 pr-9 py-2 text-sm"
          >
            <option value="">Any insurance</option>
            <option value="medicaid">Medicaid</option>
            <option value="medicare">Medicare</option>
            <option value="private health insurance">Private</option>
            <option value="cash or self-payment">Self-pay</option>
            <option value="sliding">Sliding</option>
          </select>
          <select
            value={population}
            onChange={(e) => setPopulation(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white pl-3 pr-9 py-2 text-sm"
          >
            <option value="">Any population</option>
            <option value="veterans">Veterans</option>
            <option value="children">Children</option>
            <option value="lgbtq">LGBTQ+</option>
            <option value="seniors">Seniors</option>
            <option value="eating disorder">Eating disorders</option>
            <option value="post-traumatic">PTSD</option>
            <option value="criminal justice">Justice-involved</option>
          </select>
          <select
            value={emergency}
            onChange={(e) => setEmergency(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white pl-3 pr-9 py-2 text-sm"
          >
            <option value="">Emergency not required</option>
            <option value="crisis intervention">Crisis intervention</option>
            <option value="psychiatric emergency onsite">Psychiatric emergency onsite</option>
            <option value="walk-in">Walk-in services</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setStateFilter("");
              setTierFilter("");
              setComplexity("");
              setCare("");
              setSetting("");
              setInsurance("");
              setZip("");
              setRadius("");
              setPopulation("");
              setEmergency("");
              setSelectedIdx(0);
            }}
            className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-700 hover:bg-sky-100"
          >
            Reset filters
          </button>
        </section>
        {geoStatus ? (
          <p className="-mt-2 mb-4 text-xs text-sky-700">{geoStatus}</p>
        ) : null}
        {!stateFilter && inferredStateFromZip ? (
          <p className="-mt-2 mb-4 text-xs text-indigo-700">
            State inferred from ZIP: <strong>{inferredStateFromZip}</strong>. Select another state to override.
          </p>
        ) : null}

        <section className="mb-6 rounded-2xl border border-sky-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          <p className="mb-2 font-medium text-slate-900">Complexity Guide</p>
          <ul className="grid gap-1 md:grid-cols-3">
            <li>
              <span className="mr-2 rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-200">High</span>
              Comprehensive and specialized hubs (clusters 0,2)
            </li>
            <li>
              <span className="mr-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-200">Moderate</span>
              Structured clinical and peer support (clusters 1,3)
            </li>
            <li>
              <span className="mr-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-200">Low</span>
              Essential support services (cluster 4)
            </li>
          </ul>
        </section>

        <section className="mb-6 rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm font-medium text-slate-900">Ask AI (optional rerank)</div>
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <input
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              placeholder="Describe case complexity, constraints, and preferences..."
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
            <button
              type="button"
              onClick={() => void runAiRank()}
              disabled={aiBusy}
              className="rounded-xl border border-sky-300 bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-sm text-white hover:from-sky-600 hover:to-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {aiBusy ? "Ranking..." : "Run AI"}
            </button>
          </div>
          {aiMessage ? <p className="mt-2 text-xs text-slate-500">{aiMessage}</p> : null}
        </section>

        {loading && (
          <div className="rounded-2xl border border-sky-200 bg-white p-5 text-sm text-slate-600">
            Loading facilities...
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/40 p-5 text-sm text-red-100">
            Failed to load data: {error}
          </div>
        )}
        {!loading && !error && (
          <section className="grid gap-5 rounded-2xl border border-sky-200 bg-white/90 p-4 shadow-sm lg:grid-cols-[1.05fr_1fr] lg:p-5">
            <div>
              <FacilityMap facilities={displayed} />
              {selectedFacility ? (
                <div className="mt-4 rounded-xl border border-indigo-200 bg-white p-5 shadow-md">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold leading-tight">{selectedFacility.facility_name}</h3>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                      Match {selectedFacility._score}/100
                    </span>
                    {selectedFacility.tier_name ? (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
                        {selectedFacility.tier_name}
                      </span>
                    ) : null}
                    {selectedFacility.cluster_label !== undefined ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        Cluster {String(selectedFacility.cluster_label)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mb-3 text-sm text-slate-600">
                    {selectedFacility.address || "Address not listed"} · {selectedFacility.city},{" "}
                    {selectedFacility.state} {selectedFacility.zip}
                  </p>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {selectedPhone ? (
                      <a
                        href={`tel:${selectedPhone}`}
                        className="rounded-full bg-sky-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600"
                      >
                        Call {selectedPhone}
                      </a>
                    ) : null}
                    {selectedIntake ? (
                      <a
                        href={`tel:${selectedIntake}`}
                        className="rounded-full bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600"
                      >
                        Intake {selectedIntake}
                      </a>
                    ) : null}
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-sky-400 hover:text-sky-700"
                    >
                      Open in Google Maps
                    </a>
                  </div>
                  <div className="mb-3 grid gap-2 text-xs sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <p className="text-slate-500">Emergency</p>
                      <p className="mt-0.5 text-slate-700">
                        {selectedFacility.emergency_services || "Not reported"}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Clinical Profile
                      </p>
                      <div className="space-y-1 text-xs text-slate-700">
                        <p>
                          <span className="text-slate-500">Care:</span>{" "}
                          {selectedFacility.type_of_care || "Not reported"}
                        </p>
                        <p>
                          <span className="text-slate-500">Setting:</span>{" "}
                          {selectedFacility.service_setting || "Not reported"}
                        </p>
                        <p>
                          <span className="text-slate-500">Payment:</span>{" "}
                          {selectedFacility.payment_funding || "Not reported"}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Programs & Supports
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {splitList(selectedFacility.special_programs_groups).map((item) => (
                          <span
                            key={`sp-${item}`}
                            className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-700"
                          >
                            {item}
                          </span>
                        ))}
                        {!splitList(selectedFacility.special_programs_groups).length ? (
                          <span className="text-xs text-slate-500">Not reported</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Treatment Approaches
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {splitList(selectedFacility.treatment_approaches).map((item) => (
                          <span
                            key={`ta-${item}`}
                            className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] text-cyan-700"
                          >
                            {item}
                          </span>
                        ))}
                        {!splitList(selectedFacility.treatment_approaches).length ? (
                          <span className="text-xs text-slate-500">Not reported</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Recovery & Ancillary
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {[...splitList(selectedFacility.recovery_support), ...splitList(selectedFacility.ancillary_services)].slice(0, 8).map((item) => (
                          <span
                            key={`ra-${item}`}
                            className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700"
                          >
                            {item}
                          </span>
                        ))}
                        {!splitList(selectedFacility.recovery_support).length &&
                        !splitList(selectedFacility.ancillary_services).length ? (
                          <span className="text-xs text-slate-500">Not reported</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  Showing <span className="font-semibold text-sky-700">{displayed.length}</span> results
                </p>
                <p className="text-xs text-slate-500">
                  {aiRanked ? "Sorted by AI hybrid score" : "Sorted by match score"}
                </p>
              </div>
              <div className="grid gap-3">
                {displayed.map((f, idx) => (
                  <article
                    key={`${f.facility_name}-${f.zip}-${idx}`}
                    onClick={() => setSelectedIdx(idx)}
                    className={`cursor-pointer rounded-xl border bg-white p-4 shadow-sm transition hover:border-sky-300 ${activeIdx === idx ? "border-sky-500 ring-2 ring-sky-100" : "border-slate-200"}`}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">
                        #{idx + 1}
                      </span>
                      <h2 className="text-base font-semibold">{f.facility_name || "Unnamed facility"}</h2>
                      {f.tier_name ? (
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
                          {f.tier_name}
                        </span>
                      ) : null}
                      {f.cluster_label !== undefined ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                          Cluster {String(f.cluster_label)}
                        </span>
                      ) : null}
                      <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                        Match {f._score}/100
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">
                      {f.city}, {f.state} {f.zip}
                    </p>
                    {f._dist !== null ? (
                      <p className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                        {f._dist.toFixed(1)} mi away
                      </p>
                    ) : null}
                    <p className="mt-1 text-sm text-slate-500">{f.address || "Address not listed"}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                        {f.type_of_care || "Care not listed"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                        {f.service_setting || "Setting not listed"}
                      </span>
                      {f.payment_assistance && includesText(f.payment_assistance, "sliding") ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
                          Sliding fee
                        </span>
                      ) : null}
                      {f.emergency_services ? (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">
                          Emergency options
                        </span>
                      ) : null}
                      {cleanField(f.phone) ? (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700">
                          Primary: {cleanField(f.phone)}
                        </span>
                      ) : null}
                      {cleanField(f.intake1) ? (
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-700">
                          Intake: {cleanField(f.intake1)}
                        </span>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
