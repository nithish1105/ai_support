"""
Voice REST API Endpoints for SupportAI.
Provides:
- POST /api/voice/session: Start voice call session
- GET /api/voice/session/{id}: Get session details & metrics
- POST /api/voice/session/{id}/end: Conclude session
- GET /api/voice/transcript/{ticket_id}: Fetch complete transcripts
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.database import get_db
from app.models.user import User
from app.models.ticket import Ticket
from app.models.voice import VoiceSession, VoiceTranscript, VoiceSessionStatus, VoiceSpeakerType
from app.api.auth import get_current_user
from app.services.voice_session_service import voice_session_service

router = APIRouter(prefix="/api/voice", tags=["voice"])

class VoiceSessionCreateRequest(BaseModel):
    ticket_id: int
    language: Optional[str] = "en-US"

class VoiceSessionEndRequest(BaseModel):
    status: Optional[str] = "ENDED"
    metrics: Optional[dict] = None

class VoiceTranscriptResponse(BaseModel):
    id: int
    voice_session_id: int
    ticket_id: int
    speaker: str
    text: str
    confidence: float
    timestamp: str
    is_final: bool

@router.post("/session")
async def start_voice_session(
    req: VoiceSessionCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a new voice session for a ticket."""
    result = await db.execute(select(Ticket).where(Ticket.id == req.ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    # Authorization check
    if current_user.role == "CUSTOMER" and ticket.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized access to this ticket")

    session = await voice_session_service.create_session(db, req.ticket_id, req.language or "en-US")
    return {
        "id": session.id,
        "ticket_id": session.ticket_id,
        "language": session.language,
        "status": session.status.value,
        "recording_enabled": session.recording_enabled,
        "started_at": session.started_at.isoformat() if session.started_at else None,
    }

@router.get("/session/{id}")
async def get_voice_session(
    id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve details of a voice session."""
    result = await db.execute(select(VoiceSession).where(VoiceSession.id == id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voice session not found")

    return {
        "id": session.id,
        "ticket_id": session.ticket_id,
        "language": session.language,
        "status": session.status.value,
        "duration": session.duration,
        "metrics": session.metrics,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "ended_at": session.ended_at.isoformat() if session.ended_at else None,
    }

@router.post("/session/{id}/end")
async def end_voice_session(
    id: int,
    req: VoiceSessionEndRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Conclude an active voice session."""
    ended = await voice_session_service.end_session(
        db=db,
        session_id=id,
        status=VoiceSessionStatus.ENDED,
        metrics=req.metrics,
    )
    if not ended:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voice session not found")

    return {
        "id": ended.id,
        "ticket_id": ended.ticket_id,
        "status": ended.status.value,
        "duration": ended.duration,
        "ended_at": ended.ended_at.isoformat() if ended.ended_at else None,
    }

@router.get("/transcript/{ticket_id}")
async def get_ticket_transcripts(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch all voice transcripts recorded for a ticket."""
    transcripts = await voice_session_service.get_session_transcripts(db, ticket_id)
    return [
        {
            "id": t.id,
            "voice_session_id": t.voice_session_id,
            "ticket_id": t.ticket_id,
            "speaker": t.speaker.value if hasattr(t.speaker, "value") else str(t.speaker),
            "text": t.text,
            "confidence": t.confidence,
            "timestamp": t.timestamp.isoformat() if t.timestamp else None,
            "is_final": t.is_final,
        }
        for t in transcripts
    ]
