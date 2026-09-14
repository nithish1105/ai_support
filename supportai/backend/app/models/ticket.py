import enum
from app.database.database import Base

try:
    from sqlalchemy import Column, Integer, String, Text, DateTime, Enum as SAEnum, Float, ForeignKey, Boolean
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


class TicketStatus(str, enum.Enum):
    CREATED = "CREATED"
    AI_ASSISTING = "AI_ASSISTING"
    WAITING_FOR_CUSTOMER = "WAITING_FOR_CUSTOMER"
    CUSTOMER_NOT_SATISFIED = "CUSTOMER_NOT_SATISFIED"
    ESCALATION_REQUESTED = "ESCALATION_REQUESTED"
    WAITING_FOR_AGENT = "WAITING_FOR_AGENT"
    AGENT_ASSIGNED = "AGENT_ASSIGNED"
    HUMAN_AGENT_ACTIVE = "HUMAN_AGENT_ACTIVE"
    AI_RESOLVED = "AI_RESOLVED"
    RESOLVED = "RESOLVED"
    REOPENED = "REOPENED"
    CLOSED = "CLOSED"


class TicketPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class TicketCategory(str, enum.Enum):
    TECHNICAL_ISSUE = "Technical Issue"
    INTERNET_PROBLEM = "Internet Problem"
    BILLING_PROBLEM = "Billing Problem"
    PAYMENT_PROBLEM = "Payment Problem"
    REFUND = "Refund"
    ACCOUNT_PROBLEM = "Account Problem"
    PASSWORD = "Password"
    ORDER = "Order"
    DELIVERY = "Delivery"
    SUBSCRIPTION = "Subscription"
    CANCELLATION = "Cancellation"
    PRODUCT_INFORMATION = "Product Information"
    COMPLAINT = "Complaint"
    FEEDBACK = "Feedback"
    OTHER = "Other"


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    public_token = Column(String(50), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_agent_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(SAEnum(TicketCategory), default=TicketCategory.OTHER)
    priority = Column(SAEnum(TicketPriority), default=TicketPriority.MEDIUM)
    status = Column(SAEnum(TicketStatus), default=TicketStatus.CREATED, nullable=False)
    ai_attempt_count = Column(Integer, default=0)
    escalation_reason = Column(Text, nullable=True)
    order_id = Column(String(100), nullable=True)
    satisfaction_rating = Column(Float, nullable=True)
    satisfaction_comment = Column(Text, nullable=True)
    was_resolved = Column(Boolean, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    customer = relationship("User", foreign_keys=[customer_id], back_populates="tickets_as_customer")
    assigned_agent = relationship("User", foreign_keys=[assigned_agent_id], back_populates="tickets_as_agent")
    messages = relationship("Message", back_populates="ticket", order_by="Message.created_at")
    analyses = relationship("AIAnalysis", back_populates="ticket")
    solution_attempts = relationship("SolutionAttempt", back_populates="ticket", order_by="SolutionAttempt.attempt_number")
    notes = relationship("AgentNote", back_populates="ticket")
    events = relationship("TicketEvent", back_populates="ticket", order_by="TicketEvent.created_at")
