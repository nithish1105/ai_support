"""
Voice Session Service for SupportAI.
Handles:
- Voice session creation, lifecycle, and termination
- Duration and latency metrics
- Voice transcripts storage and retrieval
- Handoff summary generation for voice escalation
- Privacy and recording compliance (VOICE_RECORDING_ENABLED=false)
"""

import json
import os
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.voice import VoiceSession, VoiceTranscript, VoiceSessionStatus, VoiceSpeakerType
from app.models.ticket import Ticket, TicketStatus
from app.models.knowledge_article import TicketEvent

logger = logging.getLogger(__name__)

VOICE_RECORDING_ENABLED = os.getenv("VOICE_RECORDING_ENABLED", "false").lower() in ("true", "1")

class VoiceSessionService:
    def __init__(self):
        self.recording_enabled = VOICE_RECORDING_ENABLED

    async def create_session(
        self,
        db: AsyncSession,
        ticket_id: int,
        language: str = "en-US",
    ) -> VoiceSession:
        """Create a new voice session for a ticket."""
        session = VoiceSession(
            ticket_id=ticket_id,
            language=language,
            status=VoiceSessionStatus.ACTIVE,
            recording_enabled=self.recording_enabled,
            metrics=json.dumps({"stt_confidence_avg": 1.0, "latency_ms": 0, "packet_loss": 0}),
        )
        db.add(session)
        await db.flush()
        await db.refresh(session)

        # Log Ticket Event
        event = TicketEvent(
            ticket_id=ticket_id,
            event_type="VOICE_CALL_STARTED",
            description=f"Voice call session #{session.id} started ({language})",
        )
        db.add(event)
        await db.commit()
        return session

    async def end_session(
        self,
        db: AsyncSession,
        session_id: int,
        status: VoiceSessionStatus = VoiceSessionStatus.ENDED,
        metrics: Optional[Dict[str, Any]] = None,
    ) -> Optional[VoiceSession]:
        """Conclude an active voice session and calculate duration."""
        result = await db.execute(select(VoiceSession).where(VoiceSession.id == session_id))
        session = result.scalar_one_or_none()
        if not session:
            return None

        now = datetime.now(timezone.utc)
        session.ended_at = now
        session.status = status

        if session.started_at:
            # Normalize naive/aware datetime comparison
            started = session.started_at
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            session.duration = max(1, int((now - started).total_seconds()))

        if metrics:
            session.metrics = json.dumps(metrics)

        # Log Event
        event = TicketEvent(
            ticket_id=session.ticket_id,
            event_type="VOICE_CALL_ENDED",
            description=f"Voice session #{session.id} ended. Duration: {session.duration}s",
        )
        db.add(event)
        await db.commit()
        await db.refresh(session)
        return session

    async def add_transcript(
        self,
        db: AsyncSession,
        session_id: int,
        ticket_id: int,
        speaker: VoiceSpeakerType,
        text: str,
        confidence: float = 1.0,
        is_final: bool = True,
    ) -> VoiceTranscript:
        """Store conversation transcript line in database."""
        transcript = VoiceTranscript(
            voice_session_id=session_id,
            ticket_id=ticket_id,
            speaker=speaker,
            text=text.strip(),
            confidence=round(confidence, 2),
            is_final=is_final,
        )
        db.add(transcript)
        await db.flush()
        await db.commit()
        await db.refresh(transcript)
        return transcript

    async def get_session_transcripts(
        self,
        db: AsyncSession,
        ticket_id: int,
    ) -> List[VoiceTranscript]:
        """Fetch all transcripts for a ticket in chronological order."""
        result = await db.execute(
            select(VoiceTranscript)
            .where(VoiceTranscript.ticket_id == ticket_id)
            .order_by(VoiceTranscript.timestamp.asc())
        )
        return result.scalars().all()

    def generate_voice_handoff_summary(
        self,
        ticket_title: str,
        customer_name: str,
        latest_analysis: Optional[Dict[str, Any]],
        solution_attempts: List[Dict[str, Any]],
        last_customer_statement: str,
        session_duration: int = 0,
    ) -> str:
        """Generate structured AI Handoff Summary specifically formatted for voice escalations."""
        attempts_formatted = ""
        for att in solution_attempts:
            num = att.get("attempt_number", "?")
            summary = att.get("solution_summary", "Solution step")
            res = att.get("result", "PENDING")
            attempts_formatted += f"\n{num}. {summary} — **{res}**"

        analysis_str = ""
        if latest_analysis:
            analysis_str = (
                f"- **Sentiment:** {latest_analysis.get('sentiment_label', 'NEGATIVE')}\n"
                f"- **Intent:** {latest_analysis.get('intent_label', 'Technical Issue')}\n"
                f"- **Urgency:** {latest_analysis.get('urgency_label', 'HIGH')}\n"
                f"- **Escalation Risk:** {latest_analysis.get('escalation_risk_level', 'HIGH')} "
                f"({latest_analysis.get('escalation_risk_score', 80):.0f}%)"
            )

        duration_fmt = f"{session_duration // 60:02d}:{session_duration % 60:02d}"

        return f"""## Voice Call Handoff Summary

**Issue:** {ticket_title}
**Customer:** {customer_name}
**Call Duration:** {duration_fmt}

### Analysis
{analysis_str or "Live voice call escalation"}

### Attempted Solutions
{attempts_formatted or "Troubleshooting steps attempted with customer."}

### Customer's Latest Voice Statement
> "{last_customer_statement}"

**Recommended Action:**
Acknowledge customer's voice statements, verify service status in customer area, and take ownership of live resolution.
""".strip()

# Singleton export
voice_session_service = VoiceSessionService()
