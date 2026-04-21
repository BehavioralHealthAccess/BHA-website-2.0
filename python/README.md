# Python (data tooling)

This repo is primarily frontend + backend. This folder holds **Python-only** pieces: the SAMHSA cleaning notebook, `requirements.txt`, and the local **`.venv`**.

From `python/`:

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

The project now runs from **`../data/clustered_dataframe_final.csv`** as the canonical data file.

**Notebook kernel:** In VS Code / Cursor, pick **`python/.venv/bin/python`** or the kernel **Python (BHA python/.venv)** — not the system Python (e.g. 3.13). The repo’s `.vscode/settings.json` points the default interpreter at `python/.venv`. If you see “requires the ipykernel package”, you’re on the wrong interpreter; switch it or run `pip install ipykernel` in *that* Python only if you intentionally avoid the venv.
