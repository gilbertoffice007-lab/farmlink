"""Check the MongoDB Atlas connection before running the app.

Usage (from backend/):
    python scripts/check_mongo.py

Reads MONGODB_URI / MONGODB_DB from .env and reports:
  - server reachable (ping) + server version
  - database name + existing collections
  - whether the taxonomy + admin seed has been run
Exit code 0 = ready, 1 = fix the reported issue.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pymongo import MongoClient
from pymongo.errors import ConfigurationError, OperationFailure, ServerSelectionTimeoutError

from app.core.config import settings


def main() -> int:
    uri = (settings.MONGODB_URI or "").strip()
    if not uri:
        print("MISSING: MONGODB_URI is empty in backend/.env")
        print("Get it from Atlas: Database -> Connect -> Drivers -> Python.")
        print("Full steps: docs/mongodb-atlas.md")
        return 1
    masked = uri.split("@")[-1] if "@" in uri else uri
    print(f"Target: ...@{masked}  db={settings.MONGODB_DB}")
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=10000)
        hello = client.admin.command("ping")
        print("Ping:", hello)
        print("Server version:", client.server_info().get("version"))
    except (ServerSelectionTimeoutError, OperationFailure, ConfigurationError) as e:
        print("CONNECTION FAILED:", str(e)[:300])
        print("Check: password / IP allowlist (0.0.0.0/0 for Render) / user roles.")
        print("Full steps: docs/mongodb-atlas.md")
        return 1
    db = client[settings.MONGODB_DB]
    cols = sorted(db.list_collection_names())
    print("Collections:", cols if cols else "(none yet — first app start creates indexes)")
    print("Categories:", db.categories.count_documents({}))
    admin = db.users.find_one({"email": settings.SEED_ADMIN_EMAIL.lower()})
    print("Admin seeded:", bool(admin), f"({settings.SEED_ADMIN_EMAIL})" if admin else "(run: python scripts/seed.py)")
    print("MongoDB is ready for FarmLink.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
