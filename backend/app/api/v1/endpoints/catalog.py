from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.deps import get_current_user, require_admin, require_seller, require_seller_only
from app.db.mongo import get_db, oid, to_paise, utcnow
from app.schemas.common import (
    CategoryOut, ProductCreateIn, ProductOut, ProductUpdateIn,
    SellerOnboardingIn, SellerProfileOut,
)
from app.services.catalog import enrich_products, slugify

router = APIRouter()


def _cat_out(c: dict) -> CategoryOut:
    return CategoryOut(id=str(c["_id"]), name=c["name"], slug=c["slug"],
                       description=c.get("description"))


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db=Depends(get_db)):
    return [_cat_out(c) for c in db.categories.find({"is_active": True}).sort("name", 1)]


@router.get("/categories/{category_id}", response_model=CategoryOut)
def get_category(category_id: str, db=Depends(get_db)):
    _id = oid(category_id)
    cat = db.categories.find_one({"_id": _id}) if _id else None
    if not cat:
        raise HTTPException(404, "Category not found.")
    return _cat_out(cat)


@router.get("/stats")
def site_stats(db=Depends(get_db)):
    """Live marketplace counters for the landing page (real data only)."""
    return {
        "products": db.products.count_documents({"status": "active"}),
        "sellers": db.users.count_documents({"role": "seller", "is_active": True}),
        "categories": db.categories.count_documents({"is_active": True}),
        "orders": db.orders.count_documents({}),
    }


@router.get("/products", response_model=dict)
def list_products(
    db=Depends(get_db),
    q: Optional[str] = None,
    category_id: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    location: Optional[str] = None,
    in_stock: Optional[bool] = None,
    sort: str = Query(default="newest", pattern="^(newest|price_asc|price_desc|name)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=60),
):
    filt = {"status": "active"}
    if q:
        rx = {"$regex": q.strip(), "$options": "i"}
        filt["$or"] = [{"name": rx}, {"description": rx}, {"location": rx}]
    if category_id:
        filt["category_id"] = category_id
    if min_price is not None:
        filt["price_paise"] = {**filt.get("price_paise", {}), "$gte": int(min_price * 100)}
    if max_price is not None:
        filt["price_paise"] = {**filt.get("price_paise", {}), "$lte": int(max_price * 100)}
    if location:
        filt["location"] = {"$regex": location.strip(), "$options": "i"}
    if in_stock:
        filt["available_quantity"] = {"$gt": 0}
    order = {"created_at": -1}
    if sort == "price_asc":
        order = {"price_paise": 1}
    elif sort == "price_desc":
        order = {"price_paise": -1}
    elif sort == "name":
        order = {"name": 1}
    [(key, direction)] = list(order.items())
    total = db.products.count_documents(filt)
    rows = list(db.products.find(filt).sort(key, direction).skip((page - 1) * page_size).limit(page_size))
    return {
        "items": [p.model_dump() for p in enrich_products(db, rows)],
        "total": total, "page": page, "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size),
    }


@router.get("/products/featured", response_model=list[ProductOut])
def featured(db=Depends(get_db)):
    rows = list(db.products.find({"status": "active", "available_quantity": {"$gt": 0}})
                .sort("created_at", -1).limit(8))
    return enrich_products(db, rows)


@router.get("/products/mine", response_model=list[ProductOut])
def my_products(user: dict = Depends(require_seller), db=Depends(get_db)):
    rows = list(db.products.find({"seller_id": user["id"]}).sort("created_at", -1))
    return enrich_products(db, rows)


@router.get("/products/{product_id}", response_model=ProductOut)
def get_product(product_id: str, db=Depends(get_db)):
    _id = oid(product_id)
    p = db.products.find_one({"_id": _id}) if _id else None
    if not p:
        raise HTTPException(404, "Product not found.")
    return enrich_products(db, [p])[0]


def _cat_or_400(db, category_id: Optional[str]):
    if not category_id:
        return None
    _id = oid(category_id)
    cat = db.categories.find_one({"_id": _id}) if _id else None
    if not cat:
        raise HTTPException(400, "Invalid category.")
    return str(cat["_id"])


@router.post("/products", response_model=ProductOut, status_code=201)
def create_product(data: ProductCreateIn, user: dict = Depends(require_seller), db=Depends(get_db)):
    if user["role"] == "seller" and not db.seller_profiles.find_one({"user_id": user["id"]}):
        raise HTTPException(400, "Please complete seller onboarding before listing products.")
    cat_id = _cat_or_400(db, data.category_id)
    now = utcnow()
    res = db.products.insert_one({
        "seller_id": user["id"], "category_id": cat_id, "name": data.name.strip(),
        "slug": slugify(data.name), "description": data.description,
        "price_paise": to_paise(data.price), "unit": data.unit,
        "available_quantity": float(data.available_quantity),
        "minimum_order_quantity": float(data.minimum_order_quantity or 1),
        "image_url": data.image_url,
        "harvest_date": data.harvest_date.isoformat() if data.harvest_date else None,
        "location": data.location, "status": "active",
        "created_at": now, "updated_at": now,
    })
    return enrich_products(db, [db.products.find_one({"_id": res.inserted_id})])[0]


@router.patch("/products/{product_id}", response_model=ProductOut)
def update_product(product_id: str, data: ProductUpdateIn, user: dict = Depends(require_seller), db=Depends(get_db)):
    _id = oid(product_id)
    p = db.products.find_one({"_id": _id}) if _id else None
    if not p:
        raise HTTPException(404, "Product not found.")
    if p["seller_id"] != user["id"] and user["role"] != "admin":
        raise HTTPException(403, "You do not have permission to perform this action.")
    patch = {}
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is None:
            continue
        if field == "price":
            patch["price_paise"] = to_paise(value)
        elif field == "category_id":
            patch["category_id"] = _cat_or_400(db, value)
        elif field == "harvest_date":
            patch["harvest_date"] = value.isoformat() if value else None
        else:
            patch[field] = value
    if data.name:
        patch["slug"] = slugify(data.name)
    if patch:
        patch["updated_at"] = utcnow()
        db.products.update_one({"_id": _id}, {"$set": patch})
    return enrich_products(db, [db.products.find_one({"_id": _id})])[0]


@router.delete("/products/{product_id}")
def delete_product(product_id: str, user: dict = Depends(require_seller), db=Depends(get_db)):
    _id = oid(product_id)
    p = db.products.find_one({"_id": _id}) if _id else None
    if not p:
        raise HTTPException(404, "Product not found.")
    if p["seller_id"] != user["id"] and user["role"] != "admin":
        raise HTTPException(403, "You do not have permission to perform this action.")
    db.products.update_one({"_id": _id}, {"$set": {"status": "inactive", "updated_at": utcnow()}})
    return {"message": "Product deactivated."}


def _sp_out(sp: dict) -> SellerProfileOut:
    return SellerProfileOut(
        id=str(sp["_id"]), user_id=sp["user_id"], farm_name=sp["farm_name"],
        description=sp.get("description"), address=sp.get("address"), city=sp.get("city"),
        state=sp.get("state"), postal_code=sp.get("postal_code"),
        latitude=sp.get("latitude"), longitude=sp.get("longitude"),
        verification_status=sp.get("verification_status", "none"),
    )


@router.get("/sellers/me", response_model=SellerProfileOut)
def my_seller_profile(user: dict = Depends(require_seller_only), db=Depends(get_db)):
    sp = db.seller_profiles.find_one({"user_id": user["id"]})
    if not sp:
        raise HTTPException(404, "Seller profile not found. Please complete onboarding.")
    return _sp_out(sp)


@router.patch("/sellers/me", response_model=SellerProfileOut)
def update_seller_profile(data: SellerOnboardingIn, user: dict = Depends(require_seller_only), db=Depends(get_db)):
    now = utcnow()
    payload = {**data.model_dump(), "updated_at": now}
    db.seller_profiles.update_one(
        {"user_id": user["id"]},
        {"$set": payload, "$setOnInsert": {"user_id": user["id"], "verification_status": "none", "created_at": now}},
        upsert=True,
    )
    return _sp_out(db.seller_profiles.find_one({"user_id": user["id"]}))


@router.post("/sellers/verification-request")
def request_verification(user: dict = Depends(require_seller_only), db=Depends(get_db)):
    sp = db.seller_profiles.find_one({"user_id": user["id"]})
    if not sp:
        raise HTTPException(400, "Please complete seller onboarding first.")
    db.seller_profiles.update_one({"_id": sp["_id"]}, {"$set": {"verification_status": "pending"}})
    db.audit_logs.insert_one({"actor_user_id": user["id"], "action": "verification_request",
                              "entity": "seller", "entity_id": str(sp["_id"]),
                              "details": None, "created_at": utcnow()})
    return {"message": "Verification request submitted.", "status": "pending"}


@router.get("/sellers/{seller_id}")
def seller_public(seller_id: str, db=Depends(get_db)):
    _id = oid(seller_id)
    u = db.users.find_one({"_id": _id}) if _id else None
    if not u or u.get("role") not in ("seller", "admin"):
        raise HTTPException(404, "Seller not found.")
    sp = db.seller_profiles.find_one({"user_id": str(u["_id"])})
    prods = db.products.count_documents({"seller_id": str(u["_id"]), "status": "active"})
    return {
        "seller_id": str(u["_id"]), "name": u["full_name"],
        "farm_name": sp["farm_name"] if sp else None,
        "city": sp.get("city") if sp else None, "state": sp.get("state") if sp else None,
        "verification_status": sp.get("verification_status", "none") if sp else "none",
        "active_listings": prods,
    }
