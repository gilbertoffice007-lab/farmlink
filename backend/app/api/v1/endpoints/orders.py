from datetime import timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pymongo.errors import DuplicateKeyError

from app.core.deps import get_current_user, require_buyer_admin, require_buyer_only
from app.db.mongo import get_db, oid, to_paise, to_rupees, utcnow
from app.schemas.common import CheckoutIn, OrderHistoryOut, OrderOut, OrderItemOut, StatusUpdateIn

router = APIRouter()

# Delivery policy (documented, server-enforced):
# - Farm pickup is always free.
# - Home delivery is a flat Rs.40 per seller-order, FREE when that seller's
#   subtotal reaches Rs.499.
DELIVERY_FEE = Decimal("40.00")
FREE_DELIVERY_MIN = Decimal("499.00")
ETA_DAYS = {"delivery": 2, "pickup": 1}

VALID_TRANSITIONS = {
    "placed": {"accepted", "rejected", "cancelled"},
    "accepted": {"preparing", "cancelled"},
    "preparing": {"ready", "cancelled"},
    "ready": {"dispatched", "delivered", "collected"},
    "dispatched": {"delivered"},
    "delivered": set(),
    "collected": set(),
    "cancelled": set(),
    "rejected": set(),
}


def _eta(o: dict):
    base = o.get("created_at") or utcnow()
    if base.tzinfo is None:
        from datetime import timezone
        base = base.replace(tzinfo=timezone.utc)
    return base + timedelta(days=ETA_DAYS.get(o.get("fulfillment_type"), 2))


def _order_out(db, o: dict) -> OrderOut:
    buyer = db.users.find_one({"_id": oid(o["buyer_id"])})
    seller = db.users.find_one({"_id": oid(o["seller_id"])})
    items = list(db.order_items.find({"order_id": str(o["_id"])}))
    hist = list(db.status_history.find({"order_id": str(o["_id"])}).sort("created_at", 1))
    return OrderOut(
        id=str(o["_id"]), order_number=o["order_number"], buyer_id=o["buyer_id"], seller_id=o["seller_id"],
        status=o["status"], payment_method=o["payment_method"], payment_status=o.get("payment_status", "pending"),
        subtotal=to_rupees(o["subtotal_paise"]), delivery_fee=to_rupees(o["delivery_fee_paise"]),
        total_amount=to_rupees(o["total_paise"]), fulfillment_type=o["fulfillment_type"],
        buyer_notes=o.get("buyer_notes"), delivery_slot=o.get("delivery_slot"),
        delivery_instructions=o.get("delivery_instructions"),
        estimated_delivery=_eta(o), created_at=o["created_at"],
        items=[OrderItemOut(id=str(i["_id"]), product_id=i.get("product_id"),
                            product_name_snapshot=i["product_name_snapshot"], unit_snapshot=i["unit_snapshot"],
                            unit_price_snapshot=to_rupees(i["unit_price_paise"]),
                            quantity=float(i["quantity"]), line_total=to_rupees(i["line_total_paise"]))
               for i in items],
        history=[OrderHistoryOut(previous_status=h.get("previous_status"), new_status=h["new_status"],
                                 note=h.get("note"), created_at=h["created_at"]) for h in hist],
        buyer_name=buyer["full_name"] if buyer else None,
        seller_name=seller["full_name"] if seller else None,
    )


def _record(db, order_id: str, prev: Optional[str], new: str, by: Optional[str], note: Optional[str] = None):
    db.status_history.insert_one({"order_id": order_id, "changed_by_user_id": by,
                                  "previous_status": prev, "new_status": new,
                                  "note": note, "created_at": utcnow()})


def _unique_order_number(db) -> str:
    from datetime import datetime, timezone
    import random
    base = f"FL{datetime.now(timezone.utc).strftime('%Y%m%d')}{db.orders.count_documents({}) + 1:05d}"
    if not db.orders.find_one({"order_number": base}):
        return base
    return f"{base}R{random.randint(1000, 9999)}"


@router.get("/delivery/policy")
def delivery_policy():
    """Public delivery policy: fees, free-shipping threshold, slots, ETA basis."""
    return {
        "delivery_fee": float(DELIVERY_FEE),
        "free_delivery_min_subtotal": float(FREE_DELIVERY_MIN),
        "pickup_free": True,
        "slots": [
            {"id": "today_evening", "label": "Today · 4–8 PM"},
            {"id": "tomorrow_morning", "label": "Tomorrow · 7–11 AM"},
            {"id": "tomorrow_evening", "label": "Tomorrow · 4–8 PM"},
            {"id": "day_after_morning", "label": "Day after · 7–11 AM"},
        ],
        "eta_days": ETA_DAYS,
        "note": "Estimates only. Sellers confirm the slot when they accept the order.",
    }


@router.post("", response_model=list[OrderOut])
def checkout(data: CheckoutIn, user: dict = Depends(require_buyer_only), db=Depends(get_db)):
    cart = db.carts.find_one({"buyer_id": user["id"]})
    cart_items = list(db.cart_items.find({"cart_id": str(cart["_id"])})) if cart else []
    if not cart_items:
        raise HTTPException(400, "Your cart is empty.")

    address_id = data.delivery_address_id
    if data.fulfillment_type == "delivery":
        if address_id:
            addr = db.addresses.find_one({"_id": oid(address_id)})
            if not addr or addr["user_id"] != user["id"]:
                raise HTTPException(400, "Invalid delivery address.")
            address_id = str(addr["_id"])
        else:
            addr = db.addresses.find_one({"user_id": user["id"]})
            if not addr:
                raise HTTPException(400, "Please add a delivery address first.")
            address_id = str(addr["_id"])

    by_seller: dict = {}
    for ci in cart_items:
        p = db.products.find_one({"_id": oid(ci["product_id"])})
        if not p or p.get("status") != "active":
            raise HTTPException(400, "A product in your cart is no longer available.")
        by_seller.setdefault(p["seller_id"], []).append((ci, p))

    created = []
    decremented = []  # (product_id, qty) to roll back on failure
    try:
        for seller_id, pairs in by_seller.items():
            seller = db.users.find_one({"_id": oid(seller_id)})
            if not seller or not seller.get("is_active", True):
                raise HTTPException(400, "A seller in your cart is unavailable.")
            subtotal = Decimal("0")
            lines = []
            for ci, p in pairs:
                qty = float(ci["quantity"])
                if qty < float(p.get("minimum_order_quantity", 1)):
                    raise HTTPException(400, f"Minimum order for {p['name']} is {p.get('minimum_order_quantity')} {p.get('unit')}.")
                # Atomic guarded decrement — concurrent checkouts can't oversell.
                updated = db.products.find_one_and_update(
                    {"_id": p["_id"], "available_quantity": {"$gte": qty}},
                    {"$inc": {"available_quantity": -qty}, "$set": {"updated_at": utcnow()}},
                )
                if not updated:
                    fresh = db.products.find_one({"_id": p["_id"]})
                    have = fresh.get("available_quantity", 0) if fresh else 0
                    raise HTTPException(400, f"Only {have} {p.get('unit')} of {p['name']} are currently available.")
                decremented.append((str(p["_id"]), qty))
                price = to_rupees(updated["price_paise"])
                line = price * Decimal(str(qty))
                subtotal += line
                lines.append((updated, qty, price, line))
            if data.fulfillment_type == "pickup":
                fee = Decimal("0")
            elif subtotal >= FREE_DELIVERY_MIN:
                fee = Decimal("0")
            else:
                fee = DELIVERY_FEE
            total = subtotal + fee
            now = utcnow()
            order_doc = {
                "order_number": _unique_order_number(db),
                "buyer_id": user["id"], "seller_id": seller_id,
                "delivery_address_id": address_id,
                "status": "placed", "payment_method": data.payment_method,
                "payment_status": "pending",
                "subtotal_paise": to_paise(subtotal), "delivery_fee_paise": to_paise(fee),
                "total_paise": to_paise(total), "fulfillment_type": data.fulfillment_type,
                "buyer_notes": data.buyer_notes,
                "delivery_slot": data.delivery_slot if data.fulfillment_type == "delivery" else None,
                "delivery_instructions": data.delivery_instructions,
                "created_at": now, "updated_at": now,
            }
            try:
                res = db.orders.insert_one(order_doc)
            except DuplicateKeyError:
                order_doc["order_number"] = _unique_order_number(db) + "X"
                res = db.orders.insert_one(order_doc)
            order_id = str(res.inserted_id)
            for p, qty, price, line in lines:
                db.order_items.insert_one({
                    "order_id": order_id, "product_id": str(p["_id"]),
                    "product_name_snapshot": p["name"], "unit_snapshot": p.get("unit", "kg"),
                    "unit_price_paise": int(p["price_paise"]), "quantity": qty,
                    "line_total_paise": to_paise(line),
                })
            _record(db, order_id, None, "placed", user["id"])
            db.notifications.insert_one({
                "user_id": seller_id, "title": "New order received",
                "message": f"New order {order_doc['order_number']} worth Rs.{total}.",
                "type": "order", "read_at": None, "created_at": now,
            })
            created.append(db.orders.find_one({"_id": res.inserted_id}))
        for ci in cart_items:
            db.cart_items.delete_one({"_id": ci["_id"]})
    except HTTPException:
        for pid, qty in decremented:
            db.products.update_one({"_id": oid(pid)}, {"$inc": {"available_quantity": qty}})
        raise
    except Exception:
        for pid, qty in decremented:
            db.products.update_one({"_id": oid(pid)}, {"$inc": {"available_quantity": qty}})
        raise HTTPException(500, "Could not place the order. Please try again.")
    return [_order_out(db, o) for o in created]


def _visible_orders(db, user: dict):
    if user["role"] == "admin":
        cur = db.orders.find({}).sort("created_at", -1).limit(200)
    elif user["role"] == "seller":
        cur = db.orders.find({"seller_id": user["id"]}).sort("created_at", -1)
    else:
        cur = db.orders.find({"buyer_id": user["id"]}).sort("created_at", -1)
    return list(cur)


@router.get("", response_model=list[OrderOut])
def list_orders(user: dict = Depends(get_current_user), db=Depends(get_db)):
    return [_order_out(db, o) for o in _visible_orders(db, user)]


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    o = db.orders.find_one({"_id": oid(order_id)})
    if not o:
        raise HTTPException(404, "Order not found.")
    if user["role"] != "admin" and o["buyer_id"] != user["id"] and o["seller_id"] != user["id"]:
        raise HTTPException(403, "You do not have permission to perform this action.")
    return _order_out(db, o)


def _restore_stock(db, order_id: str):
    for li in db.order_items.find({"order_id": order_id}):
        if li.get("product_id"):
            db.products.update_one({"_id": oid(li["product_id"])},
                                   {"$inc": {"available_quantity": float(li["quantity"])}})


def _transition(db, o: dict, new: str, user: dict, note: Optional[str] = None):
    allowed = VALID_TRANSITIONS.get(o["status"], set())
    if new not in allowed:
        raise HTTPException(400, f"Cannot move order from {o['status']} to {new}.")
    prev = o["status"]
    patch = {"status": new, "updated_at": utcnow()}
    if new in ("delivered", "collected") and o.get("payment_method") == "online_mock":
        patch["payment_status"] = "paid"
    db.orders.update_one({"_id": o["_id"]}, {"$set": patch})
    _record(db, str(o["_id"]), prev, new, user["id"], note)
    other = o["buyer_id"] if user["id"] == o["seller_id"] else o["seller_id"]
    db.notifications.insert_one({"user_id": other, "title": f"Order {o['order_number']}: {new}",
                                 "message": f"Order {o['order_number']} moved to {new}.",
                                 "type": "order", "read_at": None, "created_at": utcnow()})
    return _order_out(db, db.orders.find_one({"_id": o["_id"]}))


@router.post("/{order_id}/cancel", response_model=OrderOut)
def cancel_order(order_id: str, body: Optional[StatusUpdateIn] = None, user: dict = Depends(require_buyer_admin), db=Depends(get_db)):
    o = db.orders.find_one({"_id": oid(order_id)})
    if not o:
        raise HTTPException(404, "Order not found.")
    if o["buyer_id"] != user["id"] and user["role"] != "admin":
        raise HTTPException(403, "Only the buyer can cancel this order.")
    if o["status"] not in ("placed", "accepted"):
        raise HTTPException(400, "This order can no longer be cancelled.")
    _restore_stock(db, str(o["_id"]))
    return _transition(db, o, "cancelled", user, body.note if body else None)


@router.post("/{order_id}/accept", response_model=OrderOut)
def accept_order(order_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    o = db.orders.find_one({"_id": oid(order_id)})
    if not o:
        raise HTTPException(404, "Order not found.")
    if o["seller_id"] != user["id"] and user["role"] != "admin":
        raise HTTPException(403, "You do not have permission to perform this action.")
    return _transition(db, o, "accepted", user)


@router.post("/{order_id}/reject", response_model=OrderOut)
def reject_order(order_id: str, body: Optional[StatusUpdateIn] = None, user: dict = Depends(get_current_user), db=Depends(get_db)):
    o = db.orders.find_one({"_id": oid(order_id)})
    if not o:
        raise HTTPException(404, "Order not found.")
    if o["seller_id"] != user["id"] and user["role"] != "admin":
        raise HTTPException(403, "You do not have permission to perform this action.")
    _restore_stock(db, str(o["_id"]))
    return _transition(db, o, "rejected", user, body.note if body else None)


@router.post("/{order_id}/status", response_model=OrderOut)
def update_status(order_id: str, body: dict, user: dict = Depends(get_current_user), db=Depends(get_db)):
    o = db.orders.find_one({"_id": oid(order_id)})
    if not o:
        raise HTTPException(404, "Order not found.")
    if o["seller_id"] != user["id"] and user["role"] != "admin":
        raise HTTPException(403, "You do not have permission to perform this action.")
    new = (body.get("status") or "").strip()
    if new not in VALID_TRANSITIONS.get(o["status"], set()):
        raise HTTPException(400, f"Cannot move order from {o['status']} to {new}.")
    return _transition(db, o, new, user, body.get("note"))
