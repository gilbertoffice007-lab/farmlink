"""FarmLink API tests on MongoDB (mongomock — no live server needed)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import mongomock  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import mongo as mongo_mod  # noqa: E402
from app.db.mongo import init_db  # noqa: E402

mongo_mod.set_test_db(mongomock.MongoClient().farmlink_test)

from app.main import app  # noqa: E402

client = TestClient(app)


def setup_module():
    db = mongo_mod.get_database()
    for name in mongo_mod.COLLECTIONS:
        db[name].delete_many({})
    init_db()


def _register(email, role="buyer"):
    r = client.post("/api/v1/auth/register", json={
        "full_name": "Test User", "email": email, "password": "Password123!", "role": role})
    assert r.status_code == 201, r.text
    return r.json()


def test_register_login_duplicate():
    _register("t1@example.com")
    r = client.post("/api/v1/auth/register", json={
        "full_name": "Dup", "email": "t1@example.com", "password": "Password123!", "role": "buyer"})
    assert r.status_code == 400
    r = client.post("/api/v1/auth/login", json={"email": "t1@example.com", "password": "Password123!"})
    assert r.status_code == 200
    r = client.post("/api/v1/auth/login", json={"email": "t1@example.com", "password": "wrongpass1"})
    assert r.status_code == 401


def test_admin_never_via_public_registration():
    r = client.post("/api/v1/auth/register", json={
        "full_name": "Hacker", "email": "hack@example.com", "password": "Password123!", "role": "admin"})
    assert r.status_code in (400, 422)


def test_seller_buyer_flow():
    s = _register("seller1@example.com", "seller")
    H = {"Authorization": f"Bearer {s['access_token']}"}
    # onboarding required before product
    r = client.post("/api/v1/products", json={"name": "TestX", "price": 10, "available_quantity": 5}, headers=H)
    assert r.status_code == 400
    r = client.patch("/api/v1/sellers/me", json={"farm_name": "Test Farm", "city": "Chennai"}, headers=H)
    assert r.status_code == 200, r.text
    r = client.post("/api/v1/products", json={"name": "Test Tomato", "price": 50,
                                              "available_quantity": 10, "location": "Chennai"}, headers=H)
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    assert isinstance(pid, str)
    # isolation: another seller cannot edit
    s2 = _register("seller2@example.com", "seller")
    H2 = {"Authorization": f"Bearer {s2['access_token']}"}
    client.patch("/api/v1/sellers/me", json={"farm_name": "F2"}, headers=H2)
    r = client.patch(f"/api/v1/products/{pid}", json={"price": 1}, headers=H2)
    assert r.status_code == 403
    # buyer cart + checkout with delivery slot
    b = _register("buyer1@example.com")
    BH = {"Authorization": f"Bearer {b['access_token']}"}
    r = client.post("/api/v1/addresses", json={"recipient_name": "B", "phone": "9999999999",
                    "address_line": "1 St", "city": "Chennai", "state": "TN", "postal_code": "600001"}, headers=BH)
    assert r.status_code == 201
    addr = r.json()["id"]
    r = client.post("/api/v1/cart/items", json={"product_id": pid, "quantity": 2}, headers=BH)
    assert r.status_code == 200, r.text
    # over-stock rejected
    r = client.post("/api/v1/cart/items", json={"product_id": pid, "quantity": 999}, headers=BH)
    assert r.status_code == 400
    r = client.post("/api/v1/orders", json={"delivery_address_id": addr, "fulfillment_type": "delivery",
                                            "payment_method": "cod", "delivery_slot": "tomorrow_morning",
                                            "delivery_instructions": "Call me"}, headers=BH)
    assert r.status_code == 200, r.text
    created = r.json()[0]
    assert float(created["total_amount"]) == 50 * 2 + 40
    assert created["delivery_slot"] == "tomorrow_morning"
    assert created["estimated_delivery"] is not None
    assert len(created["history"]) == 1
    oid = created["id"]
    # seller accepts, invalid jump rejected
    r = client.post(f"/api/v1/orders/{oid}/accept", headers=H)
    assert r.status_code == 200
    r = client.post(f"/api/v1/orders/{oid}/status", json={"status": "delivered"}, headers=H)
    assert r.status_code == 400
    # delivery policy is public
    r = client.get("/api/v1/orders/delivery/policy")
    assert r.status_code == 200 and r.json()["free_delivery_min_subtotal"] == 499.0


def test_pagination_and_stats():
    r = client.get("/api/v1/products", params={"page": 1, "page_size": 5})
    assert r.status_code == 200 and "total" in r.json()
    r = client.get("/api/v1/stats")
    assert r.status_code == 200 and "products" in r.json()


def test_buyer_seller_separation():
    buyer = _register("sepbuyer@example.com")
    seller = _register("sepseller@example.com", "seller")
    BH = {"Authorization": f"Bearer {buyer['access_token']}"}
    SH = {"Authorization": f"Bearer {seller['access_token']}"}
    # seller cannot shop: cart, checkout, wishlist, reviews, addresses
    assert client.get("/api/v1/cart", headers=SH).status_code == 403
    assert client.post("/api/v1/cart/items", json={"product_id": "x", "quantity": 1}, headers=SH).status_code == 403
    assert client.post("/api/v1/orders", json={}, headers=SH).status_code == 403
    assert client.post("/api/v1/wishlist/x", headers=SH).status_code == 403
    assert client.get("/api/v1/addresses", headers=SH).status_code == 403
    assert client.get("/api/v1/dashboard/buyer", headers=SH).status_code == 403
    # buyer cannot sell: products, farm profile, verification
    assert client.post("/api/v1/products", json={"name": "Nope", "price": 5, "available_quantity": 1}, headers=BH).status_code == 403
    assert client.get("/api/v1/products/mine", headers=BH).status_code == 403
    assert client.get("/api/v1/sellers/me", headers=BH).status_code == 403
    assert client.patch("/api/v1/sellers/me", json={"farm_name": "Nope"}, headers=BH).status_code == 403
    assert client.post("/api/v1/sellers/verification-request", headers=BH).status_code == 403


def test_seller_dashboard_with_real_mongo_style_naive_dates():
    """Real MongoDB returns naive UTC datetimes (mongomock preserves aware
    ones), which used to crash /dashboard/seller with TypeError."""
    from datetime import datetime
    from app.db import mongo as mongo_mod
    db = mongo_mod.get_database()
    s = _register("naive1@example.com", "seller")
    H = {"Authorization": f"Bearer {s['access_token']}"}
    client.patch("/api/v1/sellers/me", json={"farm_name": "Naive Farm"}, headers=H)
    r = client.post("/api/v1/products", json={"name": "Naive Beans", "price": 20,
                                              "available_quantity": 7, "location": "X"}, headers=H)
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    # a real order, like Gil Farm's delivered/placed ones
    nb = _register("naivebuyer@example.com")
    NBH = {"Authorization": f"Bearer {nb['access_token']}"}
    r = client.post("/api/v1/addresses", json={"recipient_name": "N", "phone": "9999999999",
                    "address_line": "1 St", "city": "C", "state": "S", "postal_code": "600001"}, headers=NBH)
    assert r.status_code == 201, r.text
    client.post("/api/v1/cart/items", json={"product_id": pid, "quantity": 2}, headers=NBH)
    r = client.post("/api/v1/orders", json={"fulfillment_type": "delivery", "payment_method": "cod"}, headers=NBH)
    assert r.status_code == 200, r.text
    # rewrite stored datetimes to naive, exactly as Atlas returns them
    naive = datetime.utcnow()
    for coll in ("users", "seller_profiles", "products", "orders", "order_items", "status_history"):
        for doc in db[coll].find({}):
            upd = {}
            for k in ("created_at", "updated_at"):
                if doc.get(k) is not None:
                    upd[k] = naive
            if upd:
                db[coll].update_one({"_id": doc["_id"]}, {"$set": upd})
    r = client.get("/api/v1/dashboard/seller", headers=H)
    assert r.status_code == 200, r.text
    assert r.json()["total_orders"] >= 1 and r.json()["active_listings"] >= 1
    r = client.get("/api/v1/analytics/demand", headers=H)
    assert r.status_code == 200, r.text
