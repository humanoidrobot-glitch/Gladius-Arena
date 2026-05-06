from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[int] = mapped_column(primary_key=True)
    wallet_pubkey: Mapped[str] = mapped_column(String(44), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(32))
    metadata_uri: Mapped[str] = mapped_column(String(200), default="")
    three_ws_agent_id: Mapped[str | None] = mapped_column(String(44), default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
