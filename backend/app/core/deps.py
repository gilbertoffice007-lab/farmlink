from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.security import decode_token
from app.db.mongo import get_db, oid

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# Strict work separation:
# - Buyers shop (cart, addresses, checkout, wishlist, reviews). Sellers cannot buy.
# - Sellers sell (listings, farm profile, fulfilment). Buyers cannot sell.
# - Admins moderate via /admin/* (plus read/support overrides where noted).


def get_current_user(token: str = Depends(oauth2_scheme), db=Depends(get_db)) -> dict:
    user_id = decode_token(token)
    _id = oid(user_id) if user_id else None
    user = db.users.find_one({"_id": _id}) if _id else None
    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Your session has expired. Please sign in again.")
    user["id"] = str(user.pop("_id"))
    return user


def _checker(roles: tuple, message: str):
    def check(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=message)
        return user

    return check


def require_roles(*roles: str):
    return _checker(tuple(roles), "You do not have permission to perform this action.")


require_admin = require_roles("admin")
require_seller = require_roles("seller", "admin")

require_buyer_only = _checker(
    ("buyer",),
    "Only buyer accounts can shop and place orders. Seller accounts are for selling — please sign in with a buyer account to buy.",
)
require_buyer_admin = _checker(
    ("buyer", "admin"),
    "Only the buyer (or support staff) can perform this action.",
)
require_seller_only = _checker(
    ("seller",),
    "Only seller accounts can manage listings and fulfil orders. Buyer accounts are for shopping.",
)
