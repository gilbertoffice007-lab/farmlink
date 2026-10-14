from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_current_user
from app.db.mongo import get_db, oid, utcnow
from app.schemas.common import NotificationOut

router = APIRouter()


@router.get("", response_model=list[NotificationOut])
def list_notifications(user: dict = Depends(get_current_user), db=Depends(get_db)):
    return [NotificationOut(id=str(n["_id"]), title=n["title"], message=n["message"],
                            type=n.get("type", "info"), read_at=n.get("read_at"),
                            created_at=n["created_at"])
            for n in db.notifications.find({"user_id": user["id"]}).sort("created_at", -1).limit(50)]


@router.patch("/{nid}/read")
def mark_read(nid: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    n = db.notifications.find_one({"_id": oid(nid), "user_id": user["id"]})
    if not n:
        raise HTTPException(404, "Notification not found.")
    db.notifications.update_one({"_id": n["_id"]}, {"$set": {"read_at": utcnow()}})
    return {"message": "Marked as read."}
