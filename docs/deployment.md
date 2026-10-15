# FarmLink — Deployment (MongoDB Atlas + Render + Vercel)

Production topology: **Vercel (frontend SPA)** → **Render (FastAPI API)** → **MongoDB Atlas**. No mock data anywhere — the database starts with the taxonomy + admin only, and sellers publish real listings.

## 1. MongoDB Atlas (free tier)

> Full click-by-click guide with troubleshooting: **`docs/mongodb-atlas.md`** (start there).

1. Create an account at https://cloud.mongodb.com → **Create Cluster** (M0 free).
2. **Database Access** → Add user `farmlink-app` with a strong password (read/write on `farmlink`).
3. **Network Access** → Allow `0.0.0.0/0` (Render uses dynamic IPs) or Render's outbound IPs.
4. **Connect → Drivers → Python** → copy the SRV string:
   `mongodb+srv://farmlink-app:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
5. The app uses database name from `MONGODB_DB` (default `farmlink`); indexes are created automatically on startup.

## 2. Backend on Render

The repository root contains [`render.yaml`](../render.yaml) and [`.python-version`](../.python-version), a Render Blueprint and Python version pin for the FastAPI backend. It installs dependencies from `backend/requirements.txt`, requires a binary `pydantic-core` wheel, starts `app.main:app` on Render's `$PORT`, and uses `/health` for health checks. The shared Python version is `3.12`, which is available to both Render and Vercel.

1. Render Dashboard → **New → Blueprint**.
2. Select this repository and keep the Blueprint file set to `render.yaml` at the repository root.
3. Review the `farmlink-api` web service and deploy it.
4. In the service's Environment settings, provide:

| Key | Value |
|---|---|
| `MONGODB_URI` | Atlas SRV string (secret) |
| `MONGODB_DB` | `farmlink` |
| `JWT_SECRET_KEY` | Generate a 32+ character secret |
| `CORS_ORIGINS` | Your Vercel URL, for example `https://farmlink.vercel.app` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Real admin credentials (secret) |

The Blueprint supplies the remaining non-secret defaults. Render generates `JWT_SECRET_KEY` automatically when the service is created. After the first deploy, copy the public service URL (for example `https://farmlink-api.onrender.com`) for the frontend configuration below.

Seed the production database once from a trusted local environment using the same production variables:

```powershell
cd backend
python scripts/seed.py
```

## 3. Frontend on Vercel

The repository root contains the Vercel configuration for the Vite frontend in `frontend/`.

**Important:** In Vercel project settings, set **Root Directory** to `.` (the repository root). Do not set it to `backend` or `frontend`. If the root is `backend`, Vercel runs `npm --prefix frontend install` as `backend/frontend` and fails with `package.json` not found.

1. Vercel Dashboard → **Add New → Project** → import this repository.
2. Leave **Root Directory** set to the repository root.
3. Vercel will use `vercel.json`, `requirements.txt`, and the `frontend/package.json` build.
4. Add `VITE_API_BASE_URL` in Vercel, using the Render service URL:

| Key | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://farmlink-api.onrender.com/api/v1` |
5. Deploy. Verify the Render API at `https://farmlink-api.onrender.com/health` and the frontend at `https://<your-app>.vercel.app/`.

`UPLOAD_DIR` defaults to `/tmp/farmlink-uploads` on Vercel. Vercel storage is ephemeral, so uploaded images are not permanent. For persistent images, use Cloudinary, Amazon S3, or Cloudflare R2.

### Fixing a failed deployment caused by the root directory

In Vercel, open **Project → Settings → General → Root Directory**:

1. Change the value from `backend` to `.`.
2. Save the setting.
3. Open **Deployments**, select the failed deployment, and choose **Redeploy**.

The build log should then run `npm --prefix frontend install` from `/vercel/path0`, not `/vercel/path0/backend`.

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
