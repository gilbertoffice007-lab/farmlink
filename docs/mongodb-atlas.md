# MongoDB Atlas — Configuration for FarmLink

This guide takes you from zero to a working `MONGODB_URI` for local development **and** Render deployment. You only do this once; both environments can share one cluster (different database names optional).

## What you will create

| Item | Recommended value |
|---|---|
| Cluster | `farmlink-cluster`, M0 free tier, any nearby region |
| Database user | `farmlink-app` (password: generate + save it) |
| Database name | `farmlink` (set via `MONGODB_DB`) |
| Network access | `0.0.0.0/0` (required for Render; for local-only dev you may use your IP) |

## Step 1 — Create the free cluster

1. Sign up / sign in at https://cloud.mongodb.com.
2. **Create → M0 Free** → name it `farmlink-cluster` → pick the region closest to you → **Create Cluster** (takes ~3 minutes).

## Step 2 — Create the database user

1. **Security → Database Access → Add New Database User**.
2. Authentication: **Password** → username `farmlink-app` → **Autogenerate** a password → **copy it somewhere safe**.
3. **Database User Privileges → Read and write to any database** (simplest correct role for this app).
4. **Add User**.

## Step 3 — Allow network connections

1. **Security → Network Access → Add IP Address**.
2. For deployment on Render (dynamic IPs): **Allow Access from Anywhere** → `0.0.0.0/0` → Confirm.
   - The database stays protected by the username + strong password.
   - For local-only development you can instead add just your current IP.

## Step 4 — Copy the connection string

1. **Database → Connect → Drivers → Python** (version 3.6 or later).
2. Copy the SRV string. It looks like:
   `mongodb+srv://farmlink-app:<password>@farmlink-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority`
3. **Replace `<password>`** with the password from Step 2 (if it contains symbols like `@` or `/`, URL-encode them).

## Step 5 — Configure FarmLink

**Local (`backend/.env`):**
```ini
MONGODB_URI=mongodb+srv://farmlink-app:<password>@farmlink-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=farmlink
```

**Render (dashboard → your service → Environment):** set the same two keys (`MONGODB_URI` as a secret). No code change needed — `render.yaml` already declares them.

## Step 6 — Verify (before starting the app)

From the `backend/` directory:

```powershell
python scripts/check_mongo.py
```

Expected output:

```
Target: ...@farmlink-cluster.xxxxx.mongodb.net/...  db=farmlink
Ping: {'ok': 1.0}
Server version: 8.x.x
Collections: [...]
Categories: 6
Admin seeded: True/False
MongoDB is ready for FarmLink.
```

If it fails, the script tells you exactly what to check (empty URI, wrong password, IP allowlist, user roles).

## Step 7 — Create taxonomy + admin

```powershell
python scripts/seed.py
```

This inserts the 6 product categories and the admin user from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. Re-running is safe (idempotent). Then start the API:

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ServerSelectionTimeoutError` / timeout | IP not allowlisted → add `0.0.0.0/0`; or cluster still starting |
| `Authentication failed` | Wrong password (re-copy from Database Access → Edit → Show), or user deleted |
| `SSL handshake failed` | Very old Python/OpenSSL — use Python 3.11+ (Render already pins `3.11.9`) |
| `check_mongo.py` says URI empty | You edited `.env.example` instead of `.env` — copy it first |
| App starts but `/stats` shows blanks | Seed not run yet → `python scripts/seed.py` |

## Reference (how the app uses Atlas)

- Connection: `backend/app/db/mongo.py` (`MongoClient(settings.MONGODB_URI)`), database `settings.MONGODB_DB`.
- Indexes (unique emails, order numbers, cart/wishlist/review pairs) are created automatically on startup — no manual Atlas index setup needed.
- Money is stored as integer paise; ids are ObjectIds exposed as strings. See `docs/database-schema.md`.
