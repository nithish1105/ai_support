# Models package
from app.models.user import User, UserRole
from app.models.ticket import Ticket, TicketStatus, TicketPriority, TicketCategory
from app.models.message import Message, SenderType
from app.models.analysis import AIAnalysis, SolutionAttempt
from app.models.knowledge_article import KnowledgeArticle, AgentNote, TicketEvent
from app.models.voice import VoiceSession, VoiceTranscript, VoiceSessionStatus, VoiceSpeakerType

__all__ = [
    "User", "UserRole",
    "Ticket", "TicketStatus", "TicketPriority", "TicketCategory",
    "Message", "SenderType",
    "AIAnalysis", "SolutionAttempt",
    "KnowledgeArticle", "AgentNote", "TicketEvent",
    "VoiceSession", "VoiceTranscript", "VoiceSessionStatus", "VoiceSpeakerType",
]
