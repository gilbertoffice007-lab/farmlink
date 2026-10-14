from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import require_admin
from app.db.mongo import get_db, oid, to_rupees, utcnow

router = APIRouter()


def _audit(db, actor, action, entity=None, entity_id=None, details=None):
    db.audit_logs.insert_one({"actor_user_id": actor, "action": action, "entity": entity,
                              "entity_id": entity_id, "details": details, "created_at": utcnow()})


@router.get("/admin/users")
def list_users(user: dict = Depends(require_admin), db=Depends(get_db)):
    return [{"id": str(u["_id"]), "full_name": u["full_name"], "email": u["email"],
             "role": u["role"], "is_active": u.get("is_active", True),
             "created_at": u["created_at"]}
            for u in db.users.find({}).sort("created_at", -1).limit(500)]


@router.patch("/admin/users/{user_id}/status")
def set_user_status(user_id: str, body: dict, admin: dict = Depends(require_admin), db=Depends(get_db)):
    u = db.users.find_one({"_id": oid(user_id)})
    if not u:
        raise HTTPException(404, "User not found.")
    if str(u["_id"]) == admin["id"]:
        raise HTTPException(400, "You cannot suspend your own account.")
    active = bool(body.get("is_active", True))
    db.users.update_one({"_id": u["_id"]}, {"$set": {"is_active": active, "updated_at": utcnow()}})
    _audit(db, admin["id"], "user_status", "user", str(u["_id"]), f"is_active={active}")
    return {"message": "User status updated.", "is_active": active}


@router.get("/admin/sellers/pending")
def pending_sellers(user: dict = Depends(require_admin), db=Depends(get_db)):
    out = []
    for sp in db.seller_profiles.find({"verification_status": "pending"}):
        u = db.users.find_one({"_id": oid(sp["user_id"])})
        out.append({"profile_id": str(sp["_id"]), "user_id": sp["user_id"],
                    "farm_name": sp["farm_name"], "name": u["full_name"] if u else None,
                    "city": sp.get("city"), "state": sp.get("state"),
                    "status": sp.get("verification_status")})
    return out


@router.post("/admin/sellers/{seller_id}/approve")
def approve_seller(seller_id: str, admin: dict = Depends(require_admin), db=Depends(get_db)):
    r = db.seller_profiles.update_one({"user_id": seller_id}, {"$set": {"verification_status": "approved"}})
    if r.matched_count == 0:
        raise HTTPException(404, "Seller profile not found.")
    _audit(db, admin["id"], "seller_approve", "seller", seller_id)
    return {"message": "Seller approved."}


@router.post("/admin/sellers/{seller_id}/reject")
def reject_seller(seller_id: str, admin: dict = Depends(require_admin), db=Depends(get_db)):
    r = db.seller_profiles.update_one({"user_id": seller_id}, {"$set": {"verification_status": "rejected"}})
    if r.matched_count == 0:
        raise HTTPException(404, "Seller profile not found.")
    _audit(db, admin["id"], "seller_reject", "seller", seller_id)
    return {"message": "Seller rejected."}


@router.get("/admin/products")
def admin_products(user: dict = Depends(require_admin), db=Depends(get_db)):
    out = []
    for p in db.products.find({}).sort("created_at", -1).limit(300):
        seller = db.users.find_one({"_id": oid(p["seller_id"])})
        out.append({"id": str(p["_id"]), "name": p["name"], "price": float(to_rupees(p["price_paise"])),
                    "status": p.get("status"), "seller": seller["full_name"] if seller else None})
    return out


@router.patch("/admin/products/{product_id}/moderation")
def moderate_product(product_id: str, body: dict, admin: dict = Depends(require_admin), db=Depends(get_db)):
    status = body.get("status")
    if status not in ("active", "suspended", "inactive"):
        raise HTTPException(400, "Invalid status.")
    r = db.products.update_one({"_id": oid(product_id)}, {"$set": {"status": status, "updated_at": utcnow()}})
    if r.matched_count == 0:
        raise HTTPException(404, "Product not found.")
    _audit(db, admin["id"], "product_moderation", "product", product_id, f"status={status}")
    return {"message": f"Product {status}."}


@router.get("/admin/orders")
def admin_orders(user: dict = Depends(require_admin), db=Depends(get_db)):
    return [{"id": str(o["_id"]), "order_number": o["order_number"], "status": o["status"],
             "total_amount": float(to_rupees(o["total_paise"])),
             "buyer_id": o["buyer_id"], "seller_id": o["seller_id"], "created_at": o["created_at"]}
            for o in db.orders.find({}).sort("created_at", -1).limit(300)]


@router.get("/admin/audit-logs")
def audit_logs(user: dict = Depends(require_admin), db=Depends(get_db)):
    return [{"id": str(l["_id"]), "actor": l.get("actor_user_id"), "action": l["action"],
             "entity": l.get("entity"), "entity_id": l.get("entity_id"),
             "details": l.get("details"), "created_at": l["created_at"]}
            for l in db.audit_logs.find({}).sort("created_at", -1).limit(200)]
