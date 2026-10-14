from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.mongo import get_db, utcnow
from app.schemas.common import LoginIn, RegisterIn, TokenOut, UserOut

router = APIRouter()


def _user_out(u: dict) -> UserOut:
    return UserOut(id=str(u["_id"]), full_name=u["full_name"], email=u["email"],
                   role=u["role"], phone=u.get("phone"), is_active=u.get("is_active", True),
                   created_at=u["created_at"])


@router.post("/register", response_model=TokenOut, status_code=201)
def register(data: RegisterIn, db=Depends(get_db)):
    if db.users.find_one({"email": data.email.lower()}):
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    if data.role not in ("buyer", "seller"):
        raise HTTPException(status_code=400, detail="Invalid role.")
    now = utcnow()
    res = db.users.insert_one({
        "full_name": data.full_name.strip(), "email": data.email.lower().strip(),
        "password_hash": hash_password(data.password), "role": data.role,
        "phone": data.phone, "is_active": True,
        "created_at": now, "updated_at": now,
    })
    uid = str(res.inserted_id)
    db.carts.insert_one({"buyer_id": uid, "created_at": now, "updated_at": now})
    db.notifications.insert_one({
        "user_id": uid, "title": "Welcome to FarmLink",
        "message": "Thanks for joining FarmLink. Browse fresh produce directly from farmers.",
        "type": "info", "read_at": None, "created_at": now,
    })
    user = db.users.find_one({"_id": res.inserted_id})
    return {"access_token": create_access_token(uid), "token_type": "bearer", "user": _user_out(user)}


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db=Depends(get_db)):
    user = db.users.find_one({"email": data.email.lower().strip()})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="This account has been suspended.")
    uid = str(user["_id"])
    return {"access_token": create_access_token(uid), "token_type": "bearer", "user": _user_out(user)}


@router.post("/logout")
def logout():
    # Stateless bearer tokens: the client discards its token. Documented limitation.
    return {"message": "Signed out. Please discard the access token on the client."}


@router.get("/me", response_model=UserOut)
def me(user: dict = Depends(get_current_user)):
    return UserOut(id=user["id"], full_name=user["full_name"], email=user["email"],
                   role=user["role"], phone=user.get("phone"),
                   is_active=user.get("is_active", True), created_at=user["created_at"])
