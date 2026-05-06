from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_wallet, require_admin
from app.db.session import get_session
from app.models import Agent, Season, SeasonEntry, SeasonStatus
from app.schemas.agent import SeasonEntryResponse
from app.schemas.season import SeasonCreate, SeasonResponse

router = APIRouter(prefix="/api/v1/seasons", tags=["seasons"])


@router.get("", response_model=list[SeasonResponse])
async def list_seasons(
    session: AsyncSession = Depends(get_session),
) -> list[Season]:
    result = await session.execute(select(Season).order_by(Season.season_id_onchain))
    return result.scalars().all()


@router.get("/{season_id}", response_model=SeasonResponse)
async def get_season(
    season_id: int,
    session: AsyncSession = Depends(get_session),
) -> Season:
    result = await session.execute(
        select(Season).where(Season.season_id_onchain == season_id)
    )
    season = result.scalar_one_or_none()
    if season is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="season not found")
    return season


@router.post("", response_model=SeasonResponse, status_code=status.HTTP_201_CREATED)
async def create_season(
    payload: SeasonCreate,
    admin: str = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> Season:
    # Local counter — concurrent admins can race, but the unique constraint on
    # season_id_onchain stops duplicates (one request fails). The canonical
    # source is GladiusConfig.season_count on-chain; once submit-on-create
    # lands, this row will be populated from the chain-assigned id instead.
    next_id_row = await session.execute(select(func.coalesce(func.max(Season.season_id_onchain), -1)))
    next_id = next_id_row.scalar_one() + 1

    season = Season(
        season_id_onchain=next_id,
        season_pda=None,
        authority=admin,
        name=payload.name,
        description=payload.description,
        trading_universe=list(payload.trading_universe),
        max_agents=payload.max_agents,
        scoring_method=payload.scoring_method,
        end_time=payload.end_time,
    )
    session.add(season)
    await session.commit()
    await session.refresh(season)
    return season


@router.post(
    "/{season_id}/join",
    response_model=SeasonEntryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def join_season(
    season_id: int,
    wallet: str = Depends(get_current_wallet),
    session: AsyncSession = Depends(get_session),
) -> SeasonEntry:
    season_row = await session.execute(
        select(Season).where(Season.season_id_onchain == season_id)
    )
    season = season_row.scalar_one_or_none()
    if season is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="season not found")
    if season.status not in {SeasonStatus.PENDING, SeasonStatus.ACTIVE}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="season is not accepting new entries",
        )
    if season.agent_count >= season.max_agents:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="season has reached its participant cap",
        )

    agent_row = await session.execute(select(Agent).where(Agent.wallet_pubkey == wallet))
    agent = agent_row.scalar_one_or_none()
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="agent must be registered before joining a season",
        )

    entry = SeasonEntry(season_id=season.id, agent_id=agent.id)
    session.add(entry)
    season.agent_count = season.agent_count + 1
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="agent has already joined this season",
        ) from exc
    await session.refresh(entry)
    return entry
