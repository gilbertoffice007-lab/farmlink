# FarmLink — Testing

## Strategy
- Backend (pytest + TestClient): auth, duplicate email, admin-role rejection, seller onboarding gate, ownership isolation, cart qty/MOQ/stock, checkout totals (price×qty+₹40), stock decrement/restore, state-machine validity, role scoping, pagination.
- Frontend: Hook-Form/Zod validation, protected routes, debounced search, cart qty, checkout breakdown, skeletons/error/empty states, role nav, keyboard/label checks (manual + `tsc --noEmit`).
- Integration: buyer register→order; seller publish→accept→fulfill; admin approve→moderate.

## Actual results (run 2026-10-13)
- `python -m pytest tests/test_api.py -v` (from `backend/`): **4 passed** — register/login/duplicate, admin-block, seller→buyer flow (incl. over-stock 400, ownership 403, totals, invalid transition 400), pagination.
- `npm run build` (from `frontend/`): **success** — `tsc -b && vite build`, 2872 modules, `dist/` emitted (chunk-size warning only: 981KB single chunk from recharts, acceptable for classroom build).
- Manual smoke (backend `:8000` + seed): `/health ok`, `/products` returns 12 seeded items with imagery, `/orders/delivery/policy` live, order detail carries `history[]` + `estimated_delivery` (verified via admin token), production landing render-verified headless with zero console errors.

## Accounts used in tests (mongomock, ephemeral)
- Tests register fresh `*@example.com` users per run — nothing persists, nothing prefabricated in production data.

## Known limits
- Bearer tokens in localStorage (documented; production should use HttpOnly cookies + refresh rotation).
- SQLite row-lock is best-effort; Postgres `SELECT FOR UPDATE` recommended for true concurrency.
- Single 981KB JS chunk — code-splitting recommended before production.
