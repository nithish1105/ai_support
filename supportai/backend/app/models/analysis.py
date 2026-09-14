from app.database.database import Base

try:
    from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text
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


class AIAnalysis(Base):
    __tablename__ = "ai_analyses"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=True)

    sentiment_label = Column(String(50))
    sentiment_score = Column(Float)

    intent_label = Column(String(100))
    intent_score = Column(Float)

    urgency_label = Column(String(50))
    urgency_score = Column(Float)

    escalation_risk_level = Column(String(50))
    escalation_risk_score = Column(Float)

    key_issue = Column(Text, nullable=True)
    recommended_action = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    ticket = relationship("Ticket", back_populates="analyses")


class SolutionAttempt(Base):
    __tablename__ = "solution_attempts"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    attempt_number = Column(Integer, nullable=False)
    solution_summary = Column(Text, nullable=False)
    full_response = Column(Text, nullable=True)
    result = Column(String(50), default="PENDING")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    ticket = relationship("Ticket", back_populates="solution_attempts")
