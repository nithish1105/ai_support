"""
Voice AI Service for SupportAI.
Orchestrates:
- Connecting speech transcripts to the existing AI engine (ai_service.py)
- Multi-turn conversation context memory (tracking attempted steps across turns)
- Customer barge-in / interruption handling
- Low-confidence clarification vs normal execution
- Concise vocalized response generation
"""

import re
import logging
from typing import Dict, Any, List, Optional, Tuple

from app.services import ai_service
from app.services.text_to_speech_service import tts_service
from app.services.speech_to_text_service import stt_service

logger = logging.getLogger(__name__)

class VoiceAIService:
    def __init__(self):
        logger.info("Initializing VoiceAIService...")

    def check_for_human_request(self, text: str) -> bool:
        """Detect if customer is explicitly asking for a human agent."""
        text_lower = text.lower()
        patterns = [
            r"\b(talk|speak|connect|transfer|give me|get me|want|need)\b.*?\b(human|agent|person|representative|manager|supervisor|real person)\b",
            r"\b(i want a human|human agent|real person|transfer me|talk to someone|speak to someone)\b",
            r"\bescalate\b",
        ]
        for pat in patterns:
            if re.search(pat, text_lower):
                return True
        return False

    def process_customer_voice(
        self,
        transcript: str,
        confidence: float,
        ticket_title: str,
        ticket_description: str,
        conversation_history: List[Dict[str, str]],
        ai_attempt_count: int,
        failed_solutions: List[str],
        knowledge_article: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Processes transcribed customer voice text through the AI reasoning pipeline.
        Returns:
            {
                "raw_response": str,
                "spoken_response": str,
                "solution_summary": str,
                "analysis": Dict,
                "is_escalation": bool,
                "is_low_confidence": bool,
                "requires_repetition": bool
            }
        """
        # 1. Low-confidence check: If speech was unintelligible, ask to repeat
        if confidence < 0.45 or len(transcript.strip()) < 2:
            clarification = "I'm sorry, I didn't catch that clearly. Could you please repeat the issue?"
            return {
                "raw_response": clarification,
                "spoken_response": clarification,
                "solution_summary": "Requested customer speech repetition due to low audio confidence",
                "analysis": {
                    "sentiment": {"label": "NEUTRAL", "score": 0.5},
                    "intent": {"label": "Other", "score": 0.5},
                    "urgency": {"label": "MEDIUM", "score": 0.5},
                    "escalation_risk": {"level": "LOW", "score": 20.0},
                },
                "is_escalation": False,
                "is_low_confidence": True,
                "requires_repetition": True,
            }

        # 2. Check for human agent escalation request
        if self.check_for_human_request(transcript):
            escalate_msg = "I understand. I'm connecting you with a human support agent right now. Please stay on the line."
            return {
                "raw_response": escalate_msg,
                "spoken_response": escalate_msg,
                "solution_summary": "Customer requested human escalation during voice call",
                "analysis": {
                    "sentiment": {"label": "NEGATIVE", "score": 0.8},
                    "intent": {"label": "Complaint", "score": 0.9},
                    "urgency": {"label": "HIGH", "score": 0.85},
                    "escalation_risk": {"level": "CRITICAL", "score": 95.0, "human_requested": True},
                },
                "is_escalation": True,
                "is_low_confidence": False,
                "requires_repetition": False,
            }

        # 3. Analyze customer statement using existing AI pipeline
        customer_history_texts = [m.get("content", "") for m in conversation_history if m.get("sender_type") == "CUSTOMER"]
        analysis = ai_service.full_analysis(
            text=transcript,
            ai_attempt_count=ai_attempt_count,
            failed_solutions=len(failed_solutions),
            conversation_history=customer_history_texts,
        )

        # 4. Generate AI response with conversation context memory
        raw_response = None
        solution_summary = None
        try:
            from app.services.groq_service import groq_service
            if groq_service.is_available():
                groq_voice = groq_service.generate_response_sync(
                    ticket_title=ticket_title,
                    ticket_description=ticket_description,
                    customer_message=transcript,
                    conversation_history=conversation_history,
                    knowledge_article=knowledge_article,
                    ai_attempt_count=ai_attempt_count,
                    failed_solutions=failed_solutions,
                    is_voice=True,
                )
                if groq_voice and groq_voice[0]:
                    raw_response, solution_summary = groq_voice
        except Exception as e:
            logger.warning(f"Voice Groq generation failed: {e}")

        if not raw_response:
            raw_response, solution_summary = ai_service.generate_ai_response(
                ticket_title=ticket_title,
                ticket_description=ticket_description,
                intent=analysis["intent"]["label"],
                sentiment=analysis["sentiment"]["label"],
                urgency=analysis["urgency"]["label"],
                ai_attempt_count=ai_attempt_count,
                conversation_history=conversation_history,
                knowledge_article=knowledge_article,
                failed_solutions=failed_solutions,
                customer_message=transcript,
            )

        # 5. Format response for natural speech
        spoken_response = tts_service.format_for_speech(raw_response)

        # 6. Check if escalation threshold reached
        is_escalate = (
            ai_attempt_count >= ai_service.settings.MAX_AI_ATTEMPTS or
            analysis["escalation_risk"]["level"] == "CRITICAL"
        )

        return {
            "raw_response": raw_response,
            "spoken_response": spoken_response,
            "solution_summary": solution_summary,
            "analysis": analysis,
            "is_escalation": is_escalate,
            "is_low_confidence": False,
            "requires_repetition": False,
        }

    async def process_customer_voice_async(
        self,
        transcript: str,
        confidence: float,
        ticket_title: str,
        ticket_description: str,
        conversation_history: List[Dict[str, str]],
        ai_attempt_count: int,
        failed_solutions: List[str],
        knowledge_article: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Async version of process_customer_voice using non-blocking Groq API."""
        if confidence < 0.45 or len(transcript.strip()) < 2:
            clarification = "I'm sorry, I didn't catch that clearly. Could you please repeat the issue?"
            return {
                "raw_response": clarification,
                "spoken_response": clarification,
                "solution_summary": "Requested customer speech repetition due to low audio confidence",
                "analysis": {
                    "sentiment": {"label": "NEUTRAL", "score": 0.5},
                    "intent": {"label": "Other", "score": 0.5},
                    "urgency": {"label": "MEDIUM", "score": 0.5},
                    "escalation_risk": {"level": "LOW", "score": 20.0},
                },
                "is_escalation": False,
                "is_low_confidence": True,
                "requires_repetition": True,
            }

        if self.check_for_human_request(transcript):
            escalate_msg = "I understand. I'm connecting you with a human support agent right now. Please stay on the line."
            return {
                "raw_response": escalate_msg,
                "spoken_response": escalate_msg,
                "solution_summary": "Customer requested human escalation during voice call",
                "analysis": {
                    "sentiment": {"label": "NEGATIVE", "score": 0.8},
                    "intent": {"label": "Complaint", "score": 0.9},
                    "urgency": {"label": "HIGH", "score": 0.85},
                    "escalation_risk": {"level": "CRITICAL", "score": 95.0, "human_requested": True},
                },
                "is_escalation": True,
                "is_low_confidence": False,
                "requires_repetition": False,
            }

        customer_history_texts = [m.get("content", "") for m in conversation_history if m.get("sender_type") == "CUSTOMER"]
        analysis = ai_service.full_analysis(
            text=transcript,
            ai_attempt_count=ai_attempt_count,
            failed_solutions=len(failed_solutions),
            conversation_history=customer_history_texts,
        )

        raw_response = None
        solution_summary = None
        try:
            from app.services.groq_service import groq_service
            if groq_service.is_available():
                groq_voice = await groq_service.generate_response(
                    ticket_title=ticket_title,
                    ticket_description=ticket_description,
                    customer_message=transcript,
                    conversation_history=conversation_history,
                    knowledge_article=knowledge_article,
                    ai_attempt_count=ai_attempt_count,
                    failed_solutions=failed_solutions,
                    is_voice=True,
                )
                if groq_voice and groq_voice[0]:
                    raw_response, solution_summary = groq_voice
        except Exception as e:
            logger.warning(f"Async Voice Groq generation failed: {e}")

        if not raw_response:
            raw_response, solution_summary = ai_service.generate_ai_response(
                ticket_title=ticket_title,
                ticket_description=ticket_description,
                intent=analysis["intent"]["label"],
                sentiment=analysis["sentiment"]["label"],
                urgency=analysis["urgency"]["label"],
                ai_attempt_count=ai_attempt_count,
                conversation_history=conversation_history,
                knowledge_article=knowledge_article,
                failed_solutions=failed_solutions,
                customer_message=transcript,
            )

        spoken_response = tts_service.format_for_speech(raw_response)
        is_escalate = (
            ai_attempt_count >= ai_service.settings.MAX_AI_ATTEMPTS or
            analysis["escalation_risk"]["level"] == "CRITICAL"
        )

        return {
            "raw_response": raw_response,
            "spoken_response": spoken_response,
            "solution_summary": solution_summary,
            "analysis": analysis,
            "is_escalation": is_escalate,
            "is_low_confidence": False,
            "requires_repetition": False,
        }

# Singleton export
voice_ai_service = VoiceAIService()
