from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import require_buyer_only
from app.db.mongo import get_db, oid, utcnow
from app.schemas.common import AddressIn, AddressOut

router = APIRouter()


def _out(a: dict) -> AddressOut:
    return AddressOut(
        id=str(a["_id"]), user_id=a["user_id"], recipient_name=a["recipient_name"],
        phone=a["phone"], address_line=a["address_line"], city=a["city"], state=a["state"],
        postal_code=a["postal_code"], latitude=a.get("latitude"), longitude=a.get("longitude"),
        is_default=a.get("is_default", False),
    )


@router.get("", response_model=list[AddressOut])
def list_addresses(user: dict = Depends(require_buyer_only), db=Depends(get_db)):
    return [_out(a) for a in db.addresses.find({"user_id": user["id"]}).sort("_id", -1)]


@router.post("", response_model=AddressOut, status_code=201)
def create_address(data: AddressIn, user: dict = Depends(require_buyer_only), db=Depends(get_db)):
    if data.is_default:
        db.addresses.update_many({"user_id": user["id"]}, {"$set": {"is_default": False}})
    now = utcnow()
    res = db.addresses.insert_one({"user_id": user["id"], **data.model_dump(), "created_at": now})
    return _out(db.addresses.find_one({"_id": res.inserted_id}))


@router.delete("/{address_id}")
def delete_address(address_id: str, user: dict = Depends(require_buyer_only), db=Depends(get_db)):
    a = db.addresses.find_one({"_id": oid(address_id)})
    if not a or a["user_id"] != user["id"]:
        raise HTTPException(404, "Address not found.")
    db.addresses.delete_one({"_id": a["_id"]})
    return {"message": "Address deleted."}
