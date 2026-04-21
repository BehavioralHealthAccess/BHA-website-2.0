# BHA Navigator (front end)

- **`index.html`** — Marketing / project landing (scroll sections, navbar). Uses `css/site.css`, `js/site.js`.
- **`navigator.html`** — Facility search UI (map, filters, Ask AI). Uses `css/styles.css`, `js/app.js`.
- Data and **Ask AI** load from the **same origin** as the page (`/api/facilities`, `/api/ai-rank`).

## Run the app (required)

Use the **Flask server** in **`../backend/`** — it serves both pages, JSON data, and the Gemini proxy. Do **not** rely on `python -m http.server` alone (that breaks `/api/ai-rank` and absolute `/data/` paths).

### 1. API key (for Ask AI)

In the **repo root**, copy `.env.example` to `.env` and set:

```bash
GEMINI_API_KEY=...
```

Without this, search/map still work; **Ask AI** shows a clear server message.

### 2. Install backend deps & start

```bash
cd backend
pip install -r requirements.txt
python app.py
```

### 3. Open

- **http://127.0.0.1:8080/** — project landing  
- **http://127.0.0.1:8080/navigator.html** — facility navigator only

---

Primary data source is **`data/clustered_dataframe_final.csv`**. The backend exposes this file at runtime via **`/api/facilities`**.
