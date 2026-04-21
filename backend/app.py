"""
Local dev server: serves frontend/, data/, and POST /api/ai-rank (Google Gemini proxy).

Run from repo root:
  cd backend && ../python/.venv/bin/pip install -r requirements.txt  # or any Python 3.10+
  export GEMINI_API_KEY=...   # or create ../.env (see .env.example)
  python app.py

Open http://127.0.0.1:8080/
"""
from __future__ import annotations

import csv
import json
import os
import time
from pathlib import Path
from typing import Any

import httpx
try:
    import pgeocode
except Exception:  # pragma: no cover - graceful fallback when optional dep missing
    pgeocode = None
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory

ROOT = Path(__file__).resolve().parent.parent
CLUSTERED_CSV = ROOT / "data" / "clustered_dataframe_final.csv"
PRECOMPUTED_JSON = ROOT / "data" / "facilities_clustered_runtime.json"
load_dotenv(ROOT / ".env")

app = Flask(__name__)

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
ZIP_GEOCODER = pgeocode.Nominatim("us") if pgeocode else None

RUNTIME_COLUMNS = {
    "facility_name",
    "address",
    "city",
    "state",
    "zip",
    "phone",
    "intake1",
    "intake2",
    "type_of_care",
    "service_setting",
    "facility_type",
    "pharmacotherapies",
    "treatment_approaches",
    "emergency_services",
    "facility_operation",
    "license_certification",
    "payment_funding",
    "payment_assistance",
    "special_programs_groups",
    "assessment_pretreatment",
    "testing",
    "recovery_support",
    "education_counseling",
    "age_groups_accepted",
    "language_services",
    "ancillary_services",
    "cluster_label",
    "tier_name",
}

_FACILITY_CACHE: list[dict[str, Any]] | None = None
_FACILITY_CACHE_MTIME: float | None = None


def _gemini_key() -> str:
    return (
        os.environ.get("GEMINI_API_KEY", "").strip()
        or os.environ.get("GOOGLE_API_KEY", "").strip()
    )


def _candidate_models(preferred_model: str) -> list[str]:
    configured = [
        m.strip()
        for m in os.environ.get("GEMINI_FALLBACK_MODELS", "").split(",")
        if m.strip()
    ]
    defaults = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"]
    ordered = [preferred_model] + configured + defaults
    seen: set[str] = set()
    out: list[str] = []
    for model in ordered:
        if not model or model in seen:
            continue
        seen.add(model)
        out.append(model)
    return out


def _normalize_number(value: str) -> Any:
    raw = (value or "").strip()
    if raw == "":
        return ""
    # Keep ZIP/phone-like fields as strings.
    if raw.startswith("0") and raw.isdigit() and len(raw) > 1:
        return raw
    try:
        return int(raw)
    except ValueError:
        pass
    try:
        return float(raw)
    except ValueError:
        return raw


def _zip_to_lat_lng(zip_code: str) -> tuple[float, float] | None:
    if not zip_code or ZIP_GEOCODER is None:
        return None
    rec = ZIP_GEOCODER.query_postal_code(zip_code)
    lat = getattr(rec, "latitude", None)
    lng = getattr(rec, "longitude", None)
    if lat is None or lng is None:
        return None
    if str(lat).lower() == "nan" or str(lng).lower() == "nan":
        return None
    return (float(lat), float(lng))


def _load_clustered_facilities() -> list[dict[str, Any]]:
    if not CLUSTERED_CSV.exists():
        return []
    facilities: list[dict[str, Any]] = []
    pending_zips: set[str] = set()
    with CLUSTERED_CSV.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            parsed = {
                k: _normalize_number(v)
                for k, v in row.items()
                if k in RUNTIME_COLUMNS
            }
            zip_code = ""
            if "zip" in parsed and parsed["zip"] != "":
                zip_code = str(parsed["zip"]).zfill(5)
                parsed["zip"] = zip_code
                pending_zips.add(zip_code)
            facilities.append(parsed)

    zip_cache: dict[str, tuple[float, float] | None] = {}
    if pending_zips and ZIP_GEOCODER is not None:
        zip_list = sorted(pending_zips)
        # Vectorized lookup is significantly faster than per-row queries.
        geo_df = ZIP_GEOCODER.query_postal_code(zip_list)
        for _, rec in geo_df.iterrows():
            postal = str(rec.get("postal_code", "")).strip().zfill(5)
            lat = rec.get("latitude")
            lng = rec.get("longitude")
            if not postal or str(lat).lower() == "nan" or str(lng).lower() == "nan":
                zip_cache[postal] = None
                continue
            zip_cache[postal] = (float(lat), float(lng))

    for parsed in facilities:
        zip_code = str(parsed.get("zip", "")).strip()
        if not zip_code:
            continue
        coords = zip_cache.get(zip_code)
        if coords:
            parsed["lat"] = coords[0]
            parsed["lng"] = coords[1]
    return facilities


def _get_cached_facilities() -> list[dict[str, Any]]:
    global _FACILITY_CACHE, _FACILITY_CACHE_MTIME
    if not CLUSTERED_CSV.exists():
        return []
    csv_mtime = CLUSTERED_CSV.stat().st_mtime
    mtime = csv_mtime

    # Fast path: use materialized JSON when it is newer than CSV.
    if PRECOMPUTED_JSON.exists():
        json_mtime = PRECOMPUTED_JSON.stat().st_mtime
        if json_mtime >= csv_mtime:
            mtime = json_mtime

    if _FACILITY_CACHE is not None and _FACILITY_CACHE_MTIME == mtime:
        return _FACILITY_CACHE

    rows: list[dict[str, Any]] = []
    if PRECOMPUTED_JSON.exists():
        json_mtime = PRECOMPUTED_JSON.stat().st_mtime
        if json_mtime >= csv_mtime:
            try:
                rows = json.loads(PRECOMPUTED_JSON.read_text(encoding="utf-8"))
            except Exception:
                rows = []

    if not rows:
        rows = _load_clustered_facilities()
        # Materialize once so future requests skip CSV parsing/geocode work.
        PRECOMPUTED_JSON.write_text(
            json.dumps(rows, ensure_ascii=True, separators=(",", ":")),
            encoding="utf-8",
        )
        mtime = PRECOMPUTED_JSON.stat().st_mtime

    _FACILITY_CACHE = rows
    _FACILITY_CACHE_MTIME = mtime
    return rows


@app.route("/")
def index():
    return send_from_directory(ROOT / "frontend", "index.html")


@app.route("/data/<path:filename>")
def serve_data(filename):
    return send_from_directory(ROOT / "data", filename)


@app.get("/api/facilities")
def facilities():
    rows = _get_cached_facilities()
    if not rows:
        return jsonify({"error": "clustered_dataframe_final.csv not found or empty"}), 404
    return jsonify(rows)


@app.post("/api/ai-rank")
def ai_rank():
    key = _gemini_key()
    if not key:
        return jsonify(
            {
                "error": "GEMINI_API_KEY is not set. Copy .env.example to .env in the repo root and add your key (Google AI Studio)."
            }
        ), 503

    payload = request.get_json(silent=True) or {}
    system = payload.get("system", "")
    user_content = payload.get("user_content", "")
    # gemini-1.5-* removed from API; use current stable text models (see ai.google.dev/gemini-api/docs/models).
    default_model = "gemini-2.5-flash"
    requested_model = (
        payload.get("model")
        or os.environ.get("GEMINI_MODEL", "")
        or default_model
    ).strip()
    if not requested_model.startswith("gemini-"):
        requested_model = default_model
    models_to_try = _candidate_models(requested_model)
    max_tokens = int(payload.get("max_tokens", 800))

    if not user_content:
        return jsonify({"error": "user_content required"}), 400

    body: dict = {
        "contents": [{"role": "user", "parts": [{"text": user_content}]}],
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "temperature": 0.3,
        },
    }
    if system.strip():
        body["systemInstruction"] = {"parts": [{"text": system}]}

    last_error = "Gemini request failed."
    last_status: int | None = None

    for model in models_to_try:
        url = f"{GEMINI_BASE}/{model}:generateContent"
        for attempt in range(3):
            try:
                r = httpx.post(
                    url,
                    headers={
                        "x-goog-api-key": key,
                        "content-type": "application/json",
                    },
                    json=body,
                    timeout=120.0,
                )
            except httpx.RequestError as e:
                last_error = f"Upstream request failed: {e!s}"
                last_status = None
                break

            try:
                resp_json = r.json()
            except ValueError:
                last_error = "Gemini returned non-JSON"
                last_status = r.status_code
                break

            if r.status_code >= 400:
                err = resp_json.get("error", {})
                msg = err.get("message", r.text[:500]) if isinstance(err, dict) else str(err)
                last_error = msg
                last_status = r.status_code
                # Retry transient overload/rate-limit errors.
                if r.status_code in (429, 500, 502, 503, 504) and attempt < 2:
                    time.sleep(0.8 * (attempt + 1))
                    continue
                break

            candidates = resp_json.get("candidates") or []
            if not candidates:
                fb = resp_json.get("promptFeedback") or {}
                block = fb.get("blockReason") or "no candidates"
                last_error = f"Gemini returned no text ({block})."
                last_status = 502
                break

            parts = (candidates[0].get("content") or {}).get("parts") or []
            text = "".join(p.get("text", "") for p in parts if isinstance(p, dict))
            if not text.strip():
                last_error = "Gemini returned empty text."
                last_status = 502
                break

            # Same shape as Anthropic so frontend keeps using data.content[0].text
            return jsonify(
                {
                    "content": [{"type": "text", "text": text}],
                    "id": "gemini",
                    "model": model,
                }
            ), 200

    return jsonify({"error": last_error, "gemini_status": last_status}), 502


@app.route("/<path:path>")
def serve_frontend(path):
    return send_from_directory(ROOT / "frontend", path)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    print(f"Serving http://127.0.0.1:{port}/  (set GEMINI_API_KEY for Ask AI)")
    app.run(host="127.0.0.1", port=port, debug=True)
