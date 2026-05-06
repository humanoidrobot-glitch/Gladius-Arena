from httpx import AsyncClient
from solders.keypair import Keypair

from app.auth.jwt_utils import decode_token


async def _challenge_and_sign(client: AsyncClient, kp: Keypair) -> tuple[str, str, str]:
    wallet = str(kp.pubkey())
    resp = await client.post("/api/v1/auth/challenge", json={"wallet": wallet})
    assert resp.status_code == 200
    nonce = resp.json()["nonce"]
    sig = kp.sign_message(nonce.encode("utf-8"))
    return wallet, nonce, str(sig)


async def test_full_auth_flow_returns_jwt(client: AsyncClient) -> None:
    kp = Keypair()
    wallet, nonce, sig = await _challenge_and_sign(client, kp)

    resp = await client.post(
        "/api/v1/auth/verify",
        json={"wallet": wallet, "nonce": nonce, "signature": sig},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "token" in body and "expires_at" in body

    decoded = decode_token(body["token"])
    assert decoded["sub"] == wallet


async def test_challenge_rejects_invalid_pubkey(client: AsyncClient) -> None:
    # '0' is not in the base58 alphabet, so this fails Pubkey.from_string.
    resp = await client.post("/api/v1/auth/challenge", json={"wallet": "0" * 32})
    assert resp.status_code == 422


async def test_verify_rejects_unknown_nonce(client: AsyncClient) -> None:
    kp = Keypair()
    wallet = str(kp.pubkey())
    sig = kp.sign_message(b"never-issued-nonce")
    resp = await client.post(
        "/api/v1/auth/verify",
        json={"wallet": wallet, "nonce": "never-issued-nonce", "signature": str(sig)},
    )
    assert resp.status_code == 401


async def test_verify_rejects_wrong_signature(client: AsyncClient) -> None:
    kp = Keypair()
    other = Keypair()
    wallet, nonce, _ = await _challenge_and_sign(client, kp)
    wrong_sig = str(other.sign_message(nonce.encode("utf-8")))

    resp = await client.post(
        "/api/v1/auth/verify",
        json={"wallet": wallet, "nonce": nonce, "signature": wrong_sig},
    )
    assert resp.status_code == 401


async def test_nonce_is_single_use(client: AsyncClient) -> None:
    kp = Keypair()
    wallet, nonce, sig = await _challenge_and_sign(client, kp)

    first = await client.post(
        "/api/v1/auth/verify",
        json={"wallet": wallet, "nonce": nonce, "signature": sig},
    )
    assert first.status_code == 200

    second = await client.post(
        "/api/v1/auth/verify",
        json={"wallet": wallet, "nonce": nonce, "signature": sig},
    )
    assert second.status_code == 401
