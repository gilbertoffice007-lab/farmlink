# FarmLink — Deployment (MongoDB Atlas + Render + Vercel)

Production topology: **Vercel (frontend SPA + FastAPI serverless function)** → **MongoDB Atlas**. No mock data anywhere — the database starts with the taxonomy + admin only, and sellers publish real listings.

## 1. MongoDB Atlas (free tier)

> Full click-by-click guide with troubleshooting: **`docs/mongodb-atlas.md`** (start there).

1. Create an account at https://cloud.mongodb.com → **Create Cluster** (M0 free).
2. **Database Access** → Add user `farmlink-app` with a strong password (read/write on `farmlink`).
3. **Network Access** → Allow `0.0.0.0/0` (Render uses dynamic IPs) or Render's outbound IPs.
4. **Connect → Drivers → Python** → copy the SRV string:
   `mongodb+srv://farmlink-app:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
5. The app uses database name from `MONGODB_DB` (default `farmlink`); indexes are created automatically on startup.

## 2. Backend and frontend on Vercel

The repository root contains the Vercel configuration. `api/index.py` exposes the FastAPI app, while the same deployment builds the Vite frontend from `frontend/`.

**Important:** In Vercel project settings, set **Root Directory** to `.` (the repository root). Do not set it to `backend` or `frontend`. If the root is `backend`, Vercel runs `npm --prefix frontend install` as `backend/frontend` and fails with `package.json` not found.

1. Vercel Dashboard → **Add New → Project** → import this repository.
2. Leave **Root Directory** set to the repository root.
3. Vercel will use `vercel.json`, `requirements.txt`, and the `frontend/package.json` build.
4. Add these environment variables in Vercel:

| Key | Value |
|---|---|
| `PYTHON_VERSION` | `3.11` |
| `APP_ENV` | `production` |
| `MONGODB_URI` | Atlas SRV string (secret) |
| `MONGODB_DB` | `farmlink` |
| `JWT_SECRET_KEY` | 32+ random chars (Generate) |
| `CORS_ORIGINS` | `https://<your-app>.vercel.app` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | real admin credentials (secret) |

5. Add `VITE_API_BASE_URL=/api/v1` for the frontend. This uses the same Vercel origin for the API.
6. Deploy. Verify `https://<your-app>.vercel.app/health` and `https://<your-app>.vercel.app/docs`.
7. Seed MongoDB once from a local environment with the same production variables:
   `cd backend; python scripts/seed.py`

`UPLOAD_DIR` defaults to `/tmp/farmlink-uploads` on Vercel. Vercel storage is ephemeral, so uploaded images are not permanent. For persistent images, use Cloudinary, Amazon S3, or Cloudflare R2.

### Fixing a failed deployment caused by the root directory

In Vercel, open **Project → Settings → General → Root Directory**:

1. Change the value from `backend` to `.`.
2. Save the setting.
3. Open **Deployments**, select the failed deployment, and choose **Redeploy**.

The build log should then run `npm --prefix frontend install` from `/vercel/path0`, not `/vercel/path0/backend`.

## 3. Local development (unchanged workflow)

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

## 4. Environment reference

Backend (`backend/.env`): `APP_ENV, MONGODB_URI, MONGODB_DB, JWT_SECRET_KEY (≥32 chars), JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, CORS_ORIGINS, UPLOAD_DIR, MAX_UPLOAD_MB, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD`.
Frontend: `VITE_API_BASE_URL` (`.env` local, Vercel env var for production).

Never commit `.env`, credentials, or `uploads/`.
