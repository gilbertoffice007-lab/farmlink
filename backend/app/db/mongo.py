"""MongoDB connection, indexes and shared document helpers.

Money rule: ALL money is stored as integer paise (never float) and converted
to Decimal rupees at the API boundary. Quantities (kg etc.) are plain floats.
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from bson import ObjectId
from pymongo import ASCENDING, MongoClient

from app.core.config import settings

_client = None
_test_db = None

COLLECTIONS = [
    "users", "seller_profiles", "categories", "products", "addresses",
    "carts", "cart_items", "orders", "order_items", "status_history",
    "reviews", "wishlist", "notifications", "audit_logs",
]


def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=8000)
    return _client


def get_database():
    if _test_db is not None:
        return _test_db
    return get_client()[settings.MONGODB_DB]


def set_test_db(db) -> None:
    """Tests inject a mongomock database here (see tests/test_api.py)."""
    global _test_db
    _test_db = db


def get_db():
    """FastAPI dependency — yields the Mongo database handle."""
    yield get_database()


def init_db() -> None:
    """Create unique indexes (idempotent). Never raises: a transient Atlas
    hiccup must not kill the app — requests will surface real DB errors."""
    try:
        _create_indexes()
    except Exception as e:
        print(f"[farmlink] Mongo init warning (indexes skipped, will retry next start): {str(e)[:200]}")


def _create_indexes() -> None:
    db = get_database()
    db.users.create_index([("email", ASCENDING)], unique=True)
    db.seller_profiles.create_index([("user_id", ASCENDING)], unique=True)
    db.categories.create_index([("slug", ASCENDING)], unique=True)
    db.products.create_index([("seller_id", ASCENDING)])
    db.products.create_index([("category_id", ASCENDING), ("status", ASCENDING)])
    db.carts.create_index([("buyer_id", ASCENDING)], unique=True)
    db.cart_items.create_index([("cart_id", ASCENDING), ("product_id", ASCENDING)], unique=True)
    db.orders.create_index([("order_number", ASCENDING)], unique=True)
    db.orders.create_index([("buyer_id", ASCENDING)])
    db.orders.create_index([("seller_id", ASCENDING)])
    db.orders.create_index([("status", ASCENDING)])
    db.order_items.create_index([("order_id", ASCENDING)])
    db.status_history.create_index([("order_id", ASCENDING)])
    db.reviews.create_index([("product_id", ASCENDING)])
    db.reviews.create_index([("order_id", ASCENDING), ("product_id", ASCENDING)], unique=True)
    db.wishlist.create_index([("buyer_id", ASCENDING), ("product_id", ASCENDING)], unique=True)
    db.notifications.create_index([("user_id", ASCENDING)])


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def oid(id_str) -> Optional[ObjectId]:
    try:
        return ObjectId(str(id_str))
    except Exception:
        return None


def sid(doc) -> Optional[str]:
    """Serialize a document _id to string id (mutates a copy)."""
    if not doc:
        return None
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return doc


def to_paise(amount: Decimal) -> int:
    return int((Decimal(amount) * 100).to_integral_value())


def to_rupees(paise) -> Decimal:
    return (Decimal(int(paise or 0)) / 100).quantize(Decimal("0.01"))
