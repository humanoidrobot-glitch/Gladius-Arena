from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_wallet
from app.db.session import get_session
from app.models import Agent
from app.schemas.agent import AgentRegister, AgentResponse

router = APIRouter(prefix="/api/v1/agents", tags=["agents"])


@router.post("/register", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def register_agent(
    payload: AgentRegister,
    wallet: str = Depends(get_current_wallet),
    session: AsyncSession = Depends(get_session),
) -> Agent:
    agent = Agent(
        wallet_pubkey=wallet,
        name=payload.name,
        metadata_uri=payload.metadata_uri,
        three_ws_agent_id=payload.three_ws_agent_id,
    )
    session.add(agent)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="agent already registered for this wallet",
        ) from exc
    await session.refresh(agent)
    return agent


@router.get("/{wallet}", response_model=AgentResponse)
async def get_agent(
    wallet: str,
    session: AsyncSession = Depends(get_session),
) -> Agent:
    result = await session.execute(
        select(Agent).where(Agent.wallet_pubkey == wallet)
    )
    agent = result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="agent not found")
    return agent
