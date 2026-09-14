import enum
from datetime import datetime
from app.database.database import Base

try:
    from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, Enum as SAEnum
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


class VoiceSessionStatus(str, enum.Enum):
    CONNECTING = "CONNECTING"
    ACTIVE = "ACTIVE"
    ESCALATED = "ESCALATED"
    ENDED = "ENDED"
    FAILED = "FAILED"


class VoiceSpeakerType(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    AI = "AI"
    AGENT = "AGENT"
    SYSTEM = "SYSTEM"


class VoiceSession(Base):
    __tablename__ = "voice_sessions"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)
    duration = Column(Integer, default=0)  # seconds
    language = Column(String(50), default="en-US")
    status = Column(SAEnum(VoiceSessionStatus), default=VoiceSessionStatus.ACTIVE, nullable=False)
    recording_enabled = Column(Boolean, default=False)
    metrics = Column(Text, nullable=True)  # JSON string: latency, confidence, packet loss

    # Relationships
    ticket = relationship("Ticket", backref="voice_sessions")
    transcripts = relationship("VoiceTranscript", back_populates="session", order_by="VoiceTranscript.timestamp")


class VoiceTranscript(Base):
    __tablename__ = "voice_transcripts"

    id = Column(Integer, primary_key=True, index=True)
    voice_session_id = Column(Integer, ForeignKey("voice_sessions.id"), nullable=False, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False, index=True)
    speaker = Column(SAEnum(VoiceSpeakerType), nullable=False)
    text = Column(Text, nullable=False)
    confidence = Column(Float, default=1.0)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    is_final = Column(Boolean, default=True)

    # Relationships
    session = relationship("VoiceSession", back_populates="transcripts")
    ticket = relationship("Ticket", backref="voice_transcripts")
