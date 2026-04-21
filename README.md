# BHA-website-2.0

**NJ Behavioral Health Access Navigator** — a plausibility-focused prototype for finding behavioral health facilities using public data (SAMHSA-first), with rule-based ranking and optional AI re-ranking.

- **Project site:** `frontend/index.html` — scrollable landing (problem, solution, data sources, startup context).
- **Search tool:** `frontend/navigator.html` — ZIP, filters, map, Ask AI (Gemini via backend).

Preferred app is now the **Next.js frontend** in `webapp/` (single server, single `/` root):

```bash
cd webapp
npm install
npm run dev
```

Open **http://localhost:3000/** for the landing page, and **http://localhost:3000/navigator** for the navigator.

Legacy Flask app still exists in `backend/` + `frontend/`, but is optional during migration.

## New Next.js frontend (in progress)

A modern UI migration now lives in `webapp/` (Next.js + TypeScript + Tailwind).

Run it locally:

```bash
cd webapp
npm install
npm run dev
```

Open `http://localhost:3000` (new UI) and `http://localhost:3000/navigator` (new navigator).

Scoring details for the new navigator are documented in `webapp/README.md` under **Scoring model (Rule Score v2)**.

---

## Host temporarily for free (Render)

Use [Render](https://render.com) free Web Services (cold starts after idle; fine for demos).

### 1. Put the code on GitHub

1. Create a new repository on GitHub (empty is fine).
2. In your project folder, commit everything **except** secrets:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
   git push -u origin main
   ```

   Do **not** commit `.env` (it should stay gitignored). You will paste `GEMINI_API_KEY` in Render’s dashboard.

### 2. Sign up on Render

1. Go to [https://render.com](https://render.com) and sign up.
2. Connect your **GitHub** account when asked (so Render can pull your repo).

### 3. Create the Web Service

**Option A — Blueprint (if `render.yaml` is in the repo)**

1. In the Render dashboard: **New** → **Blueprint**.
2. Select the GitHub repo that contains this project.
3. Render reads `render.yaml`. When prompted, add the secret **`GEMINI_API_KEY`** (your Google AI Studio key).
4. Click **Apply** / deploy and wait for the build to finish.

**Option B — Manual Web Service**

1. **New** → **Web Service** → connect the same repo.
2. Settings:
   - **Runtime:** Python
   - **Branch:** `main` (or your default branch)
   - **Root directory:** leave **empty** (repository root).
   - **Build command:** `pip install -r backend/requirements.txt`
   - **Start command:** `gunicorn --bind 0.0.0.0:$PORT --workers 2 backend.app:app`
3. **Instance type:** Free.
4. **Environment variables:**
   - `GEMINI_API_KEY` = your key (required for **Ask AI**; search/map still work without it).
   - Optional: `GEMINI_MODEL` = e.g. `gemini-2.5-flash` if you override the default.
5. **Create Web Service** and wait until the deploy shows **Live**.

### 4. Open the site

Render gives you a URL like `https://bha-navigator.onrender.com`. Open it — you should see the landing page; `/navigator.html` is the facility search.

### 5. What to expect on the free tier

- The service **sleeps** after a while without traffic; the **first request** after sleep can take **30–60 seconds**.
- Free tier is for demos, not production SLAs.

### Troubleshooting

- **Build fails:** Check that `backend/requirements.txt` installs cleanly (Python 3.12 is set via `runtime.txt` / Render env).
- **502 / app crashes:** Confirm **Start command** matches the line above and that `backend/app.py` defines `app`.
- **Ask AI fails:** Set `GEMINI_API_KEY` in Render **Environment** and redeploy if needed.
