from app.database.database import Base

try:
    from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
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


class KnowledgeArticle(Base):
    __tablename__ = "knowledge_articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    category = Column(String(100), nullable=False)
    problem_description = Column(Text, nullable=False)
    solution = Column(Text, nullable=False)
    steps = Column(Text, nullable=True)
    keywords = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class AgentNote(Base):
    __tablename__ = "agent_notes"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    agent_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    ticket = relationship("Ticket", back_populates="notes")
    agent = relationship("User", back_populates="notes")


class TicketEvent(Base):
    __tablename__ = "ticket_events"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    event_type = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    event_metadata = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    ticket = relationship("Ticket", back_populates="events")
