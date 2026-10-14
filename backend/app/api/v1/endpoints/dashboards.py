from collections import defaultdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends

from app.core.deps import get_current_user, require_admin, require_buyer_only, require_seller
from app.db.mongo import get_db, oid, to_rupees

router = APIRouter()
EXCLUDED = ("cancelled", "rejected")


def _live(orders):
    return [o for o in orders if o.get("status") not in EXCLUDED]


def _as_naive(dt):
    """MongoDB returns naive UTC datetimes; normalise aware ones too so
    comparisons never raise (this crashed /dashboard/seller on real data)."""
    if dt is None:
        return None
    return dt.replace(tzinfo=None) if dt.tzinfo is not None else dt


@router.get("/dashboard/buyer")
def buyer_dashboard(user: dict = Depends(require_buyer_only), db=Depends(get_db)):
    mine = list(db.orders.find({"buyer_id": user["id"]}).sort("created_at", -1))
    spent = sum((o.get("total_paise", 0) for o in _live(mine)), 0)
    recent = mine[:5]
    # recommendations: products from the most-ordered categories platform-wide
    cat_qty: dict = defaultdict(int)
    for it in db.order_items.find({}):
        p = db.products.find_one({"_id": oid(it.get("product_id"))}) if it.get("product_id") else None
        if p and p.get("category_id"):
            cat_qty[p["category_id"]] += 1
    top_cats = sorted(cat_qty, key=cat_qty.get, reverse=True)[:3]
    if top_cats:
        recs = list(db.products.find({"category_id": {"$in": top_cats}, "status": "active"}).limit(8))
    else:
        recs = list(db.products.find({"status": "active"}).limit(8))
    return {
        "total_orders": len(mine), "total_spent": float(to_rupees(spent)),
        "wishlist_count": db.wishlist.count_documents({"buyer_id": user["id"]}),
        "recent_orders": [{"id": str(o["_id"]), "order_number": o["order_number"], "status": o["status"],
                           "total_amount": float(to_rupees(o["total_paise"])), "created_at": o["created_at"]} for o in recent],
        "recommended_ids": [str(p["_id"]) for p in recs],
    }


@router.get("/dashboard/seller")
def seller_dashboard(user: dict = Depends(require_seller), db=Depends(get_db)):
    orders = list(db.orders.find({"seller_id": user["id"]}).sort("created_at", -1))
    live = _live(orders)
    revenue = sum((o.get("total_paise", 0) for o in live), 0)
    prods = list(db.products.find({"seller_id": user["id"]}))
    active_prods = [p for p in prods if p.get("status") == "active"]
    inventory = sum((float(p.get("available_quantity", 0)) for p in active_prods), 0.0)
    since = datetime.utcnow() - timedelta(days=14)
    by_day: dict = defaultdict(int)
    for o in live:
        created = _as_naive(o.get("created_at"))
        if created and created >= since:
            by_day[str(created.date())] += o.get("total_paise", 0)
    best: dict = defaultdict(lambda: [0.0, 0])
    for o in live:
        for it in db.order_items.find({"order_id": str(o["_id"])}):
            e = best[it["product_name_snapshot"]]
            e[0] += float(it.get("quantity", 0))
            e[1] += it.get("line_total_paise", 0)
    top = sorted(best.items(), key=lambda kv: -kv[1][0])[:5]
    return {
        "total_orders": len(orders),
        "pending_orders": sum(1 for o in orders if o.get("status") == "placed"),
        "revenue": float(to_rupees(revenue)),
        "active_listings": sum(1 for p in prods if p.get("status") == "active"),
        "inventory": inventory,
        "recent_orders": [{"id": str(o["_id"]), "order_number": o["order_number"], "status": o["status"],
                           "total_amount": float(to_rupees(o["total_paise"])), "created_at": o["created_at"]} for o in orders[:6]],
        "sales_by_day": [{"day": d, "total": float(to_rupees(t))} for d, t in sorted(by_day.items())],
        "best_sellers": [{"name": n, "qty": q, "total": float(to_rupees(t))} for n, (q, t) in top],
    }


@router.get("/dashboard/admin")
def admin_dashboard(user: dict = Depends(require_admin), db=Depends(get_db)):
    sales = sum((o.get("total_paise", 0) for o in _live(db.orders.find({}))), 0)
    return {
        "total_users": db.users.count_documents({}),
        "total_sellers": db.users.count_documents({"role": "seller"}),
        "active_listings": db.products.count_documents({"status": "active"}),
        "total_orders": db.orders.count_documents({}),
        "sales_volume": float(to_rupees(sales)),
    }


@router.get("/analytics/seller")
def seller_analytics(user: dict = Depends(require_seller), db=Depends(get_db)):
    return seller_dashboard(user, db)


@router.get("/analytics/demand")
def demand_insights(user: dict = Depends(get_current_user), db=Depends(get_db)):
    from app.db.mongo import oid as _oid
    if user["role"] == "seller":
        orders = {str(o["_id"]): o for o in db.orders.find({"seller_id": user["id"]})}
        items = [it for it in db.order_items.find({}) if it.get("order_id") in orders]
    else:
        orders = {str(o["_id"]): o for o in db.orders.find({})}
        items = list(db.order_items.find({}))
    by_product: dict = defaultdict(lambda: {"qty": 0.0, "revenue": 0, "orders": 0})
    by_cat: dict = defaultdict(int)
    n = 0
    for it in items:
        o = orders.get(it.get("order_id", ""))
        if not o or o.get("status") in EXCLUDED:
            continue
        n += 1
        e = by_product[it["product_name_snapshot"]]
        e["qty"] += float(it.get("quantity", 0))
        e["revenue"] += it.get("line_total_paise", 0)
        e["orders"] += 1
        p = db.products.find_one({"_id": _oid(it.get("product_id"))}) if it.get("product_id") else None
        if p and p.get("category_id"):
            c = db.categories.find_one({"_id": _oid(p["category_id"])})
            by_cat[c["name"] if c else "Other"] += float(it.get("quantity", 0))
    top = sorted(
        [{"name": k, "qty": v["qty"], "revenue": float(to_rupees(v["revenue"])), "orders": v["orders"]}
         for k, v in by_product.items()], key=lambda x: -x["qty"])[:10]
    filt = {"status": "active"}
    if user["role"] == "seller":
        filt["seller_id"] = user["id"]
    suggestions = []
    for p in db.products.find(filt):
        ordered = by_product.get(p["name"], {}).get("qty", 0)
        stock = float(p.get("available_quantity", 0))
        if stock < 10 or (ordered > stock > 0 and stock < 50):
            suggestions.append({"product": p["name"], "stock": stock, "ordered_qty": ordered,
                                "advice": "Consider restocking soon."})
    limited = n < 5
    return {
        "top_products": top,
        "category_demand": [{"category": k, "qty": v} for k, v in sorted(by_cat.items(), key=lambda x: -x[1])],
        "restock_suggestions": suggestions[:10],
        "limited_data": limited,
        "note": ("Based on limited order history so far." if limited
                 else "Based on recorded order history (simple totals, no ML forecasting)."),
    }


@router.get("/analytics/products")
def product_analytics(user: dict = Depends(get_current_user), db=Depends(get_db)):
    from app.db.mongo import oid as _oid
    counts: dict = defaultdict(int)
    for p in db.products.find({"status": "active"}):
        counts[p.get("category_id")] += 1
    out = []
    for cid, num in counts.items():
        name = "Uncategorised"
        if cid:
            c = db.categories.find_one({"_id": _oid(cid)})
            if c:
                name = c["name"]
        out.append({"category": name, "listings": num})
    return out


@router.get("/analytics/admin")
def admin_analytics(user: dict = Depends(require_admin), db=Depends(get_db)):
    by_day: dict = defaultdict(int)
    for o in _live(db.orders.find({})):
        if o.get("created_at"):
            by_day[str(o["created_at"].date())] += o.get("total_paise", 0)
    return {"sales_by_day": [{"day": d, "total": float(to_rupees(t))} for d, t in sorted(by_day.items())[:30]]}
