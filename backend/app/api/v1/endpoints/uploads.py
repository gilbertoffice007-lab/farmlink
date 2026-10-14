import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.config import settings
from app.core.deps import require_seller

router = APIRouter()
ALLOWED = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


@router.post("/uploads/image")
def upload_image(file: UploadFile = File(...), user: dict = Depends(require_seller)):
    if file.content_type not in ALLOWED:
        raise HTTPException(400, "Only JPG, PNG or WebP images are allowed.")
    data = file.file.read()
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(400, f"Image must be under {settings.MAX_UPLOAD_MB} MB.")
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ALLOWED[file.content_type]}"
    with open(os.path.join(settings.UPLOAD_DIR, name), "wb") as f:
        f.write(data)
    return {"image_url": f"/uploads/{name}"}
