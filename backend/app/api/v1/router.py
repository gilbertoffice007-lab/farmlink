from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin, addresses, auth, cart, catalog, dashboards, logistics,
    notifications, orders, reviews, uploads,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(catalog.router, tags=["catalog"])
api_router.include_router(cart.router, prefix="/cart", tags=["cart"])
api_router.include_router(addresses.router, prefix="/addresses", tags=["addresses"])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router.include_router(reviews.router, tags=["reviews"])
api_router.include_router(dashboards.router, tags=["dashboards"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(admin.router, tags=["admin"])
api_router.include_router(logistics.router, tags=["logistics"])
api_router.include_router(uploads.router, tags=["uploads"])
