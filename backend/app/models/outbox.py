from sqlalchemy import Column, BigInteger, Integer, String, JSON, DateTime, Index, func
from app.core.database import Base


class OutboxEvent(Base):
    """
    Transactional outbox — events written here after every appointment/checkin
    commit, then relayed to Redis so all workers can broadcast via WebSocket.
    Guarantees no event is lost even if a worker crashes between commit and publish.
    """
    __tablename__ = "outbox_events"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    salon_id = Column(Integer, nullable=False, index=True)
    event_type = Column(String(100), nullable=False)
    payload = Column(JSON, nullable=False)
    created_at = Column(DateTime, nullable=False, default=func.now())
    published_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index(
            "ix_outbox_unpublished",
            "created_at",
            postgresql_where=(Column("published_at") == None),  # noqa: E711
        ),
    )
