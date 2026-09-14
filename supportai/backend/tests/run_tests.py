import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from tests.test_auth import (
    test_password_hashing,
    test_jwt_token_generation_and_decoding,
    test_support_token_format,
)
from tests.test_ai_service import (
    test_sentiment_analysis_negative,
    test_sentiment_analysis_positive,
    test_intent_classification,
    test_urgency_detection,
    test_explicit_human_request_escalation,
    test_frustration_escalation_accumulation,
    test_ai_solution_generation_first_attempt,
    test_handoff_summary_generation,
    test_copilot_generation,
)
from tests.test_tickets import (
    test_ticket_status_enums,
    test_ticket_categories,
)

def run():
    tests = [
        ("test_password_hashing", test_password_hashing),
        ("test_jwt_token_generation_and_decoding", test_jwt_token_generation_and_decoding),
        ("test_support_token_format", test_support_token_format),
        ("test_sentiment_analysis_negative", test_sentiment_analysis_negative),
        ("test_sentiment_analysis_positive", test_sentiment_analysis_positive),
        ("test_intent_classification", test_intent_classification),
        ("test_urgency_detection", test_urgency_detection),
        ("test_explicit_human_request_escalation", test_explicit_human_request_escalation),
        ("test_frustration_escalation_accumulation", test_frustration_escalation_accumulation),
        ("test_ai_solution_generation_first_attempt", test_ai_solution_generation_first_attempt),
        ("test_handoff_summary_generation", test_handoff_summary_generation),
        ("test_copilot_generation", test_copilot_generation),
        ("test_ticket_status_enums", test_ticket_status_enums),
        ("test_ticket_categories", test_ticket_categories),
    ]

    passed = 0
    failed = 0

    print("========================================")
    print("      SupportAI Test Suite Runner       ")
    print("========================================")

    for name, fn in tests:
        try:
            fn()
            print(f"  ✓ [PASS] {name}")
            passed += 1
        except Exception as e:
            print(f"  ✗ [FAIL] {name}: {e}")
            failed += 1

    print("----------------------------------------")
    print(f"Results: {passed} passed, {failed} failed, {len(tests)} total")
    print("========================================")

    if failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    run()
