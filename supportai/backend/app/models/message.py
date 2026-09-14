import enum
from app.database.database import Base

try:
    from sqlalchemy import Column, Integer, String, Text, DateTime, Enum as SAEnum, Boolean, ForeignKey
    from sqlalchemy.orm import relationship
    from sqlalchemy.sql import func
    _has_sa = True
except ImportError:
    _has_sa = False
    def Column(*args, **kwargs): return None
    def Integer(*args, **kwargs): return None
    def String(*args, **kwargs): return None
    def Boolean(*args, **kwargs): return None
    def DateTime(*args, **kwargs): return None
    def SAEnum(*args, **kwargs): return None
    def Text(*args, **kwargs): return None
    def ForeignKey(*args, **kwargs): return None
    def Float(*args, **kwargs): return None
    def relationship(*args, **kwargs): return None
    class func:
        @staticmethod
        def now(): return None


class SenderType(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    AI = "AI"
    AGENT = "AGENT"
    SYSTEM = "SYSTEM"


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    sender_type = Column(SAEnum(SenderType), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    content = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    ticket = relationship("Ticket", back_populates="messages")
    sender = relationship("User", back_populates="messages")
