"""Auto-register an agent wallet with the global Helius webhook on
join_season. Lazy: creates the webhook on the first wallet, updates it
on every subsequent wallet. Stores the webhook id in the
helius_webhooks table so coordinator restarts don't re-create.

If HELIUS_API_KEY is unset the registrar is a no-op so dev workflows
work without a real Helius account."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import HeliusWebhook
from app.services.helius import HeliusClient, HeliusError

logger = logging.getLogger(__name__)

GLOBAL_LABEL = "global"


class HeliusRegistrar:
    def __init__(self, client: HeliusClient | None = None) -> None:
        self._client = client or HeliusClient()

    def is_enabled(self) -> bool:
        return bool(settings.helius_api_key)

    async def add_wallet(self, session: AsyncSession, wallet: str) -> str | None:
        """Ensure `wallet` is observed by the global webhook. Returns the
        webhook id, or None if Helius isn't configured."""
        if not self.is_enabled():
            return None

        existing = await session.execute(
            select(HeliusWebhook).where(HeliusWebhook.label == GLOBAL_LABEL)
        )
        webhook = existing.scalar_one_or_none()

        if webhook is None:
            webhook_id = await self._client.create_webhook([wallet])
            webhook = HeliusWebhook(label=GLOBAL_LABEL, webhook_id=webhook_id)
            session.add(webhook)
            await session.commit()
            await session.refresh(webhook)
            logger.info("created Helius webhook %s with %s", webhook_id, wallet)
            return webhook_id

        await self._client.add_addresses(webhook.webhook_id, [wallet])
        logger.info("added %s to Helius webhook %s", wallet, webhook.webhook_id)
        return webhook.webhook_id


async def try_register_wallet(
    session: AsyncSession, wallet: str, registrar: HeliusRegistrar | None = None
) -> str | None:
    """Convenience wrapper that swallows HeliusError so a Helius outage
    doesn't break a successful join. Caller logs the join — operators
    can re-register manually if Helius was down."""
    reg = registrar or HeliusRegistrar()
    if not reg.is_enabled():
        return None
    try:
        return await reg.add_wallet(session, wallet)
    except HeliusError as exc:
        logger.warning("helius register failed for %s: %s", wallet, exc)
        return None
