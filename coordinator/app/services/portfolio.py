import time
from decimal import Decimal

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Agent, PortfolioSnapshot, Season
from app.services.jupiter_prices import JupiterPriceClient
from app.services.solana_rpc import SolanaRpcClient, TokenBalance

USDC_MICRO = Decimal(1_000_000)


class Holding(BaseModel):
    mint: str
    amount: Decimal
    price_usd: Decimal
    value_usd: Decimal


def compute_value(
    balances: list[TokenBalance],
    prices: dict[str, Decimal],
) -> tuple[Decimal, list[Holding]]:
    """Combine raw token balances and per-mint USD prices into a USD total
    and a holdings breakdown. Mints without prices are silently skipped."""
    total = Decimal(0)
    holdings: list[Holding] = []
    for bal in balances:
        price = prices.get(bal.mint)
        if price is None:
            continue
        amount = Decimal(bal.raw_amount) / (Decimal(10) ** bal.decimals)
        value = amount * price
        total += value
        holdings.append(
            Holding(mint=bal.mint, amount=amount, price_usd=price, value_usd=value)
        )
    return total, holdings


async def snapshot_for_agent(
    session: AsyncSession,
    *,
    season: Season,
    agent: Agent,
    rpc: SolanaRpcClient,
    prices: JupiterPriceClient,
    timestamp: int | None = None,
) -> PortfolioSnapshot:
    balances = await rpc.get_full_balances(agent.wallet_pubkey)
    price_map = await prices.get_prices([b.mint for b in balances])
    total_usd, holdings = compute_value(balances, price_map)

    snapshot = PortfolioSnapshot(
        season_id=season.id,
        agent_id=agent.id,
        total_value_usdc_micro=int(total_usd * USDC_MICRO),
        holdings_json=[h.model_dump(mode="json") for h in holdings],
        timestamp=timestamp if timestamp is not None else int(time.time()),
    )
    session.add(snapshot)
    await session.commit()
    await session.refresh(snapshot)
    return snapshot
