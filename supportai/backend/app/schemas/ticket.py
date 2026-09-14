from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from app.schemas.auth import UserResponse


class CreateTicketRequest(BaseModel):
    title: str
    description: str
    category: Optional[str] = "Other"
    order_id: Optional[str] = None


class SolutionAttemptResponse(BaseModel):
    id: int
    attempt_number: int
    solution_summary: str
    result: str
    created_at: datetime

    class Config:
        from_attributes = True


class AIAnalysisResponse(BaseModel):
    id: int
    sentiment_label: Optional[str]
    sentiment_score: Optional[float]
    intent_label: Optional[str]
    intent_score: Optional[float]
    urgency_label: Optional[str]
    urgency_score: Optional[float]
    escalation_risk_level: Optional[str]
    escalation_risk_score: Optional[float]
    key_issue: Optional[str]
    recommended_action: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    id: int
    ticket_id: int
    sender_type: str
    sender_id: Optional[int]
    content: str
    is_internal: bool
    created_at: datetime
    sender: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class TicketEventResponse(BaseModel):
    id: int
    event_type: str
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class TicketResponse(BaseModel):
    id: int
    public_token: str
    customer_id: int
    assigned_agent_id: Optional[int]
    title: str
    description: str
    category: str
    priority: str
    status: str
    ai_attempt_count: int
    escalation_reason: Optional[str]
    order_id: Optional[str]
    satisfaction_rating: Optional[float]
    satisfaction_comment: Optional[str]
    was_resolved: Optional[bool]
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime]
    closed_at: Optional[datetime]
    customer: Optional[UserResponse] = None
    assigned_agent: Optional[UserResponse] = None
    analyses: List[AIAnalysisResponse] = []
    solution_attempts: List[SolutionAttemptResponse] = []
    events: List[TicketEventResponse] = []

    class Config:
        from_attributes = True


class SatisfactionRequest(BaseModel):
    rating: Optional[float] = None
    comment: Optional[str] = None
    was_resolved: bool


class EscalationRequest(BaseModel):
    reason: Optional[str] = None


class NoteRequest(BaseModel):
    content: str


class AgentNoteResponse(BaseModel):
    id: int
    content: str
    agent: Optional[UserResponse] = None
    created_at: datetime

    class Config:
        from_attributes = True
