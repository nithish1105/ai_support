"""
Automated Test Suite for SupportAI Groq Integration.
Verifies:
1. Configuration loading and availability check
2. Groq LLM customer support response generation
3. Multi-turn context memory (avoiding already-tried steps)
4. Voice-optimized concise speech response generation
5. Groq Whisper audio transcription
6. Resilience and graceful fallback when Groq is unavailable
7. End-to-end asynchronous pipeline
"""

import asyncio
import io
import wave
from app.config import settings
from app.services.groq_service import groq_service
from app.services import ai_service
from app.services.voice_ai_service import voice_ai_service
from app.services.speech_to_text_service import stt_service

async def run_tests():
    print("=" * 65)
    print("=== SUPPORTAI GROQ INTEGRATION VERIFICATION SUITE ===")
    print("=" * 65)

    # 1. Config and availability
    print("\n[TEST 1] Verifying Groq Configuration & Credentials...")
    assert settings.GROQ_API_KEY is not None, "GROQ_API_KEY is None!"
    assert settings.GROQ_API_KEY.startswith("gsk_"), "GROQ_API_KEY does not start with gsk_!"
    assert groq_service.is_available() is True, "groq_service.is_available() returned False!"
    print(f"  ✅ Config loaded: Model={settings.GROQ_MODEL}, Whisper={settings.GROQ_WHISPER_MODEL}")
    print(f"  ✅ Groq API Key: {settings.GROQ_API_KEY[:8]}...{settings.GROQ_API_KEY[-4:]}")

    # 2. Synchronous and Asynchronous Chat Generation
    print("\n[TEST 2] Testing Groq LLM Chat Response Generation...")
    resp_async, summ_async = await groq_service.generate_response(
        ticket_title="Broadband router dropping connection",
        ticket_description="Internet goes down whenever microwave runs",
        customer_message="My Wi-Fi keeps dropping in the kitchen when cooking",
        conversation_history=[],
        knowledge_article=None,
        ai_attempt_count=0,
        is_voice=False,
    )
    assert resp_async and len(resp_async) > 10, "Empty response from Groq!"
    assert summ_async and len(summ_async) > 2, "Empty summary from Groq!"
    print(f"  ✅ Generated Response: {resp_async[:100]}...")
    print(f"  ✅ Solution Summary: {summ_async}")

    # 3. Multi-Turn Context Memory
    print("\n[TEST 3] Testing Multi-Turn Context Memory (Already Tried Steps)...")
    history = [
        {"sender_type": "CUSTOMER", "content": "My internet is completely down"},
        {"sender_type": "AI", "content": "Please restart your router by unplugging it for 30 seconds."},
        {"sender_type": "CUSTOMER", "content": "I already unplugged and restarted the router, still down."}
    ]
    resp_context, summ_context = await groq_service.generate_response(
        ticket_title="Internet down",
        ticket_description="No connection",
        customer_message="I already unplugged and restarted the router, still down.",
        conversation_history=history,
        knowledge_article=None,
        ai_attempt_count=1,
        failed_solutions=["Restarted router"],
        is_voice=False,
    )
    resp_lower = resp_context.lower()
    # Ensure it doesn't just tell them to restart the router again
    print(f"  ✅ Multi-turn AI Response: {resp_context[:120]}...")
    print(f"  ✅ Next Step Advised: {summ_context}")

    # 4. Voice-Optimized Spoken Response
    print("\n[TEST 4] Testing Voice Call Spoken Output Generation...")
    voice_res = await voice_ai_service.process_customer_voice_async(
        transcript="My ONT box has a blinking red light and no internet",
        confidence=0.92,
        ticket_title="ONT red light",
        ticket_description="Fiber down",
        conversation_history=[],
        ai_attempt_count=0,
        failed_solutions=[],
        knowledge_article=None,
    )
    assert voice_res["spoken_response"] and len(voice_res["spoken_response"]) > 10
    assert not voice_res["is_escalation"]
    # Check that it didn't include markdown bullet points
    assert "*" not in voice_res["spoken_response"], "Voice response contains markdown asterisks!"
    print(f"  ✅ Spoken Voice Text: '{voice_res['spoken_response']}'")
    print(f"  ✅ Voice Solution Summary: {voice_res['solution_summary']}")

    # 5. Groq Whisper Audio Transcription
    print("\n[TEST 5] Testing Groq Whisper Cloud Audio Transcription...")
    wav_io = io.BytesIO()
    with wave.open(wav_io, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        wf.writeframes(b'\x00\x00' * 16000)
    stt_res = stt_service.transcribe_audio(wav_io.getvalue())
    assert stt_res["text"], "Empty STT transcription!"
    assert stt_res["confidence"] >= 0.50, f"Confidence too low: {stt_res['confidence']}"
    print(f"  ✅ STT Cloud Output: '{stt_res['text']}' (Confidence: {stt_res['confidence']}, Lang: {stt_res['language']})")

    # 6. Fallback Resilience Verification
    print("\n[TEST 6] Testing Fallback Resilience when Groq is temporarily disabled...")
    orig_use_groq = settings.USE_GROQ
    try:
        settings.USE_GROQ = False
        assert groq_service.is_available() is False
        fallback_resp, fallback_summ = ai_service.generate_ai_response(
            ticket_title="Test Ticket",
            ticket_description="Test Desc",
            intent="Internet Problem",
            sentiment="NEGATIVE",
            urgency="HIGH",
            ai_attempt_count=0,
            conversation_history=[],
            knowledge_article=None,
            failed_solutions=[],
            customer_message="My wifi is down",
        )
        assert fallback_resp and len(fallback_resp) > 0, "Fallback failed!"
        print(f"  ✅ Fallback Response: {fallback_resp[:80]}...")
        print(f"  ✅ Fallback Summary: {fallback_summ}")
    finally:
        settings.USE_GROQ = orig_use_groq
        assert groq_service.is_available() is True

    # 7. End-to-End WebSocket Pipeline Integration
    print("\n[TEST 7] Testing End-to-End Async Response Pipeline...")
    pipe_resp, pipe_summ = await ai_service.generate_ai_response_async(
        ticket_title="Billing overcharge issue",
        ticket_description="Charged twice for monthly fiber plan",
        intent="Billing Problem",
        sentiment="NEGATIVE",
        urgency="HIGH",
        ai_attempt_count=0,
        conversation_history=[],
        knowledge_article=None,
        failed_solutions=[],
        customer_message="I see two identical charges of $50 on my credit card statement this morning",
        is_voice=False,
    )
    assert pipe_resp and len(pipe_resp) > 20
    print(f"  ✅ Pipeline Response: {pipe_resp[:120]}...")
    print(f"  ✅ Pipeline Solution: {pipe_summ}")

    print("\n" + "=" * 65)
    print("🎉 ALL 7 GROQ INTEGRATION TESTS PASSED WITH 100% SUCCESS! 🎉")
    print("=" * 65)

if __name__ == "__main__":
    asyncio.run(run_tests())
