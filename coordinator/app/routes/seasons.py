from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_admin
from app.db.session import get_session
from app.models.season import Season
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
