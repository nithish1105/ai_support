"""
Groq AI Service for SupportAI.
Integrates Groq's ultra-fast LLM inference and Whisper speech-to-text.
Provides:
- Real-time customer support dialogue generation with multi-turn memory
- Spoken voice responses (short, natural, conversational)
- Audio transcription using Groq Whisper-large-v3-turbo
- Agent Copilot insights
- Automatic fail-safe fallback to deterministic templates
"""

import json
import logging
import re
from typing import Dict, Any, List, Optional, Tuple
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

GROQ_BASE_URL = "https://api.groq.com/openai/v1"


class GroqService:
    def __init__(self):
        self.api_key = settings.GROQ_API_KEY
        self.model = settings.GROQ_MODEL
        self.whisper_model = settings.GROQ_WHISPER_MODEL
        self.timeout = 10.0  # Fast timeout

    def is_available(self) -> bool:
        """Check if Groq API is enabled and key is configured."""
        return bool(settings.USE_GROQ and settings.GROQ_API_KEY and len(settings.GROQ_API_KEY.strip()) > 10)

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
            "Content-Type": "application/json",
        }

    def _build_prompt_and_payload(
        self,
        ticket_title: str,
        ticket_description: str,
        customer_message: str,
        conversation_history: List[Dict[str, str]],
        knowledge_article: Optional[Dict[str, Any]] = None,
        ai_attempt_count: int = 0,
        failed_solutions: Optional[List[str]] = None,
        is_voice: bool = False,
    ) -> dict:
        kb_context = ""
        if knowledge_article:
            kb_context = f"\nRelevant Knowledge Base: '{knowledge_article.get('title')}': {knowledge_article.get('solution', '')}"
            steps = knowledge_article.get("steps")
            if steps:
                kb_context += f"\nSteps: {steps}"

        failed_context = ""
        if failed_solutions:
            failed_context = "\nAlready attempted (do NOT repeat): " + ", ".join(failed_solutions)

        if is_voice:
            style_guide = (
                "You are speaking live on a telephone/voice call. Keep your answer to 1-3 spoken sentences maximum. "
                "Never use markdown, bullet points, asterisks, numbered lists, or URLs. "
                "Speak naturally, clearly, and empathetically."
            )
        else:
            style_guide = (
                "Provide a clear, structured, and empathetic response. Use short paragraphs or 2-3 numbered steps. "
                "Be concise (under 120 words). Acknowledge what was already tried."
            )

        system_prompt = f"""You are SupportAI, an empathetic, expert customer support assistant.
Ticket: "{ticket_title}"
Description: "{ticket_description}"
Attempt: {ai_attempt_count + 1} of {settings.MAX_AI_ATTEMPTS}
{kb_context}
{failed_context}

{style_guide}

CRITICAL: Return your response strictly in valid JSON with exactly two keys:
{{
  "response": "Customer facing response string",
  "solution_summary": "Short 3 to 6 word summary of your solution (e.g. 'Suggested checking ONT power cable')"
}}
Return ONLY JSON."""

        messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
        for m in conversation_history[-8:]:
            sender = m.get("sender_type", "").upper()
            role = "user" if sender == "CUSTOMER" else "assistant"
            content = m.get("content", "").strip()
            if content:
                messages.append({"role": role, "content": content})

        if not messages or messages[-1]["content"] != customer_message:
            messages.append({"role": "user", "content": customer_message})

        return {
            "model": self.model,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 250,
            "response_format": {"type": "json_object"},
        }

    async def generate_response(
        self,
        ticket_title: str,
        ticket_description: str,
        customer_message: str,
        conversation_history: List[Dict[str, str]],
        knowledge_article: Optional[Dict[str, Any]] = None,
        ai_attempt_count: int = 0,
        failed_solutions: Optional[List[str]] = None,
        is_voice: bool = False,
    ) -> Optional[Tuple[str, str]]:
        """Async LLM response generation."""
        if not self.is_available():
            return None

        payload = self._build_prompt_and_payload(
            ticket_title=ticket_title,
            ticket_description=ticket_description,
            customer_message=customer_message,
            conversation_history=conversation_history,
            knowledge_article=knowledge_article,
            ai_attempt_count=ai_attempt_count,
            failed_solutions=failed_solutions,
            is_voice=is_voice,
        )

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(
                    f"{GROQ_BASE_URL}/chat/completions",
                    headers=self._get_headers(),
                    json=payload,
                )

                if resp.status_code != 200:
                    logger.warning(f"Groq API status {resp.status_code}: {resp.text[:200]}")
                    if resp.status_code == 404:
                        payload["model"] = "groq/compound"
                        resp2 = await client.post(
                            f"{GROQ_BASE_URL}/chat/completions",
                            headers=self._get_headers(),
                            json=payload,
                        )
                        if resp2.status_code == 200:
                            resp = resp2
                        else:
                            return None
                    else:
                        return None

                data = resp.json()
                raw_content = data["choices"][0]["message"]["content"].strip()
                parsed = json.loads(raw_content)
                return parsed.get("response", "").strip(), parsed.get("solution_summary", "Solution provided").strip()
        except Exception as e:
            logger.warning(f"Groq generate_response error: {e}")
            return None

    def generate_response_sync(
        self,
        ticket_title: str,
        ticket_description: str,
        customer_message: str,
        conversation_history: List[Dict[str, str]],
        knowledge_article: Optional[Dict[str, Any]] = None,
        ai_attempt_count: int = 0,
        failed_solutions: Optional[List[str]] = None,
        is_voice: bool = False,
    ) -> Optional[Tuple[str, str]]:
        """Synchronous LLM response generation for sync callers."""
        if not self.is_available():
            return None

        payload = self._build_prompt_and_payload(
            ticket_title=ticket_title,
            ticket_description=ticket_description,
            customer_message=customer_message,
            conversation_history=conversation_history,
            knowledge_article=knowledge_article,
            ai_attempt_count=ai_attempt_count,
            failed_solutions=failed_solutions,
            is_voice=is_voice,
        )

        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(
                    f"{GROQ_BASE_URL}/chat/completions",
                    headers=self._get_headers(),
                    json=payload,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    raw_content = data["choices"][0]["message"]["content"].strip()
                    parsed = json.loads(raw_content)
                    return parsed.get("response", "").strip(), parsed.get("solution_summary", "Solution provided").strip()
                elif resp.status_code == 404:
                    payload["model"] = "groq/compound"
                    resp2 = client.post(
                        f"{GROQ_BASE_URL}/chat/completions",
                        headers=self._get_headers(),
                        json=payload,
                    )
                    if resp2.status_code == 200:
                        data = resp2.json()
                        raw_content = data["choices"][0]["message"]["content"].strip()
                        parsed = json.loads(raw_content)
                        return parsed.get("response", "").strip(), parsed.get("solution_summary", "Solution provided").strip()
        except Exception as e:
            logger.warning(f"Groq generate_response_sync error: {e}")
        return None

    async def transcribe_audio(
        self,
        audio_bytes: bytes,
        filename: str = "audio.wav",
        language: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Async transcription using Groq Whisper-large-v3-turbo."""
        if not self.is_available() or len(audio_bytes) < 100:
            return None

        data = {
            "model": self.whisper_model,
            "response_format": "verbose_json",
            "temperature": "0.0",
        }
        if language and language != "auto":
            data["language"] = language.split("-")[0]

        files = {"file": (filename, audio_bytes, "audio/wav")}
        headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}"}

        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.post(
                    f"{GROQ_BASE_URL}/audio/transcriptions",
                    headers=headers,
                    data=data,
                    files=files,
                )
                if resp.status_code == 200:
                    res_json = resp.json()
                    text = res_json.get("text", "").strip()
                    return {
                        "text": text,
                        "confidence": 0.95,
                        "language": res_json.get("language", language or "en"),
                    }
        except Exception as e:
            logger.warning(f"Groq transcribe_audio error: {e}")
        return None

    def transcribe_audio_sync(
        self,
        audio_bytes: bytes,
        filename: str = "audio.wav",
        language: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Synchronous transcription using Groq Whisper-large-v3-turbo."""
        if not self.is_available() or len(audio_bytes) < 100:
            return None

        data = {
            "model": self.whisper_model,
            "response_format": "verbose_json",
            "temperature": "0.0",
        }
        if language and language != "auto":
            data["language"] = language.split("-")[0]

        files = {"file": (filename, audio_bytes, "audio/wav")}
        headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}"}

        try:
            with httpx.Client(timeout=12.0) as client:
                resp = client.post(
                    f"{GROQ_BASE_URL}/audio/transcriptions",
                    headers=headers,
                    data=data,
                    files=files,
                )
                if resp.status_code == 200:
                    res_json = resp.json()
                    text = res_json.get("text", "").strip()
                    return {
                        "text": text,
                        "confidence": 0.95,
                        "language": res_json.get("language", language or "en"),
                    }
        except Exception as e:
            logger.warning(f"Groq transcribe_audio_sync error: {e}")
        return None


# Global singleton
groq_service = GroqService()
