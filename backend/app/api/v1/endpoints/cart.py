from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import require_buyer_only
from app.db.mongo import get_db, oid, to_rupees, utcnow
from app.schemas.common import CartAddIn, CartOut, CartItemOut, CartUpdateIn

router = APIRouter()


def _cart(db, user: dict) -> dict:
    cart = db.carts.find_one({"buyer_id": user["id"]})
    if not cart:
        now = utcnow()
        res = db.carts.insert_one({"buyer_id": user["id"], "created_at": now, "updated_at": now})
        cart = db.carts.find_one({"_id": res.inserted_id})
    return cart


def _cart_out(db, cart: dict) -> CartOut:
    items = []
    subtotal = Decimal("0")
    for ci in db.cart_items.find({"cart_id": str(cart["_id"])}):
        p = db.products.find_one({"_id": oid(ci["product_id"])})
        if not p:
            continue
        price = to_rupees(p["price_paise"])
        qty = float(ci["quantity"])
        line = price * Decimal(str(qty))
        subtotal += line
        items.append(CartItemOut(
            id=str(ci["_id"]), product_id=str(p["_id"]), product_name=p["name"], unit=p.get("unit", "kg"),
            unit_price=price, quantity=qty, line_total=line,
            image_url=p.get("image_url"), seller_id=p["seller_id"],
            available_quantity=float(p.get("available_quantity", 0)),
        ))
    return CartOut(id=str(cart["_id"]), items=items, subtotal=subtotal)


@router.get("", response_model=CartOut)
def get_cart(user: dict = Depends(require_buyer_only), db=Depends(get_db)):
    return _cart_out(db, _cart(db, user))


@router.post("/items", response_model=CartOut)
def add_item(data: CartAddIn, user: dict = Depends(require_buyer_only), db=Depends(get_db)):
    p = db.products.find_one({"_id": oid(data.product_id)})
    if not p or p.get("status") != "active":
        raise HTTPException(404, "Product not available.")
    qty = float(data.quantity)
    if qty < float(p.get("minimum_order_quantity", 1)):
        raise HTTPException(400, f"Minimum order is {p.get('minimum_order_quantity')} {p.get('unit')}.")
    if qty > float(p.get("available_quantity", 0)):
        raise HTTPException(400, f"Only {p.get('available_quantity')} {p.get('unit')} are currently available.")
    cart = _cart(db, user)
    cid = str(cart["_id"])
    existing = db.cart_items.find_one({"cart_id": cid, "product_id": str(p["_id"])})
    if existing:
        new_qty = float(existing["quantity"]) + qty
        if new_qty > float(p.get("available_quantity", 0)):
            raise HTTPException(400, f"Only {p.get('available_quantity')} {p.get('unit')} are currently available.")
        db.cart_items.update_one({"_id": existing["_id"]}, {"$set": {"quantity": new_qty, "updated_at": utcnow()}})
    else:
        db.cart_items.insert_one({"cart_id": cid, "product_id": str(p["_id"]), "quantity": qty,
                                  "created_at": utcnow(), "updated_at": utcnow()})
    return _cart_out(db, cart)


@router.patch("/items/{item_id}", response_model=CartOut)
def update_item(item_id: str, data: CartUpdateIn, user: dict = Depends(require_buyer_only), db=Depends(get_db)):
    cart = _cart(db, user)
    ci = db.cart_items.find_one({"_id": oid(item_id)})
    if not ci or ci["cart_id"] != str(cart["_id"]):
        raise HTTPException(404, "Cart item not found.")
    p = db.products.find_one({"_id": oid(ci["product_id"])})
    if float(data.quantity) > float(p.get("available_quantity", 0)):
        raise HTTPException(400, f"Only {p.get('available_quantity')} {p.get('unit')} are currently available.")
    db.cart_items.update_one({"_id": ci["_id"]}, {"$set": {"quantity": float(data.quantity), "updated_at": utcnow()}})
    return _cart_out(db, cart)


@router.delete("/items/{item_id}", response_model=CartOut)
def remove_item(item_id: str, user: dict = Depends(require_buyer_only), db=Depends(get_db)):
    cart = _cart(db, user)
    ci = db.cart_items.find_one({"_id": oid(item_id)})
    if not ci or ci["cart_id"] != str(cart["_id"]):
        raise HTTPException(404, "Cart item not found.")
    db.cart_items.delete_one({"_id": ci["_id"]})
    return _cart_out(db, cart)


@router.delete("", response_model=dict)
def clear_cart(user: dict = Depends(require_buyer_only), db=Depends(get_db)):
    cart = _cart(db, user)
    db.cart_items.delete_many({"cart_id": str(cart["_id"])})
    return {"message": "Cart cleared."}
