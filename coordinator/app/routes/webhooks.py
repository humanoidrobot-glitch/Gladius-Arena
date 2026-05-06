import logging
from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.helius_auth import verify_helius_auth
from app.db.session import get_session
from app.models import Agent, ObservedTrade, Season, SeasonEntry, SeasonStatus
from app.schemas.events import GladiusEvent
from app.schemas.webhook import HeliusEnhancedTx
from app.services.event_broadcaster import broadcaster

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/api/v1/webhooks",
    tags=["webhooks"],
    dependencies=[Depends(verify_helius_auth)],
)


def _net_legs(
    tx: HeliusEnhancedTx, wallet: str
) -> tuple[str, int, str, int] | None:
    """Compute (out_mint, out_amount, in_mint, in_amount) from net signed
    deltas across `tokenTransfers`. Robust to multi-hop routes and
    fee-deducted-in-same-token cases that defeat naive first-match."""
    deltas: dict[str, int] = defaultdict(int)
    for t in tx.token_transfers:
        try:
            amount = int(t.raw_token_amount or "0")
        except ValueError:
            continue
        if t.from_user_account == wallet:
            deltas[t.mint] -= amount
        if t.to_user_account == wallet:
            deltas[t.mint] += amount

    if not deltas:
        return None
    out_mint, out_delta = min(deltas.items(), key=lambda kv: kv[1])
    in_mint, in_delta = max(deltas.items(), key=lambda kv: kv[1])
    if out_delta >= 0 or in_delta <= 0 or out_mint == in_mint:
        return None
    return out_mint, -out_delta, in_mint, in_delta


def _is_in_universe(season: Season, out_mint: str, in_mint: str) -> bool:
    if not season.trading_universe:
        return True
    return out_mint in season.trading_universe and in_mint in season.trading_universe


@router.post("/helius")
async def helius_webhook(
    payload: list[HeliusEnhancedTx],
    session: AsyncSession = Depends(get_session),
) -> dict[str, int]:
    persisted = 0
    skipped = 0

    for tx in payload:
        if tx.type != "SWAP":
            skipped += 1
            continue

        agent_row = await session.execute(
            select(Agent).where(Agent.wallet_pubkey == tx.fee_payer)
        )
        agent = agent_row.scalar_one_or_none()
        if agent is None:
            skipped += 1
            continue

        legs = _net_legs(tx, agent.wallet_pubkey)
        if legs is None:
            skipped += 1
            continue
        out_mint, out_amount, in_mint, in_amount = legs

        memberships = await session.execute(
            select(SeasonEntry, Season)
            .join(Season, SeasonEntry.season_id == Season.id)
            .where(SeasonEntry.agent_id == agent.id)
            .where(Season.status.in_([SeasonStatus.PENDING, SeasonStatus.ACTIVE]))
        )

        for _entry, season in memberships.all():
            trade = ObservedTrade(
                season_id=season.id,
                agent_id=agent.id,
                tx_signature=tx.signature,
                slot=tx.slot,
                timestamp=tx.timestamp,
                token_in_mint=out_mint,
                token_out_mint=in_mint,
                amount_in_raw=str(out_amount),
                amount_out_raw=str(in_amount),
                in_universe=_is_in_universe(season, out_mint, in_mint),
                raw_helius_json=tx.model_dump(by_alias=True),
            )
            session.add(trade)
            try:
                await session.commit()
                persisted += 1
            except IntegrityError:
                await session.rollback()
                skipped += 1
                continue

            await broadcaster.publish(
                GladiusEvent(
                    type="swap_detected",
                    season_id=season.season_id_onchain,
                    timestamp=tx.timestamp,
                    agent_id=agent.id,
                    wallet_pubkey=agent.wallet_pubkey,
                    three_ws_agent_id=agent.three_ws_agent_id,
                    data={
                        "tx_signature": tx.signature,
                        "token_in": out_mint,
                        "token_out": in_mint,
                        "amount_in_raw": str(out_amount),
                        "amount_out_raw": str(in_amount),
                        "in_universe": _is_in_universe(season, out_mint, in_mint),
                    },
                )
            )

    return {"persisted": persisted, "skipped": skipped}
