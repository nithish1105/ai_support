import enum
from app.database.database import Base

try:
    from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum as SAEnum, Text, ForeignKey, Float
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


class UserRole(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    AGENT = "AGENT"
    SUPERVISOR = "SUPERVISOR"
    ADMIN = "ADMIN"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.CUSTOMER, nullable=False)
    is_active = Column(Boolean, default=True)
    is_online = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    tickets_as_customer = relationship("Ticket", foreign_keys="Ticket.customer_id", back_populates="customer")
    tickets_as_agent = relationship("Ticket", foreign_keys="Ticket.assigned_agent_id", back_populates="assigned_agent")
    messages = relationship("Message", back_populates="sender")
    notes = relationship("AgentNote", back_populates="agent")
