from collections.abc import AsyncIterator
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import settings
from app.models import HeliusWebhook
from app.services.helius import HeliusError
from app.services.helius_registrar import GLOBAL_LABEL, HeliusRegistrar, try_register_wallet


@pytest_asyncio.fixture
async def db_session(test_engine) -> AsyncIterator[AsyncSession]:
    Session = async_sessionmaker(test_engine, expire_on_commit=False)
    async with Session() as session:
        yield session


@pytest.fixture(autouse=True)
def _enable_helius(monkeypatch):
    monkeypatch.setattr(settings, "helius_api_key", "test-key")
    monkeypatch.setattr(settings, "helius_webhook_secret", "test-secret-32-chars-aaaaa")


def _mock_client() -> AsyncMock:
    c = AsyncMock()
    c.create_webhook.return_value = "wh_new_id"
    c.add_addresses.return_value = None
    return c


async def test_disabled_when_api_key_unset(db_session: AsyncSession, monkeypatch) -> None:
    monkeypatch.setattr(settings, "helius_api_key", "")
    registrar = HeliusRegistrar(client=_mock_client())
    assert registrar.is_enabled() is False
    result = await registrar.add_wallet(db_session, "Wallet" * 7)
    assert result is None


async def test_first_call_creates_webhook(db_session: AsyncSession) -> None:
    client = _mock_client()
    registrar = HeliusRegistrar(client=client)
    webhook_id = await registrar.add_wallet(db_session, "Wallet" * 7)
    assert webhook_id == "wh_new_id"
    client.create_webhook.assert_called_once_with(["Wallet" * 7])
    client.add_addresses.assert_not_called()

    row = (await db_session.execute(
        select(HeliusWebhook).where(HeliusWebhook.label == GLOBAL_LABEL)
    )).scalar_one()
    assert row.webhook_id == "wh_new_id"


async def test_second_call_adds_to_existing_webhook(db_session: AsyncSession) -> None:
    client = _mock_client()
    registrar = HeliusRegistrar(client=client)
    await registrar.add_wallet(db_session, "WalletA" * 6)
    client.create_webhook.reset_mock()
    client.add_addresses.reset_mock()

    webhook_id = await registrar.add_wallet(db_session, "WalletB" * 6)
    assert webhook_id == "wh_new_id"
    client.create_webhook.assert_not_called()
    client.add_addresses.assert_called_once_with("wh_new_id", ["WalletB" * 6])

    rows = (await db_session.execute(select(HeliusWebhook))).scalars().all()
    assert len(rows) == 1


async def test_try_register_swallows_helius_errors(db_session: AsyncSession) -> None:
    failing = AsyncMock()
    failing.create_webhook.side_effect = HeliusError("simulated outage")
    registrar = HeliusRegistrar(client=failing)
    result = await try_register_wallet(db_session, "Wallet" * 7, registrar=registrar)
    assert result is None
    rows = (await db_session.execute(select(HeliusWebhook))).scalars().all()
    assert rows == []


async def test_try_register_returns_none_when_disabled(
    db_session: AsyncSession, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "helius_api_key", "")
    result = await try_register_wallet(db_session, "Wallet" * 7)
    assert result is None
