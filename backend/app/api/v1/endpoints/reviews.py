from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import require_buyer_only
from app.db.mongo import get_db, oid, utcnow
from app.schemas.common import ProductOut, ReviewIn, ReviewOut
from app.services.catalog import enrich_products

router = APIRouter()


@router.get("/products/{product_id}/reviews", response_model=list[ReviewOut])
def list_reviews(product_id: str, db=Depends(get_db)):
    out = []
    for r in db.reviews.find({"product_id": product_id}).sort("created_at", -1):
        buyer = db.users.find_one({"_id": oid(r["buyer_id"])})
        out.append(ReviewOut(id=str(r["_id"]), buyer_id=r["buyer_id"], product_id=r["product_id"],
                             order_id=r["order_id"], rating=r["rating"], comment=r.get("comment"),
                             created_at=r["created_at"],
                             buyer_name=buyer["full_name"] if buyer else None))
    return out


@router.post("/products/{product_id}/reviews", response_model=ReviewOut, status_code=201)
def add_review(product_id: str, data: ReviewIn, user: dict = Depends(require_buyer_only), db=Depends(get_db)):
    p = db.products.find_one({"_id": oid(product_id)})
    if not p:
        raise HTTPException(404, "Product not found.")
    o = db.orders.find_one({"_id": oid(data.order_id)})
    if not o or o["buyer_id"] != user["id"] or o["status"] not in ("delivered", "collected"):
        raise HTTPException(400, "Only buyers with completed orders can review.")
    if not db.order_items.find_one({"order_id": str(o["_id"]), "product_id": str(p["_id"])}):
        raise HTTPException(400, "This product was not part of that order.")
    if db.reviews.find_one({"order_id": str(o["_id"]), "product_id": str(p["_id"])}):
        raise HTTPException(400, "You have already reviewed this product for this order.")
    now = utcnow()
    res = db.reviews.insert_one({"buyer_id": user["id"], "product_id": str(p["_id"]),
                                 "order_id": str(o["_id"]), "rating": data.rating,
                                 "comment": data.comment, "created_at": now})
    r = db.reviews.find_one({"_id": res.inserted_id})
    return ReviewOut(id=str(r["_id"]), buyer_id=r["buyer_id"], product_id=r["product_id"],
                     order_id=r["order_id"], rating=r["rating"], comment=r.get("comment"),
                     created_at=r["created_at"], buyer_name=user["full_name"])


@router.get("/wishlist", response_model=list[ProductOut])
def get_wishlist(user: dict = Depends(require_buyer_only), db=Depends(get_db)):
    ids = [w["product_id"] for w in db.wishlist.find({"buyer_id": user["id"]})]
    prods = [db.products.find_one({"_id": oid(pid)}) for pid in ids]
    return enrich_products(db, [p for p in prods if p])


@router.post("/wishlist/{product_id}")
def add_wishlist(product_id: str, user: dict = Depends(require_buyer_only), db=Depends(get_db)):
    if not db.products.find_one({"_id": oid(product_id)}):
        raise HTTPException(404, "Product not found.")
    db.wishlist.update_one(
        {"buyer_id": user["id"], "product_id": product_id},
        {"$setOnInsert": {"buyer_id": user["id"], "product_id": product_id, "created_at": utcnow()}},
        upsert=True,
    )
    return {"message": "Saved to wishlist."}


@router.delete("/wishlist/{product_id}")
def remove_wishlist(product_id: str, user: dict = Depends(require_buyer_only), db=Depends(get_db)):
    r = db.wishlist.delete_one({"buyer_id": user["id"], "product_id": product_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not in wishlist.")
    return {"message": "Removed from wishlist."}
