import math
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_current_user
from app.db.mongo import get_db, oid, to_rupees

router = APIRouter()


def haversine_km(lat1, lon1, lat2, lon2):
    try:
        if None in (lat1, lon1, lat2, lon2):
            return None
        r = 6371.0
        p1, p2 = math.radians(float(lat1)), math.radians(float(lat2))
        dphi = math.radians(float(lat2) - float(lat1))
        dl = math.radians(float(lon2) - float(lon1))
        a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
        return round(2 * r * math.asin(math.sqrt(a)), 2)
    except Exception:
        return None


def _order_lane(db, o: dict) -> dict:
    addr = db.addresses.find_one({"_id": oid(o["delivery_address_id"])}) if o.get("delivery_address_id") else None
    sp = db.seller_profiles.find_one({"user_id": o["seller_id"]})
    buyer_city = addr.get("city") if addr else ""
    pickup_city = sp.get("city") if sp and sp.get("city") else ""
    dist = None
    if addr and sp and addr.get("latitude") and addr.get("longitude") and sp.get("latitude") and sp.get("longitude"):
        dist = haversine_km(sp["latitude"], sp["longitude"], addr["latitude"], addr["longitude"])
    return {
        "order_id": str(o["_id"]), "order_number": o["order_number"], "status": o["status"],
        "seller_id": o["seller_id"], "pickup_city": pickup_city or "Unknown pickup",
        "delivery_city": buyer_city or "Unknown destination",
        "distance_km": dist, "total": float(to_rupees(o["total_paise"])),
    }


@router.get("/logistics/suggestions")
def suggestions(user: dict = Depends(get_current_user), db=Depends(get_db)):
    if user["role"] == "seller":
        orders = list(db.orders.find({"seller_id": user["id"],
                                      "status": {"$in": ["accepted", "preparing", "ready"]}}))
    elif user["role"] == "admin":
        orders = list(db.orders.find({"status": {"$in": ["accepted", "preparing", "ready"]}}).limit(100))
    else:
        raise HTTPException(403, "You do not have permission to perform this action.")
    lanes = [_order_lane(db, o) for o in orders]
    groups = defaultdict(list)
    for lane in lanes:
        groups[(lane["pickup_city"], lane["delivery_city"])].append(lane)
    result = []
    for (pickup, delivery), items in groups.items():
        if len(items) > 1:
            result.append({"pickup": pickup, "delivery": delivery, "orders": items,
                           "suggestion": f"{len(items)} orders share the {pickup} → {delivery} lane and may suit combined delivery.",
                           "combinable": True})
    singles = [lane for lane in lanes if not any(lane in g["orders"] and g["combinable"] for g in result)]
    return {
        "method": "Orders grouped by pickup city + delivery city; distance via haversine when both coordinates exist, else lane grouping only. No auto-merge; review required.",
        "groups": result, "ungrouped": singles, "count": len(lanes),
    }


@router.post("/logistics/route-suggestions")
def route_suggestions(payload: dict, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Nearest-neighbour route suggestion over supplied stops [{lat, lng, label}]. Explainable baseline."""
    stops = payload.get("stops", [])
    if len(stops) < 2:
        raise HTTPException(400, "Provide at least 2 stops.")
    unvisited = stops[1:]
    route = [stops[0]]
    current = stops[0]
    while unvisited:
        nxt = min(unvisited, key=lambda s: ((float(s["lat"]) - float(current["lat"])) ** 2 + (
            float(s["lng"]) - float(current["lng"])) ** 2))
        route.append(nxt)
        unvisited.remove(nxt)
        current = nxt
    return {"method": "Nearest-neighbour heuristic from the first stop (explainable baseline, not optimal routing).",
            "route": route}
