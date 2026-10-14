# FarmLink — Deployment (MongoDB Atlas + Render + Vercel)

Production topology: **Vercel (frontend SPA)** → HTTPS → **Render (FastAPI)** → **MongoDB Atlas**. No mock data anywhere — the database starts with the taxonomy + admin only, and sellers publish real listings.

## 1. MongoDB Atlas (free tier)

> Full click-by-click guide with troubleshooting: **`docs/mongodb-atlas.md`** (start there).

1. Create an account at https://cloud.mongodb.com → **Create Cluster** (M0 free).
2. **Database Access** → Add user `farmlink-app` with a strong password (read/write on `farmlink`).
3. **Network Access** → Allow `0.0.0.0/0` (Render uses dynamic IPs) or Render's outbound IPs.
4. **Connect → Drivers → Python** → copy the SRV string:
   `mongodb+srv://farmlink-app:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
5. The app uses database name from `MONGODB_DB` (default `farmlink`); indexes are created automatically on startup.

## 2. Backend on Render

Config is in `backend/render.yaml` (deploy as Blueprint) or manually:

1. Render Dashboard → **New → Web Service** → connect the repo, root directory `backend`.
2. Build: `pip install -r requirements.txt` · Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` · Health check: `/health`.
3. Environment variables (Render → Environment):

| Key | Value |
|---|---|
| `PYTHON_VERSION` | `3.11.9` |
| `APP_ENV` | `production` |
| `MONGODB_URI` | Atlas SRV string (secret) |
| `MONGODB_DB` | `farmlink` |
| `JWT_SECRET_KEY` | 32+ random chars (Generate) |
| `CORS_ORIGINS` | `https://<your-app>.vercel.app` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | real admin credentials (secret) |

4. After first deploy, create taxonomy + admin via Render **Shell**:
   `python scripts/seed.py` (run from the `backend/` directory).
5. Verify: `https://<service>.onrender.com/health` → `{"status":"ok",...}` and `/docs`.

> Uploads note: Render's filesystem is ephemeral — product images uploaded in production disappear on redeploy. For a lasting store, plug an S3/Cloudinary adapter behind `POST /uploads/image` (interface is already isolated in `app/api/v1/endpoints/uploads.py`).

## 3. Frontend on Vercel

`frontend/vercel.json` handles SPA routing (all routes → `index.html`).

1. Vercel Dashboard → **Add New → Project** → import repo, root directory `frontend` (framework auto-detected: Vite, build `npm run build`, output `dist/`).
2. **Environment Variables** → add `VITE_API_BASE_URL=https://<service>.onrender.com/api/v1` (Production).
3. Deploy. Then copy the Vercel URL back into Render's `CORS_ORIGINS` and redeploy the backend.

## 4. Local development (unchanged workflow)

Backend needs a reachable MongoDB — either local `mongod` or your Atlas cluster in `backend/.env` (`MONGODB_URI=`). Then:

```powershell
cd backend
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env   # fill MONGODB_URI + JWT_SECRET_KEY
python scripts/seed.py        # categories + admin, no fabricated data
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

```powershell
cd frontend
npm install
Copy-Item .env.example .env   # VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
npm run dev                   # http://localhost:5173
```

Tests (no live DB needed — mongomock): `cd backend; python -m pytest tests/test_api.py -v`.

## 5. Environment reference

Backend (`backend/.env`): `APP_ENV, MONGODB_URI, MONGODB_DB, JWT_SECRET_KEY (≥32 chars), JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, CORS_ORIGINS, UPLOAD_DIR, MAX_UPLOAD_MB, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD`.
Frontend: `VITE_API_BASE_URL` (`.env` local, Vercel env var for production).

Never commit `.env`, credentials, or `uploads/`.
