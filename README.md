# FarmLink — Fresh From Farms. Fair For Everyone.

Direct farmer-to-buyer agricultural marketplace. Full-stack UI/UX academic project: **React + Vite + TS + Tailwind** frontend, **FastAPI + MongoDB** backend, JWT auth, role dashboards, cart/checkout, demand insights, logistics suggestions, EN/TA i18n.

> Live data only — no fabricated sellers, products, orders or testimonials. The database starts with the category taxonomy + admin; sellers publish real listings through the UI.

> Intended benefits (transparency, reach) are design goals — no claim of eliminating all intermediaries or guaranteeing income.

## Quick start

**Terminal 1 — Backend** (Windows PowerShell):
```powershell
cd backend
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env   # fill MONGODB_URI (see docs/mongodb-atlas.md) + JWT_SECRET_KEY
python scripts/check_mongo.py # verifies your Atlas connection
python scripts/seed.py        # categories + admin only — no mock data
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — Frontend:**
```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```
Open http://localhost:5173 (API at http://127.0.0.1:8000/docs).

Linux/macOS: replace venv/activate with `python3 -m venv .venv; source .venv/bin/activate` and `Copy-Item` with `cp`.

## Accounts (all real — nothing prefabricated)
- **Admin:** created by `python scripts/seed.py` from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `backend/.env`.
- **Sellers & buyers:** register through the UI. Sellers complete onboarding, request verification, and publish real listings.

## What was implemented
Landing (dark editorial hero + photo collage, produce marquee, category tiles, featured harvest with ratings, delivery band, how-it-works, testimonials, FAQ), auth + role guard + seller onboarding, marketplace (debounced search, category/sort/stock, pagination, wishlist, star ratings, rich cards), product details (gallery, qty, reviews with stars, delivery options, related), buyer dashboard, cart (free-delivery progress bar) + checkout (**delivery slots**, delivery instructions, address book CRUD, **free delivery over ₹499**, COD + simulated-online), order tracking (**timestamped timeline, ETA, slot, delivery notes**), seller workspace (stats, sales chart, best sellers, product CRUD + image upload, order accept/reject/fulfill), demand insights, **logistics delivery runs (lane groups + printable run sheet)**, notifications, admin console, EN/TA switcher, Fraunces + Inter design system with marquee/float/shimmer motion.

## Architecture
```
frontend/  src/{app/router, components, pages, lib(api,auth,i18n,images), locales/en+ta} · vercel.json · .env.production.example
backend/   app/{api/v1/endpoints, core(config,security,deps), db(mongo), schemas, services} scripts/seed.py tests/test_api.py · render.yaml
docs/      project-overview, ui-ux-design, user-flows, database-schema, api-documentation, testing, deployment
```

## Tests & builds
- `cd backend; python -m pytest tests/test_api.py -v` → **4 passed** (mongomock — no live MongoDB needed)
- `cd frontend; npm run build` → **success** (`tsc -b && vite build`, headless-browser render verified with zero console errors)
- Seed: `python scripts/seed.py` → 6 categories + admin (idempotent; `--reset` wipes collections for a clean slate)

## Deployment
- **Backend → Render:** `backend/render.yaml` blueprint + env table in `docs/deployment.md` (needs Atlas `MONGODB_URI`).
- **Frontend → Vercel:** `frontend/vercel.json` SPA rewrites; set `VITE_API_BASE_URL` to the Render URL (see `frontend/.env.production.example`).
- Full Atlas + Render + Vercel walkthrough: `docs/deployment.md`.

## Limitations (honest)
- Bearer JWT in localStorage for classroom simplicity (production → HttpOnly cookies + refresh).
- SQLite dev DB; Postgres + Alembic for production (schema is compatible).
- Simulated online payment clearly labelled; no real charge.
- Single 981KB JS chunk (recharts); code-split before production.
- Tamil covers nav/buttons/auth/actions; full coverage is future work. Voice is architecture-only.

See `docs/` for design system, flows, ER diagram, API reference, and deployment.
