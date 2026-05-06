from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class HeliusWebhook(Base):
    """Singleton-per-label record of a Helius webhook the coordinator
    owns. The 'global' label is the default — every joined wallet is
    added to it. Per-season labels are reserved for Phase 2 if we want
    isolated webhooks per arena."""

    __tablename__ = "helius_webhooks"

    id: Mapped[int] = mapped_column(primary_key=True)
    label: Mapped[str] = mapped_column(String(64), unique=True)
    webhook_id: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
