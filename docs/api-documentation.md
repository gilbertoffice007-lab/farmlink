# FarmLink — API Documentation

Base: `http://127.0.0.1:8000/api/v1` · Swagger: `http://127.0.0.1:8000/docs` · Auth: `Authorization: Bearer <JWT>`.

## Auth
- `POST /auth/register` {full_name,email,password,role:buyer|seller} → 201 {access_token,user} · 400 duplicate
- `POST /auth/login` → 200 · 401 invalid
- `POST /auth/logout` → 200 (client discards token)
- `GET /auth/me` → 200

## Catalog
- `GET /categories`, `GET /categories/{id}`
- `GET /products?q&category_id&min_price&max_price&location&in_stock&sort&page&page_size` → {items,total,page,pages}
- `GET /products/featured` · `GET /products/mine` (seller) · `GET /products/{id}`
- `POST /products` (seller, onboarding required) · `PATCH /products/{id}` (owner/admin) · `DELETE /products/{id}` (soft → inactive)
- `GET /sellers/me`, `PATCH /sellers/me`, `POST /sellers/verification-request`, `GET /sellers/{id}`

## Cart / Addresses
- `GET /cart` · `POST /cart/items` {product_id,quantity} · `PATCH /cart/items/{id}` · `DELETE /cart/items/{id}` · `DELETE /cart`
- `GET /addresses` · `POST /addresses` · `DELETE /addresses/{id}`

## Orders (one seller per order; multi-seller carts split)
- `POST /orders` {delivery_address_id,fulfillment_type,payment_method,buyer_notes,delivery_slot,delivery_instructions} → 200 [Order] (server recalculates totals; pickup free, delivery ₹40/order and **FREE when that seller's subtotal ≥ ₹499**; stock locked & decremented transactionally)
- `GET /orders/delivery/policy` (public) → {delivery_fee, free_delivery_min_subtotal, slots[], eta_days}
- Order detail includes `delivery_slot`, `delivery_instructions`, `estimated_delivery` (+2d delivery / +1d pickup, estimate only) and timestamped `history[]`.
- Products include `rating_avg` + `rating_count` (single grouped aggregate, no N+1).
- `GET /orders` (role-scoped) · `GET /orders/{id}` (owner/admin)
- `POST /orders/{id}/cancel` (buyer, placed/accepted; restores stock)
- `POST /orders/{id}/accept|reject` (seller; reject restores stock)
- `POST /orders/{id}/status` {status,note} (valid transitions only)

## Reviews / Wishlist
- `GET /products/{id}/reviews` · `POST /products/{id}/reviews` {rating,order_id,comment} (completed-order buyer only)
- `GET /wishlist` · `POST /wishlist/{id}` · `DELETE /wishlist/{id}`

## Dashboards / Analytics
- `GET /dashboard/buyer|seller|admin` · `GET /analytics/seller|demand|products|admin`
- Demand = plain historical totals + restock heuristics; response includes `limited_data` + note. No ML claimed.

## Notifications / Uploads / Logistics
- `GET /notifications` · `PATCH /notifications/{id}/read`
- `POST /uploads/image` (multipart, JPG/PNG/WebP ≤5MB → `/uploads/<uuid>.ext`)
- `GET /logistics/suggestions` (seller/admin; groups by pickup+delivery city, haversine km when coords exist, review-only, no auto-merge)
- `POST /logistics/route-suggestions` {stops:[{lat,lng}]} → nearest-neighbour order (explainable baseline)

## Admin (admin only, audited)
- `GET /admin/users` · `PATCH /admin/users/{id}/status`
- `GET /admin/sellers/pending` · `POST /admin/sellers/{id}/approve|reject`
- `GET /admin/products` · `PATCH /admin/products/{id}/moderation` {active|suspended|inactive}
- `GET /admin/orders` · `GET /admin/audit-logs`

Errors: consistent `{detail}` + 401/403/404/400/422/500 (never raw SQL). Pagination: `{total,page,page_size,pages}`.
