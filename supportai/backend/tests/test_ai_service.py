from app.services.ai_service import (
    analyze_sentiment,
    classify_intent,
    detect_urgency,
    detect_escalation_risk,
    generate_ai_response,
    generate_handoff_summary,
    generate_agent_copilot,
)

def test_sentiment_analysis_negative():
    result = analyze_sentiment("My internet is completely broken and nothing works. I am very angry!")
    assert result["label"] == "NEGATIVE"
    assert result["score"] > 0.5

def test_sentiment_analysis_positive():
    result = analyze_sentiment("Thank you so much, everything is solved and working great now!")
    assert result["label"] == "POSITIVE"
    assert result["score"] > 0.5

def test_intent_classification():
    result = classify_intent("My router wifi is disconnected and red light is flashing")
    assert result["label"] == "Internet Problem"

    billing_result = classify_intent("I was double charged on my invoice this month")
    assert billing_result["label"] in ["Billing Problem", "Payment Problem"]

def test_urgency_detection():
    result = detect_urgency("Urgent emergency, I cannot access my account and need it immediately", sentiment="NEGATIVE")
    assert result["label"] in ["HIGH", "CRITICAL"]

def test_explicit_human_request_escalation():
    result = detect_escalation_risk("I want to speak to a human agent please")
    assert result["level"] == "CRITICAL"
    assert result["human_requested"] is True
    assert result["score"] >= 80

def test_frustration_escalation_accumulation():
    result = detect_escalation_risk(
        "Still not working, this is ridiculous and wasted my time",
        sentiment="NEGATIVE",
        urgency="HIGH",
        ai_attempt_count=2,
        failed_solutions=2
    )
    assert result["score"] > 60

def test_ai_solution_generation_first_attempt():
    response, summary = generate_ai_response(
        ticket_title="Internet Not Working",
        ticket_description="My connection dropped",
        intent="Internet Problem",
        sentiment="NEGATIVE",
        urgency="HIGH",
        ai_attempt_count=0,
        conversation_history=[],
        knowledge_article=None,
        failed_solutions=[],
        customer_message="My connection dropped",
    )
    assert "router" in response.lower() or "internet" in response.lower()
    assert summary is not None

def test_handoff_summary_generation():
    summary = generate_handoff_summary(
        ticket_title="Wifi Down",
        customer_name="Sarah Johnson",
        latest_analysis={
            "sentiment_label": "NEGATIVE",
            "intent_label": "Internet Problem",
            "urgency_label": "HIGH",
            "escalation_risk_level": "CRITICAL",
            "escalation_risk_score": 92.0,
            "recommended_action": "Check area outage",
        },
        solution_attempts=[
            {"attempt_number": 1, "solution_summary": "Restart router", "result": "FAILED"},
            {"attempt_number": 2, "solution_summary": "Check cable", "result": "FAILED"},
        ],
        last_customer_message="Still not working",
    )
    assert "Sarah Johnson" in summary
    assert "AI Handoff Summary" in summary
    assert "Restart router" in summary

def test_copilot_generation():
    copilot = generate_agent_copilot(
        customer_name="Sarah Johnson",
        sentiment="NEGATIVE",
        intent="Internet Problem",
        urgency="HIGH",
        last_customer_message="Still not working",
        solution_attempts=[],
        knowledge_article={"title": "Internet Troubleshooting", "solution": "Check WAN"},
    )
    assert "frustrated" in copilot["mood_comment"]
    assert "suggested_response" in copilot
    assert "next_action" in copilot
