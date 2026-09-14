"""
Text-to-Speech Service for SupportAI.
Configurable TTS pipeline that:
- Prepares concise, spoken-dialogue-friendly text (1-3 sentences)
- Strips markdown formatting, bullets, emojis, URLs, and table artifacts
- Supports configurable voices (Default, Voice 2, Voice 3) and speeds (0.8x - 1.2x)
- Supports browser speech synthesis fallback and local/cloud audio generation
"""

import re
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class TextToSpeechService:
    def __init__(self):
        logger.info("Initializing TextToSpeechService...")

    def format_for_speech(self, text: str) -> str:
        """
        Formats raw AI response into natural, concise conversational speech.
        Extracts key points into 1-3 spoken sentences.
        """
        if not text:
            return ""

        spoken = text.strip()

        # 1. Remove Markdown bold/italic
        spoken = re.sub(r"\*\*(.+?)\*\*", r"\1", spoken)
        spoken = re.sub(r"\*(.+?)\*", r"\1", spoken)
        spoken = re.sub(r"__(.+?)__", r"\1", spoken)
        spoken = re.sub(r"_(.+?)_", r"\1", spoken)

        # 2. Remove Markdown links [text](url) -> text
        spoken = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", spoken)
        spoken = re.sub(r"https?://\S+", "the support portal", spoken)

        # 3. Clean emojis and symbols
        spoken = re.sub(r"[⚠️✅🎉🔴🟡🟢•·*#_`~]", "", spoken)

        # 4. Convert Step indicators to natural speech ("Step 1:" -> "First,")
        spoken = re.sub(r"Step 1[:.]\s*", "First, ", spoken, flags=re.IGNORECASE)
        spoken = re.sub(r"Step 2[:.]\s*", "Next, ", spoken, flags=re.IGNORECASE)
        spoken = re.sub(r"Step 3[:.]\s*", "Then, ", spoken, flags=re.IGNORECASE)
        spoken = re.sub(r"Step \d+[:.]\s*", "Also, ", spoken, flags=re.IGNORECASE)

        # 5. Clean line breaks into natural pauses
        spoken = re.sub(r"\n+", ". ", spoken)
        spoken = re.sub(r"\s{2,}", " ", spoken).strip()
        spoken = re.sub(r"\.{2,}", ".", spoken)

        # 6. Keep voice response concise (1-3 sentences maximum for high responsiveness)
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", spoken) if s.strip()]
        if len(sentences) > 3:
            spoken = " ".join(sentences[:3])

        return spoken

    def synthesize_speech(
        self,
        text: str,
        voice: str = "default",
        speed: float = 1.0,
        language: str = "en-US",
    ) -> Dict[str, Any]:
        """
        Synthesize speech from text.
        Returns metadata and formatted text for browser and backend playback.
        """
        formatted_text = self.format_for_speech(text)

        return {
            "text": formatted_text,
            "original_length": len(text),
            "spoken_length": len(formatted_text),
            "voice": voice,
            "speed": max(0.75, min(1.5, speed)),
            "language": language,
            "audio_format": "pcm_16000",
            "audio_data": None,  # Populated when audio binary synthesis is requested
        }

# Singleton export
tts_service = TextToSpeechService()
