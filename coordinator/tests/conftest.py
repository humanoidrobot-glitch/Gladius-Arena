from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from solders.keypair import Keypair
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.auth.jwt_utils import issue_token
from app.config import settings
from app.db.session import get_session
from app.main import app
from app.models import Base


@pytest_asyncio.fixture
async def test_engine() -> AsyncIterator:
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def client(test_engine) -> AsyncIterator[AsyncClient]:
    TestSession = async_sessionmaker(test_engine, expire_on_commit=False)

    async def override_get_session() -> AsyncIterator:
        async with TestSession() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def admin_kp() -> AsyncIterator[Keypair]:
    kp = Keypair()
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(settings, "admin_wallet", str(kp.pubkey()))
        yield kp


@pytest_asyncio.fixture
async def admin_token(admin_kp: Keypair) -> str:
    token, _ = issue_token(str(admin_kp.pubkey()))
    return token
