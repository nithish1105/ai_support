"""
In-process test suite for SupportAI Live Voice Support System.
Tests full pipeline using FastAPI TestClient & ASGI:
1. REST API endpoints (/health, /api/auth/login, /api/tickets, /api/voice/*)
2. Database models (VoiceSession, VoiceTranscript)
3. Speech-to-Text service (Whisper / fallback, vocabulary boost, transcript cleaning)
4. Audio Processing service (VAD energy, volume calculation)
5. Text-to-Speech service (Spoken response formatting)
6. Voice AI Service (Context memory, barge-in, low confidence repetition, human escalation)
7. WebSocket Voice Gateway (/ws/voice/{ticket_id}) logic & event dispatching
"""

import asyncio
import json
import base64
from fastapi.testclient import TestClient
from app.main import app
from app.database.database import AsyncSessionLocal
from app.models.ticket import Ticket, TicketStatus
from app.models.voice import VoiceSession, VoiceTranscript, VoiceSessionStatus, VoiceSpeakerType
from app.services.speech_to_text_service import stt_service
from app.services.text_to_speech_service import tts_service
from app.services.audio_processing_service import audio_service
from app.services.voice_ai_service import voice_ai_service
from app.services.voice_session_service import voice_session_service
from sqlalchemy import select

def run_tests():
    print("=== STARTING IN-PROCESS LIVE AI VOICE SUPPORT TEST SUITE ===")
    client = TestClient(app)

    # 1. Test Health endpoint
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("✅ 1. Health check passed (200 OK)")

    # 2. Test Customer Authentication
    login_res = client.post("/api/auth/login", json={
        "email": "sarah@demo.com",
        "password": "customer123",
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ 2. Customer authentication passed")

    # 3. Test Ticket Creation
    ticket_res = client.post("/api/tickets", headers=headers, json={
        "title": "Broadband Fiber Offline",
        "description": "My fiber internet stopped working this morning.",
        "category": "Internet Problem",
    })
    assert ticket_res.status_code == 201, f"Ticket creation failed: {ticket_res.text}"
    ticket = ticket_res.json()
    ticket_id = ticket["id"]
    token_str = ticket["public_token"]
    print(f"✅ 3. Ticket created: ID={ticket_id}, Token={token_str}")

    # 4. Test Voice REST API: Start Session
    session_res = client.post("/api/voice/session", headers=headers, json={
        "ticket_id": ticket_id,
        "language": "en-IN",
    })
    assert session_res.status_code == 200, f"Voice session start failed: {session_res.text}"
    session = session_res.json()
    session_id = session["id"]
    assert session["status"] == "ACTIVE"
    print(f"✅ 4. Voice REST session created: ID={session_id}, Language={session['language']}")

    # 5. Test Audio Processing Service (VAD and volume calculation)
    silent_pcm = b"\x00\x00" * 320
    vad_silent = audio_service.detect_voice_activity(silent_pcm)
    assert vad_silent["is_silence"] is True
    assert vad_silent["has_speech"] is False
    print(f"✅ 5a. VAD silence detection verified: rms={vad_silent['rms']}, has_speech={vad_silent['has_speech']}")

    # Test speech audio energy (synthetic 440Hz sine wave PCM)
    import math, struct
    sample_rate = 16000
    freq = 440.0
    synth_samples = [int(3000 * math.sin(2 * math.pi * freq * i / sample_rate)) for i in range(1600)]
    synth_pcm = struct.pack(f"{len(synth_samples)}h", *synth_samples)
    vad_speech = audio_service.detect_voice_activity(synth_pcm)
    assert vad_speech["has_speech"] is True
    assert vad_speech["volume_percentage"] > 20
    print(f"✅ 5b. VAD speech detection verified: rms={vad_speech['rms']}, volume={vad_speech['volume_percentage']}%")

    # 6. Test Speech-to-Text Service: Transcript Cleaning & Vocabulary Protection
    raw_stt = "uh um my my internet is not working with the router and token SUP-2026-X7K2P9"
    cleaned_stt = stt_service.clean_transcript(raw_stt)
    assert "SUP-2026-X7K2P9" in cleaned_stt
    assert "router" in cleaned_stt
    assert "uh" not in cleaned_stt
    assert "um" not in cleaned_stt
    print(f"✅ 6. Transcript cleaning & token protection verified:\n   Raw: '{raw_stt}'\n   Clean: '{cleaned_stt}'")

    # 7. Test Text-to-Speech Service: Formatting concise vocal responses
    markdown_response = "**Step 1:** Please restart your router by unplugging the power cable for 10 seconds. • Check if lights turn green. For more details visit https://support.example.com."
    spoken_formatted = tts_service.format_for_speech(markdown_response)
    assert "**" not in spoken_formatted
    assert "•" not in spoken_formatted
    assert "https" not in spoken_formatted
    assert "First," in spoken_formatted
    print(f"✅ 7. TTS voice formatting verified:\n   Spoken: '{spoken_formatted}'")

    # 8. Test Voice AI Service: Multi-Turn Conversation Context Memory
    # Scenario: Customer states router restart was already attempted
    ai_result = voice_ai_service.process_customer_voice(
        transcript="My internet stopped working and I already restarted the router.",
        confidence=0.95,
        ticket_title="Broadband Fiber Offline",
        ticket_description="My fiber internet stopped working this morning.",
        conversation_history=[],
        ai_attempt_count=0,
        failed_solutions=[],
    )
    assert ai_result["is_escalation"] is False
    # AI must recognize restart was already done and suggest WAN cable or Step 2
    assert "cable" in ai_result["spoken_response"].lower() or "indicator" in ai_result["spoken_response"].lower() or "restart" not in ai_result["spoken_response"].lower()
    print(f"✅ 8. Voice AI conversation context memory verified:\n   AI Spoken Response: '{ai_result['spoken_response']}'")

    # 9. Test Low Confidence Clarification (Requirement 73 Test 6)
    low_conf_result = voice_ai_service.process_customer_voice(
        transcript="bzzt",
        confidence=0.30,
        ticket_title="Broadband Fiber Offline",
        ticket_description="",
        conversation_history=[],
        ai_attempt_count=0,
        failed_solutions=[],
    )
    assert low_conf_result["is_low_confidence"] is True
    assert "repeat" in low_conf_result["spoken_response"].lower() or "clearly" in low_conf_result["spoken_response"].lower()
    print(f"✅ 9. Low confidence speech repetition verified:\n   Response: '{low_conf_result['spoken_response']}'")

    # 10. Test Voice Human Escalation Detection (Requirement 73 Test 4)
    escalate_result = voice_ai_service.process_customer_voice(
        transcript="I want to talk to a human support agent.",
        confidence=0.98,
        ticket_title="Broadband Fiber Offline",
        ticket_description="",
        conversation_history=[],
        ai_attempt_count=1,
        failed_solutions=["Router restart"],
    )
    assert escalate_result["is_escalation"] is True
    assert "human" in escalate_result["spoken_response"].lower()
    print(f"✅ 10. Human escalation detection verified:\n   Response: '{escalate_result['spoken_response']}'")

    # 11. Test WebSocket /ws/voice/{ticket_id} via TestClient
    with client.websocket_connect(f"/ws/voice/{ticket_id}?token={token}") as ws:
        # Connected event
        msg_init = ws.receive_json()
        assert msg_init["type"] == "connected"
        print("✅ 11a. WebSocket /ws/voice connected")

        # voice_start event
        ws.send_json({
            "type": "voice_start",
            "ticket_id": ticket_id,
            "language": "en-IN",
        })
        v_start = ws.receive_json()
        assert v_start["type"] == "voice_start"
        print(f"✅ 11b. WebSocket voice_start acknowledged: session_id={v_start['session_id']}")

        # audio_chunk event
        ws.send_json({
            "type": "audio_chunk",
            "data": base64.b64encode(synth_pcm).decode("utf-8"),
        })
        v_vad = ws.receive_json()
        assert v_vad["type"] == "vad_status"
        print(f"✅ 11c. WebSocket VAD audio chunk processed: has_speech={v_vad['has_speech']}")

        # speech_start (barge-in interruption)
        ws.send_json({"type": "speech_start", "speaker": "customer"})
        v_spk = ws.receive_json()
        assert v_spk["type"] == "speech_start"
        print("✅ 11d. WebSocket speech_start event processed")

        # partial_transcript
        ws.send_json({"type": "partial_transcript", "text": "my internet is down"})
        # Final transcript
        ws.send_json({
            "type": "final_transcript",
            "text": "My internet is down and router is restarting.",
            "confidence": 0.94,
        })

        # Receive customer broadcast
        cust_msg = ws.receive_json()
        assert cust_msg["type"] == "final_transcript"
        assert cust_msg["text"] == "My internet is down and router is restarting."

        # Receive thinking indicator
        think_on = ws.receive_json()
        assert think_on["type"] == "ai_thinking" and think_on["is_thinking"]

        think_off = ws.receive_json()
        assert think_off["type"] == "ai_thinking" and not think_off["is_thinking"]

        # Receive AI response
        ai_resp = ws.receive_json()
        assert ai_resp["type"] == "ai_response"
        assert len(ai_resp["spoken_text"]) > 0
        print(f"✅ 11e. WebSocket final_transcript -> AI response received:\n   '{ai_resp['spoken_text']}'")

        # interrupt event (customer clicks Speak Now / barge-in)
        ws.send_json({"type": "interrupt"})
        int_resp = ws.receive_json()
        assert int_resp["type"] == "ai_interrupted"
        print("✅ 11f. Customer barge-in / interrupt event confirmed")

        # call_end event
        ws.send_json({
            "type": "call_end",
            "ticket_id": ticket_id,
            "session_id": session_id,
            "duration": 48,
        })
        end_resp = ws.receive_json()
        assert end_resp["type"] == "call_end"
        print(f"✅ 11g. WebSocket call_end processed (duration: {end_resp['duration']}s)")

    # 12. Verify Transcripts persisted in DB via GET /api/voice/transcript/{ticket_id}
    trans_res = client.get(f"/api/voice/transcript/{ticket_id}", headers=headers)
    assert trans_res.status_code == 200
    trans_data = trans_res.json()
    assert len(trans_data) >= 2
    print(f"✅ 12. Database transcripts verified via REST: {len(trans_data)} entries stored")

    # 13. End voice session via REST
    end_res = client.post(f"/api/voice/session/{session_id}/end", headers=headers, json={"metrics": {"stt_latency": 180}})
    assert end_res.status_code == 200
    assert end_res.json()["status"] == "ENDED"
    print("✅ 13. Voice session ended via REST (status: ENDED)")

    print("\n🎉 ALL 13 TEST SUITES PASSED WITH 100% SUCCESS! 🎉\n")

if __name__ == "__main__":
    run_tests()
