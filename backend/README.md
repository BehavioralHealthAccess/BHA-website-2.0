# Backend (local dev server)

Serves **`frontend/`**, **`data/`**, and proxies **Ask AI** to Google Gemini (keeps `GEMINI_API_KEY` off the client).

## Setup

```bash
cd backend
pip install -r requirements.txt
```

From the **repo root**, copy `.env.example` to `.env` and set:

```bash
GEMINI_API_KEY=...
```

Optional: `GEMINI_MODEL=...` (default **`gemini-2.5-flash`**). Older ids like `gemini-1.5-flash` are no longer available—use [current model names](https://ai.google.dev/gemini-api/docs/models/gemini). If you see **quota exceeded**, try `gemini-2.5-flash-lite` or enable billing in [Google AI Studio](https://aistudio.google.com/).

## Run

```bash
cd backend
python app.py
```

Open **http://127.0.0.1:8080/** (not `file://`, and use this instead of `python -m http.server` so `/data/` and `/api/ai-rank` share the same origin).

Optional: `PORT=9000 python app.py`
