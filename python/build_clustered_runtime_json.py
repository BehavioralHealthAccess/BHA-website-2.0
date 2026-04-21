#!/usr/bin/env python3
"""
Build a static runtime JSON from data/clustered_dataframe_final.csv.

Output:
  data/facilities_clustered_runtime.json
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

try:
    import pgeocode
except Exception:
    pgeocode = None


ROOT = Path(__file__).resolve().parent.parent
INPUT_CSV = ROOT / "data" / "clustered_dataframe_final.csv"
OUTPUT_JSON = ROOT / "data" / "facilities_clustered_runtime.json"

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


def normalize(value: str) -> Any:
    raw = (value or "").strip()
    if raw == "":
        return ""
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


def main() -> None:
    if not INPUT_CSV.exists():
        raise FileNotFoundError(f"Missing input CSV: {INPUT_CSV}")

    facilities: list[dict[str, Any]] = []
    pending_zips: set[str] = set()

    with INPUT_CSV.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            parsed = {k: normalize(v) for k, v in row.items() if k in RUNTIME_COLUMNS}
            zip_code = ""
            if parsed.get("zip", "") != "":
                zip_code = str(parsed["zip"]).zfill(5)
                parsed["zip"] = zip_code
                pending_zips.add(zip_code)
            facilities.append(parsed)

    if pgeocode is not None and pending_zips:
        geocoder = pgeocode.Nominatim("us")
        geo_df = geocoder.query_postal_code(sorted(pending_zips))
        zip_map: dict[str, tuple[float, float]] = {}
        for _, rec in geo_df.iterrows():
            postal = str(rec.get("postal_code", "")).strip().zfill(5)
            lat = rec.get("latitude")
            lng = rec.get("longitude")
            if not postal or str(lat).lower() == "nan" or str(lng).lower() == "nan":
                continue
            zip_map[postal] = (float(lat), float(lng))

        for item in facilities:
            zip_code = str(item.get("zip", "")).strip()
            coords = zip_map.get(zip_code)
            if coords:
                item["lat"] = coords[0]
                item["lng"] = coords[1]
    else:
        print("Warning: pgeocode is unavailable; lat/lng were not added.")

    OUTPUT_JSON.write_text(
        json.dumps(facilities, ensure_ascii=True, separators=(",", ":")),
        encoding="utf-8",
    )
    with_coords = sum(1 for r in facilities if r.get("lat") is not None and r.get("lng") is not None)
    print(f"Wrote {OUTPUT_JSON} ({len(facilities)} records, {with_coords} with coordinates)")


if __name__ == "__main__":
    main()
