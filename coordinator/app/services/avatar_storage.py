"""Local-disk storage backend for custom GLB avatar uploads.

Single-replica MVP — files live on the coordinator's filesystem at
`settings.avatar_storage_dir`. Production deployments should swap to
S3/R2 by replacing `LocalAvatarStorage` with an `S3AvatarStorage`
that implements the same `save / url_for / delete` shape.

Validation:
- Magic bytes — every GLB starts with `glTF` (0x67 0x6C 0x54 0x46).
  Rejecting on this catches both wrong file types and empty uploads.
- Size cap — `settings.avatar_max_bytes` (50 MB default per spec).
- Filename — UUID hex + `.glb` so user-supplied names can't escape
  the directory or collide.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from uuid import uuid4

from app.config import settings

logger = logging.getLogger(__name__)

GLB_MAGIC = b"glTF"


class AvatarValidationError(ValueError):
    pass


class AvatarTooLargeError(AvatarValidationError):
    pass


class LocalAvatarStorage:
    def __init__(
        self,
        directory: str | Path | None = None,
        max_bytes: int | None = None,
        url_prefix: str | None = None,
    ) -> None:
        self._directory = Path(directory or settings.avatar_storage_dir)
        self._max_bytes = max_bytes if max_bytes is not None else settings.avatar_max_bytes
        self._url_prefix = (url_prefix or settings.avatar_url_prefix).rstrip("/")
        self._directory.mkdir(parents=True, exist_ok=True)

    @property
    def directory(self) -> Path:
        return self._directory

    @property
    def max_bytes(self) -> int:
        return self._max_bytes

    def url_for(self, filename: str) -> str:
        return f"{self._url_prefix}/{filename}"

    async def save(self, raw_bytes: bytes) -> tuple[str, str]:
        """Validate and persist a GLB. Returns (filename, public_url)."""
        if len(raw_bytes) == 0:
            raise AvatarValidationError("avatar file is empty")
        if len(raw_bytes) > self._max_bytes:
            raise AvatarTooLargeError(
                f"avatar exceeds {self._max_bytes // (1024 * 1024)} MB limit"
            )
        if not raw_bytes.startswith(GLB_MAGIC):
            raise AvatarValidationError("not a valid GLB file (missing 'glTF' magic bytes)")

        filename = f"{uuid4().hex}.glb"
        target = self._directory / filename
        await asyncio.to_thread(target.write_bytes, raw_bytes)
        logger.info("stored avatar %s (%d bytes)", filename, len(raw_bytes))
        return filename, self.url_for(filename)


storage = LocalAvatarStorage()
