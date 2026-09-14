"""
Audio Processing Service for SupportAI.
Handles:
- Audio normalization to 16 kHz, 16-bit, mono PCM
- Voice Activity Detection (VAD) for speech start / ongoing / stop
- Low audio volume detection (< conversational threshold)
- Noise thresholding
"""

import math
import struct
import logging
from typing import Dict, Any, Tuple, Optional

logger = logging.getLogger(__name__)

TARGET_SAMPLE_RATE = 16000
SAMPLE_WIDTH = 2  # 16-bit = 2 bytes
CHANNELS = 1      # Mono

class AudioProcessingService:
    def __init__(self):
        # VAD Energy Thresholds
        self.speech_energy_threshold = 300.0  # RMS threshold for speech
        self.silence_energy_threshold = 150.0 # RMS threshold for silence
        self.low_volume_warning_threshold = 120.0

    def calculate_rms(self, pcm_bytes: bytes) -> float:
        """Calculate Root Mean Square (RMS) volume of 16-bit PCM audio."""
        if not pcm_bytes:
            return 0.0

        sample_count = len(pcm_bytes) // SAMPLE_WIDTH
        if sample_count == 0:
            return 0.0

        try:
            samples = struct.unpack(f"{sample_count}h", pcm_bytes[:sample_count * SAMPLE_WIDTH])
            sum_squares = sum(s * s for s in samples)
            return math.sqrt(sum_squares / sample_count)
        except Exception as e:
            logger.debug(f"Error calculating RMS: {e}")
            return 0.0

    def detect_voice_activity(self, pcm_bytes: bytes) -> Dict[str, Any]:
        """
        Determines Voice Activity (VAD) from raw PCM bytes.
        Returns:
            {
                "has_speech": bool,
                "is_silence": bool,
                "is_low_volume": bool,
                "rms": float,
                "volume_percentage": int (0-100)
            }
        """
        rms = self.calculate_rms(pcm_bytes)

        # Scale RMS (approx 0-15000 max conversational) to 0-100%
        volume_pct = min(100, max(0, int((rms / 2500.0) * 100)))

        has_speech = rms >= self.speech_energy_threshold
        is_silence = rms <= self.silence_energy_threshold
        is_low_volume = (0 < rms < self.low_volume_warning_threshold)

        return {
            "has_speech": has_speech,
            "is_silence": is_silence,
            "is_low_volume": is_low_volume,
            "rms": round(rms, 2),
            "volume_percentage": volume_pct,
        }

    def validate_pcm_chunk(self, chunk: bytes) -> Tuple[bool, Optional[str]]:
        """Validate incoming audio chunk integrity."""
        if not chunk:
            return False, "Empty audio chunk"
        if len(chunk) % SAMPLE_WIDTH != 0:
            return False, "Audio chunk length not aligned to 16-bit boundaries"
        return True, None

# Singleton export
audio_service = AudioProcessingService()
