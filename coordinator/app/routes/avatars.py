from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.auth.dependencies import get_current_wallet
from app.services.avatar_storage import (
    AvatarTooLargeError,
    AvatarValidationError,
    storage,
)

router = APIRouter(prefix="/api/v1/avatars", tags=["avatars"])


class AvatarUploadResponse(BaseModel):
    filename: str
    url: str
    size: int


@router.post("/upload", response_model=AvatarUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_avatar(
    file: UploadFile,
    _wallet: str = Depends(get_current_wallet),
) -> AvatarUploadResponse:
    raw = await file.read(storage.max_bytes + 1)
    try:
        filename, url = await storage.save(raw)
    except AvatarTooLargeError as exc:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=str(exc),
        ) from exc
    except AvatarValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=str(exc),
        ) from exc
    return AvatarUploadResponse(filename=filename, url=url, size=len(raw))


@router.get("/files/{filename}")
async def get_avatar(filename: str) -> FileResponse:
    root = storage.directory.resolve()
    target: Path = (storage.directory / filename).resolve()
    if not target.is_relative_to(root):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid filename")
    if not target.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="avatar not found")

    return FileResponse(
        target,
        media_type="model/gltf-binary",
        headers={"Cache-Control": "public, max-age=86400, immutable"},
    )
