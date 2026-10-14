"""Catalog helpers over Mongo documents."""
import re
from datetime import date
from typing import Dict, List, Optional, Tuple

from app.db.mongo import get_database, oid, to_rupees
from app.schemas.common import ProductOut


def slugify(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", name.strip().lower()).strip("-")
    return s[:150] or "product"


def rating_map(db, product_ids: List[str]) -> Dict[str, Tuple[float, int]]:
    """Average rating + count per product id (single pass over reviews)."""
    agg: Dict[str, list] = {}
    for r in db.reviews.find({"product_id": {"$in": product_ids}}):
        e = agg.setdefault(r["product_id"], [0, 0])
        e[0] += r["rating"]
        e[1] += 1
    return {pid: (round(total / cnt, 1), cnt) for pid, (total, cnt) in agg.items()}


def _harvest(value) -> Optional[date]:
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def build_product_out(p: dict, seller=None, farm=None, category=None,
                      rating: Optional[Tuple[float, int]] = None) -> ProductOut:
    avg, cnt = rating or (None, 0)
    return ProductOut(
        id=str(p["_id"]), seller_id=p["seller_id"], category_id=p.get("category_id"),
        name=p["name"], slug=p.get("slug", ""), description=p.get("description"),
        price=to_rupees(p["price_paise"]), unit=p.get("unit", "kg"),
        available_quantity=float(p.get("available_quantity", 0)),
        minimum_order_quantity=float(p.get("minimum_order_quantity", 1)),
        image_url=p.get("image_url"), harvest_date=_harvest(p.get("harvest_date")),
        location=p.get("location"), status=p.get("status", "active"),
        created_at=p["created_at"],
        seller_name=seller.get("full_name") if seller else None,
        farm_name=farm.get("farm_name") if farm else None,
        category_name=category.get("name") if category else None,
        rating_avg=avg, rating_count=cnt,
    )


def enrich_products(db, products: List[dict]) -> List[ProductOut]:
    """Batch-load sellers/farms/categories/ratings for a product list."""
    seller_ids = list({p["seller_id"] for p in products if p.get("seller_id")})
    sellers = {}
    if seller_ids:
        for u in db.users.find({"_id": {"$in": [o for o in (oid(s) for s in seller_ids) if o]}}):
            sellers[str(u["_id"])] = u
    farms = {sp["user_id"]: sp for sp in db.seller_profiles.find({"user_id": {"$in": seller_ids}})} if seller_ids else []
    cat_ids = list({p["category_id"] for p in products if p.get("category_id")})
    cats = {}
    if cat_ids:
        for c in db.categories.find({"_id": {"$in": [o for o in (oid(c) for c in cat_ids) if o]}}):
            cats[str(c["_id"])] = c
    ratings = rating_map(db, [str(p["_id"]) for p in products])
    out = []
    for p in products:
        s = sellers.get(p.get("seller_id", ""))
        out.append(build_product_out(p, s, farms.get(p.get("seller_id", "")),
                                     cats.get(p.get("category_id") or ""), ratings.get(str(p["_id"]))))
    return out
