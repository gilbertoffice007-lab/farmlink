"""Pydantic request/response schemas.

IDs are Mongo ObjectId strings. Money is Decimal rupees at the API boundary
(stored as integer paise in Mongo — see app.db.mongo).
"""
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class UserOut(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    role: str
    phone: Optional[str] = None
    is_active: bool
    created_at: datetime


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: str = Field(default="buyer", pattern="^(buyer|seller)$")
    phone: Optional[str] = Field(default=None, max_length=20)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class SellerProfileOut(BaseModel):
    id: str
    user_id: str
    farm_name: str
    description: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    verification_status: str


class SellerOnboardingIn(BaseModel):
    farm_name: str = Field(min_length=2, max_length=160)
    description: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class CategoryOut(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None


class ProductOut(BaseModel):
    id: str
    seller_id: str
    category_id: Optional[str] = None
    name: str
    slug: str
    description: Optional[str] = None
    price: Decimal
    unit: str
    available_quantity: float
    minimum_order_quantity: float
    image_url: Optional[str] = None
    harvest_date: Optional[date] = None
    location: Optional[str] = None
    status: str
    seller_name: Optional[str] = None
    farm_name: Optional[str] = None
    category_name: Optional[str] = None
    rating_avg: Optional[float] = None
    rating_count: int = 0
    created_at: datetime


class ProductCreateIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    category_id: Optional[str] = None
    description: Optional[str] = None
    price: Decimal = Field(gt=0, le=1000000)
    unit: str = Field(default="kg", max_length=20)
    available_quantity: float = Field(ge=0, le=1000000)
    minimum_order_quantity: float = Field(default=1, gt=0)
    image_url: Optional[str] = None
    harvest_date: Optional[date] = None
    location: Optional[str] = Field(default=None, max_length=160)


class ProductUpdateIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=160)
    category_id: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Decimal] = Field(default=None, gt=0, le=1000000)
    unit: Optional[str] = Field(default=None, max_length=20)
    available_quantity: Optional[float] = Field(default=None, ge=0, le=1000000)
    minimum_order_quantity: Optional[float] = Field(default=None, gt=0)
    image_url: Optional[str] = None
    harvest_date: Optional[date] = None
    location: Optional[str] = Field(default=None, max_length=160)
    status: Optional[str] = Field(default=None, pattern="^(active|inactive)$")


class AddressIn(BaseModel):
    recipient_name: str
    phone: str
    address_line: str
    city: str
    state: str
    postal_code: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_default: bool = False


class AddressOut(AddressIn):
    id: str
    user_id: str


class CartItemOut(BaseModel):
    id: str
    product_id: str
    product_name: str
    unit: str
    unit_price: Decimal
    quantity: float
    line_total: Decimal
    image_url: Optional[str] = None
    seller_id: str
    available_quantity: float


class CartOut(BaseModel):
    id: str
    items: List[CartItemOut]
    subtotal: Decimal


class CartAddIn(BaseModel):
    product_id: str
    quantity: float = Field(gt=0, le=10000)


class CartUpdateIn(BaseModel):
    quantity: float = Field(gt=0, le=10000)


class OrderItemOut(BaseModel):
    id: str
    product_id: Optional[str] = None
    product_name_snapshot: str
    unit_snapshot: str
    unit_price_snapshot: Decimal
    quantity: float
    line_total: Decimal


class OrderHistoryOut(BaseModel):
    previous_status: Optional[str] = None
    new_status: str
    note: Optional[str] = None
    created_at: datetime


class OrderOut(BaseModel):
    id: str
    order_number: str
    buyer_id: str
    seller_id: str
    status: str
    payment_method: str
    payment_status: str
    subtotal: Decimal
    delivery_fee: Decimal
    total_amount: Decimal
    fulfillment_type: str
    buyer_notes: Optional[str] = None
    delivery_slot: Optional[str] = None
    delivery_instructions: Optional[str] = None
    estimated_delivery: Optional[datetime] = None
    created_at: datetime
    items: List[OrderItemOut] = []
    history: List[OrderHistoryOut] = []
    buyer_name: Optional[str] = None
    seller_name: Optional[str] = None


class CheckoutIn(BaseModel):
    delivery_address_id: Optional[str] = None
    fulfillment_type: str = Field(default="delivery", pattern="^(delivery|pickup)$")
    payment_method: str = Field(default="cod", pattern="^(cod|online_mock)$")
    buyer_notes: Optional[str] = None
    delivery_slot: Optional[str] = Field(default=None, max_length=40)
    delivery_instructions: Optional[str] = Field(default=None, max_length=500)


class StatusUpdateIn(BaseModel):
    note: Optional[str] = None


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=1000)
    order_id: str


class ReviewOut(BaseModel):
    id: str
    buyer_id: str
    product_id: str
    order_id: str
    rating: int
    comment: Optional[str] = None
    created_at: datetime
    buyer_name: Optional[str] = None


class NotificationOut(BaseModel):
    id: str
    title: str
    message: str
    type: str
    read_at: Optional[datetime] = None
    created_at: datetime
