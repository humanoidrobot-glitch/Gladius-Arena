import io

import pytest
from httpx import AsyncClient
from solders.keypair import Keypair

from app.auth.jwt_utils import issue_token
from app.services.avatar_storage import (
    AvatarValidationError,
    LocalAvatarStorage,
    storage as default_storage,
)


def _auth_headers() -> dict[str, str]:
    kp = Keypair()
    token, _ = issue_token(str(kp.pubkey()))
    return {"Authorization": f"Bearer {token}"}


async def test_storage_rejects_empty(tmp_path):
    s = LocalAvatarStorage(directory=tmp_path)
    with pytest.raises(AvatarValidationError, match="empty"):
        await s.save(b"")


async def test_storage_rejects_oversized(tmp_path):
    s = LocalAvatarStorage(directory=tmp_path, max_bytes=16)
    big = b"glTF" + b"x" * 100
    with pytest.raises(AvatarValidationError, match="exceeds"):
        await s.save(big)


async def test_storage_rejects_wrong_magic(tmp_path):
    s = LocalAvatarStorage(directory=tmp_path)
    with pytest.raises(AvatarValidationError, match="glTF"):
        await s.save(b"PNG\r\nfake-png-content")


async def test_storage_saves_valid_glb(tmp_path):
    s = LocalAvatarStorage(directory=tmp_path, url_prefix="/api/v1/avatars/files")
    payload = b"glTF" + b"\x02\x00\x00\x00" + b"\x40\x00\x00\x00" + b"\x00" * 56
    filename, url = await s.save(payload)
    assert filename.endswith(".glb")
    assert url.startswith("/api/v1/avatars/files/")
    assert url.endswith(filename)
    assert (tmp_path / filename).read_bytes() == payload


@pytest.fixture
def isolated_storage(tmp_path, monkeypatch):
    """Point the default storage at a per-test tmp directory so route
    tests don't pollute each other's filesystem."""
    monkeypatch.setattr(default_storage, "_directory", tmp_path)
    return tmp_path


async def test_upload_requires_auth(client: AsyncClient, isolated_storage) -> None:
    payload = b"glTF" + b"\x00" * 64
    resp = await client.post(
        "/api/v1/avatars/upload",
        files={"file": ("test.glb", io.BytesIO(payload), "model/gltf-binary")},
    )
    assert resp.status_code == 401


async def test_upload_rejects_non_glb(
    client: AsyncClient, isolated_storage
) -> None:
    resp = await client.post(
        "/api/v1/avatars/upload",
        files={"file": ("not-glb.png", io.BytesIO(b"PNG\r\n\x1a\n"), "image/png")},
        headers=_auth_headers(),
    )
    assert resp.status_code == 415
    assert "glTF" in resp.json()["detail"]


async def test_upload_rejects_oversized(
    client: AsyncClient, isolated_storage, monkeypatch
) -> None:
    monkeypatch.setattr(default_storage, "_max_bytes", 32)
    big = b"glTF" + b"x" * 100
    resp = await client.post(
        "/api/v1/avatars/upload",
        files={"file": ("big.glb", io.BytesIO(big), "model/gltf-binary")},
        headers=_auth_headers(),
    )
    assert resp.status_code == 413


async def test_upload_succeeds_and_serves_file(
    client: AsyncClient, isolated_storage
) -> None:
    payload = b"glTF" + b"\x02\x00\x00\x00" + b"\x40\x00\x00\x00" + b"\x00" * 56
    upload = await client.post(
        "/api/v1/avatars/upload",
        files={"file": ("model.glb", io.BytesIO(payload), "model/gltf-binary")},
        headers=_auth_headers(),
    )
    assert upload.status_code == 201
    body = upload.json()
    assert body["size"] == len(payload)
    assert body["url"].endswith(body["filename"])

    served = await client.get(body["url"])
    assert served.status_code == 200
    assert served.content == payload


async def test_get_avatar_404_for_missing(
    client: AsyncClient, isolated_storage
) -> None:
    resp = await client.get("/api/v1/avatars/files/does-not-exist.glb")
    assert resp.status_code == 404


async def test_get_avatar_treats_literal_dotdot_as_filename(
    client: AsyncClient, isolated_storage
) -> None:
    # `is_relative_to` correctly accepts `foo..glb` as a normal filename
    # (no path components) — it's not a real file, so we expect 404, not
    # a false-positive 400.
    resp = await client.get("/api/v1/avatars/files/foo..glb")
    assert resp.status_code == 404


async def test_register_accepts_avatar_glb_url(
    client: AsyncClient,
) -> None:
    kp = Keypair()
    token, _ = issue_token(str(kp.pubkey()))
    resp = await client.post(
        "/api/v1/agents/register",
        json={
            "name": "custom-avatar-agent",
            "avatar_glb_url": "/api/v1/avatars/files/abc.glb",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["avatar_glb_url"] == "/api/v1/avatars/files/abc.glb"
    assert body["three_ws_agent_id"] is None
