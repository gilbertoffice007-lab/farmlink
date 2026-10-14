"""FarmLink bootstrap seed — REAL data only.

Creates the product taxonomy and the administrator account. No demo
sellers, products, orders or reviews are fabricated: the marketplace starts
empty and fills with genuine listings that sellers publish through the UI.

Usage:
    python scripts/seed.py            # seed against MONGODB_URI in .env
    python scripts/seed.py --reset     # drop all collections first (dev only)
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.config import settings
from app.core.security import hash_password
from app.db.mongo import get_database, init_db, utcnow

CATEGORIES = [
    ("Vegetables", "vegetables", "Fresh daily-harvest vegetables"),
    ("Fruits", "fruits", "Seasonal fruits from orchards"),
    ("Grains & Cereals", "grains-cereals", "Rice, wheat, millets and more"),
    ("Pulses & Legumes", "pulses-legumes", "Dals, beans and lentils"),
    ("Spices", "spices", "Farm-grade spices"),
    ("Organic Produce", "organic-produce", "Organically grown lots"),
]


def main(reset: bool = False) -> None:
    init_db()
    db = get_database()
    if reset:
        for name in ("users", "seller_profiles", "categories", "products", "addresses",
                     "carts", "cart_items", "orders", "order_items", "status_history",
                     "reviews", "wishlist", "notifications", "audit_logs"):
            db[name].delete_many({})
        init_db()

    for name, slug, desc in CATEGORIES:
        db.categories.update_one(
            {"slug": slug},
            {"$setOnInsert": {"name": name, "slug": slug, "description": desc, "is_active": True}},
            upsert=True,
        )

    admin = db.users.find_one({"email": settings.SEED_ADMIN_EMAIL.lower()})
    if not admin:
        now = utcnow()
        res = db.users.insert_one({
            "full_name": "FarmLink Admin", "email": settings.SEED_ADMIN_EMAIL.lower(),
            "password_hash": hash_password(settings.SEED_ADMIN_PASSWORD), "role": "admin",
            "phone": None, "is_active": True, "created_at": now, "updated_at": now,
        })
        db.carts.insert_one({"buyer_id": str(res.inserted_id), "created_at": now, "updated_at": now})
        print("Administrator created:", settings.SEED_ADMIN_EMAIL)
    else:
        print("Administrator already exists:", settings.SEED_ADMIN_EMAIL)
    print("Categories:", db.categories.count_documents({}))
    print("Done. Sellers can now register and publish real listings.")


if __name__ == "__main__":
    main(reset="--reset" in sys.argv)
