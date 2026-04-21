## Raptor Rise Next.js Frontend

This is the modern UI migration for the behavioral health navigator.

- `/` -> new polished landing page
- `/navigator` -> new dynamic care-bundle explorer
- `/api/facilities` -> reads `../data/facilities_clustered_runtime.json`
- `/api/ai-rank` -> Gemini-based rerank endpoint (retries + model fallback)

## Getting Started

From `webapp/` run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## AI configuration (for Ask AI)

Create `webapp/.env.local`:

```bash
GEMINI_API_KEY=your_key_here
# optional
GEMINI_MODEL=gemini-2.5-flash
GEMINI_FALLBACK_MODELS=gemini-2.0-flash,gemini-2.0-flash-lite
```

## Build checks

```bash
npm run lint
npm run build
```

## Data requirement

The UI expects this file to exist at repo root:

`data/facilities_clustered_runtime.json`

Regenerate it whenever the clustered CSV changes:

```bash
python3 python/build_clustered_runtime_json.py
```

## Scoring model (Rule Score v2)

The navigator computes a bounded rule score in `0..100` (`clampScore`) using weighted components:

- Care match: `22`
- Setting match: `18`
- Insurance/payment match: `15`
- Population match: `10`
- Emergency match: `10`
- Complexity-tier alignment: `10`
- Access readiness bonus: up to `8`
  - sliding fee
  - telehealth
  - Spanish/language support
  - peer/recovery support
- Distance fit: up to `7` when radius is set

### Robust behavior rules

- **Hard cap:** final score is always clamped to `[0, 100]`.
- **Neutral handling:** if a filter is not selected, the component contributes a neutral fraction (`55%`) rather than zero.
- **Distance neutral:** if radius is not selected, distance contributes a neutral midpoint.
- **No runaway values:** bonuses are capped (`access <= 8`, `distance <= 7`) so totals cannot exceed threshold.
