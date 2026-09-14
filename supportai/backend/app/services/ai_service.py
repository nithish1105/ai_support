"""
AI Service — Sentiment, Intent, Urgency, Escalation Risk, Solution Generation
Uses HuggingFace models with rule-based fallback for reliability.
Models are loaded once at startup.
"""
import re
import json
import logging
from typing import Optional, List, Dict, Any, Tuple
from app.config import settings

logger = logging.getLogger(__name__)

# Global model holders — loaded once at startup
_sentiment_pipeline = None
_zero_shot_pipeline = None
_models_loaded = False
_models_failed = False


def load_models():
    """Load AI models once at application startup."""
    global _sentiment_pipeline, _zero_shot_pipeline, _models_loaded, _models_failed

    if _models_loaded or _models_failed:
        return

    if not settings.USE_AI_MODELS:
        logger.info("AI models disabled — using rule-based fallback only")
        _models_failed = True
        return

    try:
        from transformers import pipeline
        logger.info("Loading sentiment model...")
        _sentiment_pipeline = pipeline(
            "sentiment-analysis",
            model=settings.SENTIMENT_MODEL,
            truncation=True,
            max_length=512,
        )
        logger.info("Sentiment model loaded.")

        logger.info("Loading zero-shot model...")
        _zero_shot_pipeline = pipeline(
            "zero-shot-classification",
            model=settings.ZERO_SHOT_MODEL,
            truncation=True,
        )
        logger.info("Zero-shot model loaded.")
        _models_loaded = True
        logger.info("All AI models loaded successfully.")
    except Exception as e:
        logger.warning(f"Failed to load AI models: {e}. Using rule-based fallback.")
        _models_failed = True


# ──────────────────────────────────────────────
# SENTIMENT ANALYSIS
# ──────────────────────────────────────────────

NEGATIVE_KEYWORDS = [
    "not working", "broken", "failed", "error", "issue", "problem", "angry",
    "frustrated", "terrible", "awful", "worst", "useless", "ridiculous",
    "still not", "doesn't work", "doesn't", "can't", "cannot", "won't",
    "refuse", "demand", "unacceptable", "horrible", "hate", "disgusting",
    "pathetic", "incompetent", "never works", "already tried", "again",
    "keep failing", "wasted", "disappointed", "upset", "annoyed"
]

POSITIVE_KEYWORDS = [
    "thank", "thanks", "great", "excellent", "perfect", "solved", "fixed",
    "working now", "resolved", "appreciate", "helpful", "good", "amazing",
    "wonderful", "happy", "satisfied", "pleased"
]


def analyze_sentiment(text: str) -> Dict[str, Any]:
    """Analyze sentiment using ML model or rule-based fallback."""
    if _sentiment_pipeline and _models_loaded:
        try:
            result = _sentiment_pipeline(text[:512])[0]
            label = result["label"]  # POSITIVE or NEGATIVE
            score = result["score"]

            # Map to our 3-class system
            if label == "NEGATIVE" and score > 0.8:
                sentiment = "NEGATIVE"
            elif label == "NEGATIVE" and score > 0.5:
                sentiment = "NEGATIVE"
            elif label == "POSITIVE" and score > 0.7:
                sentiment = "POSITIVE"
            else:
                sentiment = "NEUTRAL"

            return {"label": sentiment, "score": round(score, 3)}
        except Exception as e:
            logger.warning(f"Sentiment model failed: {e}")

    # Rule-based fallback
    text_lower = text.lower()
    neg_count = sum(1 for kw in NEGATIVE_KEYWORDS if kw in text_lower)
    pos_count = sum(1 for kw in POSITIVE_KEYWORDS if kw in text_lower)

    if neg_count > pos_count:
        score = min(0.95, 0.6 + neg_count * 0.08)
        return {"label": "NEGATIVE", "score": round(score, 3)}
    elif pos_count > neg_count:
        score = min(0.95, 0.6 + pos_count * 0.08)
        return {"label": "POSITIVE", "score": round(score, 3)}
    else:
        return {"label": "NEUTRAL", "score": 0.6}


# ──────────────────────────────────────────────
# INTENT CLASSIFICATION
# ──────────────────────────────────────────────

INTENT_LABELS = [
    "Technical Issue",
    "Internet Problem",
    "Billing Problem",
    "Payment Problem",
    "Refund Request",
    "Account Problem",
    "Password Reset",
    "Order Issue",
    "Delivery Problem",
    "Subscription",
    "Cancellation",
    "Product Information",
    "Complaint",
    "Feedback",
    "Other",
]

INTENT_KEYWORD_MAP = {
    "Internet Problem": [
        "internet", "connection", "wifi", "wi-fi", "wi fi", "network", "router",
        "broadband", "online", "offline", "disconnected", "no internet", "not connecting",
        "slow internet", "slow connection", "dropping", "keeps disconnecting", "no signal",
        "ethernet", "modem", "dns", "ip address", "timeout", "cannot connect",
    ],
    "Billing Problem": [
        "bill", "billing", "invoice", "charge", "charged", "overcharged", "statement",
        "incorrect charge", "wrong amount", "double charge", "extra charge",
    ],
    "Payment Problem": [
        "payment", "pay", "transaction", "deducted", "debit", "credit card", "paid",
        "payment failed", "payment not going through", "card declined", "declined",
        "not processing", "unable to pay",
    ],
    "Refund Request": [
        "refund", "money back", "return", "reimburse", "reimbursement",
        "get my money", "credit back", "reverse charge",
    ],
    "Account Problem": [
        "account", "login", "locked", "access", "sign in", "profile", "blocked",
        "cannot access", "account suspended", "account blocked", "account locked",
        "cannot log in", "log in problem", "sign in problem",
    ],
    "Password Reset": [
        "password", "forgot password", "reset password", "can't login", "cannot login",
        "reset", "change password", "forgot my password", "lost password",
    ],
    "Order Issue": [
        "order", "purchase", "bought", "tracking", "package", "item", "product",
        "wrong item", "missing item", "damaged", "order not received",
    ],
    "Delivery Problem": [
        "delivery", "delivered", "not delivered", "late delivery", "lost parcel",
        "delayed", "shipping", "courier", "dispatch", "not arrived", "where is my order",
    ],
    "Cancellation": [
        "cancel", "cancellation", "unsubscribe", "terminate", "end service",
        "stop subscription", "discontinue", "close account",
    ],
    "Complaint": [
        "complaint", "complain", "speak to manager", "supervisor", "escalate",
        "unacceptable", "ridiculous", "terrible service", "poor service",
        "worst", "unhappy", "dissatisfied",
    ],
    "Technical Issue": [
        "not working", "error", "broken", "crash", "crashing", "slow", "bug",
        "glitch", "technical", "problem with app", "app not working",
        "software issue", "not loading", "keeps crashing", "freezing", "frozen",
        "blank screen", "not responding",
    ],
    "Subscription": [
        "subscription", "plan", "upgrade", "downgrade", "monthly", "renewal",
        "subscribe", "membership", "premium", "free trial",
    ],
    "Service Outage": [
        "outage", "down", "service down", "not available", "system down",
        "maintenance", "unavailable", "cannot access service", "completely down",
    ],
}



def classify_intent(text: str) -> Dict[str, Any]:
    """Classify user intent using zero-shot model or rule-based fallback."""
    if _zero_shot_pipeline and _models_loaded:
        try:
            result = _zero_shot_pipeline(
                text[:512],
                candidate_labels=INTENT_LABELS,
            )
            label = result["labels"][0]
            score = result["scores"][0]
            return {"label": label, "score": round(score, 3)}
        except Exception as e:
            logger.warning(f"Zero-shot model failed: {e}")

    # Rule-based fallback
    text_lower = text.lower()
    scores = {}
    for intent, keywords in INTENT_KEYWORD_MAP.items():
        count = sum(1 for kw in keywords if kw in text_lower)
        if count > 0:
            scores[intent] = count

    if scores:
        best = max(scores, key=scores.get)
        score = min(0.95, 0.6 + scores[best] * 0.1)
        return {"label": best, "score": round(score, 3)}
    return {"label": "Other", "score": 0.5}


# ──────────────────────────────────────────────
# URGENCY DETECTION
# ──────────────────────────────────────────────

CRITICAL_URGENCY = ["urgent", "emergency", "critical", "immediately", "asap", "right now", "cannot wait"]
HIGH_URGENCY = ["important", "serious", "need help", "still not working", "three times", "multiple times",
                "hours", "days", "week", "not resolved", "frustrated", "angry", "always", "again"]
LOW_URGENCY = ["when you can", "no rush", "wondering", "curious", "question", "information"]


def detect_urgency(text: str, sentiment: str = "NEUTRAL", intent: str = "Other") -> Dict[str, Any]:
    """Detect urgency level from text content."""
    text_lower = text.lower()

    crit_count = sum(1 for kw in CRITICAL_URGENCY if kw in text_lower)
    high_count = sum(1 for kw in HIGH_URGENCY if kw in text_lower)
    low_count = sum(1 for kw in LOW_URGENCY if kw in text_lower)

    # Sentiment boost
    if sentiment == "NEGATIVE":
        high_count += 1

    # Intent boost
    if intent in ["Complaint", "Internet Problem", "Account Problem", "Payment Problem"]:
        high_count += 1

    if crit_count >= 1:
        return {"label": "CRITICAL", "score": round(min(0.99, 0.8 + crit_count * 0.05), 3)}
    elif high_count >= 2:
        return {"label": "HIGH", "score": round(min(0.90, 0.65 + high_count * 0.05), 3)}
    elif high_count == 1:
        return {"label": "MEDIUM", "score": 0.65}
    elif low_count > 0:
        return {"label": "LOW", "score": 0.7}
    else:
        return {"label": "MEDIUM", "score": 0.55}


# ──────────────────────────────────────────────
# ESCALATION RISK
# ──────────────────────────────────────────────

HUMAN_REQUEST_PATTERNS = [
    r"(i want|i need|connect me|speak|talk|chat).*(human|agent|person|representative|manager|supervisor|support staff)",
    r"(human|agent|person|representative|manager|supervisor)",
    r"i want (a|to speak to a) (human|manager|supervisor|agent)",
    r"get me a (human|manager|supervisor|agent)",
    r"transfer me",
    r"speak to someone",
    r"real person",
]

FRUSTRATION_PHRASES = [
    "this is ridiculous", "already tried", "still not working",
    "how many times", "again", "third time", "four times",
    "wasted my time", "worst support", "never works", "giving up",
    "very frustrated", "extremely frustrated", "beyond frustrated",
    "done with this", "terrible service",
]

CANCELLATION_INDICATORS = ["cancel", "refund", "switch provider", "leaving", "unsubscribe", "terminate"]


def detect_escalation_risk(
    text: str,
    sentiment: str = "NEUTRAL",
    urgency: str = "MEDIUM",
    ai_attempt_count: int = 0,
    failed_solutions: int = 0,
    conversation_history: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Calculate escalation risk score using hybrid ML + rules.
    Returns level (LOW/MEDIUM/HIGH/CRITICAL) and score (0-100).
    """
    score = 0.0
    text_lower = text.lower()

    # Rule 1: Explicit human request (auto-escalate)
    for pattern in HUMAN_REQUEST_PATTERNS:
        if re.search(pattern, text_lower):
            return {"level": "CRITICAL", "score": 95.0, "human_requested": True}

    # Rule 2: Sentiment impact
    if sentiment == "NEGATIVE":
        score += 25
    elif sentiment == "NEUTRAL":
        score += 5

    # Rule 3: Urgency impact
    urgency_map = {"LOW": 0, "MEDIUM": 10, "HIGH": 20, "CRITICAL": 35}
    score += urgency_map.get(urgency, 10)

    # Rule 4: AI attempt count
    score += min(ai_attempt_count * 12, 36)

    # Rule 5: Failed solutions
    score += min(failed_solutions * 8, 24)

    # Rule 6: Frustration phrases
    frustration_count = sum(1 for phrase in FRUSTRATION_PHRASES if phrase in text_lower)
    score += min(frustration_count * 10, 30)

    # Rule 7: Cancellation/refund indicators
    if any(kw in text_lower for kw in CANCELLATION_INDICATORS):
        score += 15

    # Rule 8: History patterns
    if conversation_history:
        full_history = " ".join(conversation_history).lower()
        repeated_fails = full_history.count("still not working") + full_history.count("didn't work") + full_history.count("not fixed")
        score += min(repeated_fails * 8, 24)

    # Cap at 100
    score = min(score, 100.0)

    if score >= 81:
        level = "CRITICAL"
    elif score >= 61:
        level = "HIGH"
    elif score >= 31:
        level = "MEDIUM"
    else:
        level = "LOW"

    return {"level": level, "score": round(score, 1), "human_requested": False}


# ──────────────────────────────────────────────
# KEY ISSUE EXTRACTION
# ──────────────────────────────────────────────

def extract_key_issue(ticket_title: str, ticket_description: str, messages: List[str]) -> str:
    """Extract a concise key issue summary."""
    combined = f"{ticket_title}. {ticket_description}"
    if messages:
        combined += " " + " ".join(messages[-3:])  # Use last 3 messages

    # Trim to a reasonable length
    combined = combined[:300]
    return combined


# ──────────────────────────────────────────────
# KNOWLEDGE BASE SEARCH
# ──────────────────────────────────────────────

def search_knowledge_base(articles: List[Dict], intent: str, text: str) -> Optional[Dict]:
    """Find the most relevant knowledge base article."""
    text_lower = text.lower()
    intent_lower = intent.lower()
    best_match = None
    best_score = 0

    for article in articles:
        score = 0
        keywords = [kw.strip().lower() for kw in (article.get("keywords") or "").split(",")]
        category = (article.get("category") or "").lower()
        title = (article.get("title") or "").lower()

        # Title match
        if any(word in title for word in intent_lower.split()):
            score += 3

        # Category match
        if category in intent_lower or any(word in category for word in intent_lower.split()):
            score += 2

        # Keyword match
        for kw in keywords:
            if kw and kw in text_lower:
                score += 1
            if kw and kw in intent_lower:
                score += 1

        if score > best_score:
            best_score = score
            best_match = article

    return best_match if best_score > 0 else None


# ──────────────────────────────────────────────
# AI RESPONSE GENERATION
# ──────────────────────────────────────────────

RESPONSE_TEMPLATES = {
    "greeting": (
        "Hello! I'm SupportAI and I'm here to help you. I've reviewed your ticket about {title}. "
        "Let me help you resolve this as quickly as possible. Could you tell me more about what is happening?"
    ),
    "internet_step1": (
        "I understand you're having internet connectivity issues. Let's troubleshoot this together.\n\n"
        "Step 1: Please try restarting your router. Unplug it from the power socket, wait 30 seconds, "
        "then plug it back in. Wait about 60 seconds for it to fully restart. "
        "Let me know if your internet comes back after this."
    ),
    "internet_step2": (
        "Since restarting the router didn't help, let's check the cables.\n\n"
        "Step 2: Please check the cable that goes from the wall socket into your router. "
        "Make sure it is firmly pushed in at both ends. "
        "Also, look at the lights on your router. Are any of them showing red or orange instead of the usual green?"
    ),
    "internet_step3": (
        "Thank you for checking that. Let's try a full network reset.\n\n"
        "Step 3: Press and hold the small reset button on the back of your router for 10 seconds. "
        "This will restore it to factory settings. After resetting, try reconnecting to your Wi-Fi. "
        "Please note this will reset your Wi-Fi name and password to the original ones printed on the router."
    ),
    "billing_initial": (
        "I understand there's a concern with your billing and I want to help you sort this out.\n\n"
        "To look into this for you, could you tell me roughly when the charge appeared on your account, "
        "and the amount that was charged? Once I have those details I can investigate further."
    ),
    "payment_initial": (
        "I'm sorry to hear about the payment issue. Let me help you resolve this.\n\n"
        "To investigate, I need to ask you a couple of questions. "
        "First, was the amount actually taken from your bank account or did the payment fail before that? "
        "And second, did you receive any confirmation email or message after the payment attempt?"
    ),
    "refund_initial": (
        "I understand you'd like a refund, and I'm here to help you with that.\n\n"
        "Could you tell me a bit more about the purchase you'd like refunded? "
        "For example, what was the product or service, and what was the reason for the refund? "
        "Refunds are typically processed within 5 to 7 business days once approved."
    ),
    "account_locked": (
        "I'm sorry to hear you're having trouble accessing your account. Let's get this fixed.\n\n"
        "The quickest solution is to use the Forgot Password option on the login page. "
        "Enter your registered email address and you'll receive a reset link. "
        "Please also check your spam or junk folder in case it goes there."
    ),
    "password_reset": (
        "I can help you reset your password right now.\n\n"
        "Here are the steps. First, go to the login page. Second, click on Forgot Password. "
        "Third, enter your registered email address. Fourth, check your inbox for the reset link. "
        "And fifth, click the link and create a new password. "
        "The reset link is valid for 24 hours."
    ),
    "order_issue": (
        "I'm sorry to hear about the issue with your order. Let me look into this for you.\n\n"
        "Could you please give me your order number or order ID? "
        "That will help me check the status and find out exactly what happened with your order."
    ),
    "delivery_issue": (
        "I understand your delivery hasn't arrived as expected and I apologise for the inconvenience.\n\n"
        "Could you tell me your order number so I can track it? "
        "I'll check where your package currently is and what the expected delivery date is."
    ),
    "technical_step1": (
        "I can help you with this technical issue. Let's start with the most common fixes.\n\n"
        "Step 1: Please try closing the application completely and reopening it. "
        "If you're on a phone, swipe it away from your recent apps and open it again. "
        "If you're on a computer, close the window and relaunch it. "
        "Does the problem still happen after doing that?"
    ),
    "technical_step2": (
        "Since that didn't fix it, let's try the next step.\n\n"
        "Step 2: Please try clearing your cache and cookies, or if it's an app, try clearing the app data. "
        "On a phone, go to Settings, find the app, and tap Clear Cache. "
        "On a browser, press Control Shift Delete and clear your browsing data. "
        "Then try again and let me know if it works."
    ),
    "service_outage": (
        "Thank you for letting me know. I'm checking our system status right now.\n\n"
        "It's possible there may be a temporary service disruption in your area. "
        "Our technical team actively monitors these situations and works to restore service as quickly as possible. "
        "I'd recommend checking back in 15 to 30 minutes. If the issue persists after that, please let me know."
    ),
    "complaint_empathy": (
        "I sincerely apologise for the inconvenience you've experienced. "
        "Your frustration is completely understandable, and I take this very seriously.\n\n"
        "I want to make this right for you. Could you describe the full issue in detail so I can make sure "
        "we find the best solution?"
    ),
    "human_offered": (
        "I understand this has been frustrating, and I want to make sure you get the best possible help.\n\n"
        "I'd like to connect you with one of our human support agents who can provide more advanced assistance. "
        "They'll have a full record of everything we've already discussed. "
        "Would you like me to connect you with a human agent now?"
    ),
    "max_attempts": (
        "I've tried several solutions with you and I want to make sure your issue gets fully resolved.\n\n"
        "I'm now going to connect you with one of our experienced human support agents "
        "who can investigate this more deeply and provide a definitive solution. "
        "Please hold on while I transfer you."
    ),
    "solution_acknowledged": (
        "Thank you for letting me know that didn't work. I appreciate your patience.\n\n"
        "Let's try a different approach."
    ),
    "generic_help": (
        "Thank you for reaching out. I'm here to help you resolve this.\n\n"
        "Could you describe exactly what is happening? The more details you share, "
        "the more accurately I can help you fix it."
    ),
    "subscription_help": (
        "I can help you with your subscription.\n\n"
        "Could you let me know what specifically you'd like to do? "
        "For example, are you looking to upgrade, downgrade, cancel, or do you have a question about your current plan?"
    ),
}


def generate_ai_response(
    ticket_title: str,
    ticket_description: str,
    intent: str,
    sentiment: str,
    urgency: str,
    ai_attempt_count: int,
    conversation_history: List[Dict],
    knowledge_article: Optional[Dict],
    failed_solutions: List[str],
    customer_message: str,
) -> Tuple[str, str]:
    """
    Generate AI response and solution summary.
    Uses Groq LLM if available, with deterministic fallback templates.
    Returns (response_text, solution_summary)
    """
    # 1. Try Groq LLM first if available
    try:
        from app.services.groq_service import groq_service
        if groq_service.is_available():
            groq_res = groq_service.generate_response_sync(
                ticket_title=ticket_title,
                ticket_description=ticket_description,
                customer_message=customer_message,
                conversation_history=conversation_history,
                knowledge_article=knowledge_article,
                ai_attempt_count=ai_attempt_count,
                failed_solutions=failed_solutions,
                is_voice=False,
            )
            if groq_res and groq_res[0]:
                logger.info(f"AI response successfully generated via Groq ({groq_service.model})")
                return groq_res[0], groq_res[1]
    except Exception as e:
        logger.warning(f"Groq generation failed, falling back to rule templates: {e}")

    message_lower = customer_message.lower()
    history_texts = [m.get("content", "") for m in conversation_history]

    # Check what has already been tried
    already_tried = []
    all_texts = history_texts + [customer_message]
    for h in all_texts:
        h_lower = h.lower()
        if ("already" in h_lower or "tried" in h_lower or "done" in h_lower or "did" in h_lower) and ("restart" in h_lower or "reset" in h_lower or "reboot" in h_lower):
            already_tried.append("restart router")
        if ("already" in h_lower or "tried" in h_lower) and "clear" in h_lower:
            already_tried.append("clear cache")

    # Check if customer just rejected a solution
    rejection_phrases = [
        "still not working", "didn't work", "not working", "not fixed",
        "doesn't work", "still the same", "same problem", "not solved",
        "tried that", "already did that", "already tried", "same issue", "no change",
    ]
    is_rejection = any(phrase in message_lower for phrase in rejection_phrases)

    def join_prefix(prefix: str, body: str) -> str:
        return (prefix + "\n\n" + body) if prefix else body

    # ── FIRST message ──────────────────────────────────────────────────────────
    customer_msg_count = len([m for m in conversation_history if m.get("sender_type") == "CUSTOMER"])
    if ai_attempt_count == 0 and customer_msg_count <= 1:
        solution_summary = f"Initial AI greeting and assessment for: {ticket_title}"

        if intent == "Internet Problem":
            if "restart" in " ".join(already_tried):
                response = RESPONSE_TEMPLATES["internet_step2"]
                solution_summary = "Suggested checking WAN cable connection"
            else:
                response = RESPONSE_TEMPLATES["internet_step1"]
                solution_summary = "Suggested router restart"
        elif intent == "Billing Problem":
            response = RESPONSE_TEMPLATES["billing_initial"]
            solution_summary = "Requested billing transaction details"
        elif intent == "Payment Problem":
            response = RESPONSE_TEMPLATES["payment_initial"]
            solution_summary = "Requested payment confirmation details"
        elif intent == "Refund Request":
            response = RESPONSE_TEMPLATES["refund_initial"]
            solution_summary = "Initiated refund request process"
        elif intent == "Account Problem":
            response = RESPONSE_TEMPLATES["account_locked"]
            solution_summary = "Suggested password reset to regain account access"
        elif intent == "Password Reset":
            response = RESPONSE_TEMPLATES["password_reset"]
            solution_summary = "Provided password reset instructions"
        elif intent == "Order Issue":
            response = RESPONSE_TEMPLATES["order_issue"]
            solution_summary = "Requested order ID to investigate"
        elif intent == "Delivery Problem":
            response = RESPONSE_TEMPLATES["delivery_issue"]
            solution_summary = "Requested order number to track delivery"
        elif intent == "Technical Issue":
            if "restart" in " ".join(already_tried):
                response = RESPONSE_TEMPLATES["technical_step2"]
                solution_summary = "Suggested clearing cache and app data"
            else:
                response = RESPONSE_TEMPLATES["technical_step1"]
                solution_summary = "Suggested restarting the application"
        elif intent == "Service Outage":
            response = RESPONSE_TEMPLATES["service_outage"]
            solution_summary = "Informed about possible service outage and advised to wait"
        elif intent == "Subscription":
            response = RESPONSE_TEMPLATES["subscription_help"]
            solution_summary = "Asked for subscription action details"
        elif intent == "Complaint":
            response = RESPONSE_TEMPLATES["complaint_empathy"]
            solution_summary = "Acknowledged complaint, gathering more information"
        elif intent == "Cancellation":
            response = (
                "I understand you'd like to cancel your service. I'm sorry to hear that.\n\n"
                "Before I proceed, could you tell me the reason you'd like to cancel? "
                "There may be an alternative solution or a special offer I can arrange for you."
            )
            solution_summary = "Asked for cancellation reason before processing"
        elif knowledge_article:
            response = (
                f"I can help with that. Based on your issue, here is what I recommend.\n\n"
                f"{knowledge_article.get('title', 'Solution')}.\n\n"
                f"{knowledge_article.get('solution', '')}"
            )
            solution_summary = f"Suggested: {knowledge_article.get('title', 'knowledge base solution')}"
        else:
            response = (
                RESPONSE_TEMPLATES["greeting"].format(title=ticket_title)
                + "\n\n"
                + RESPONSE_TEMPLATES["generic_help"]
            )
            solution_summary = "Gathering initial problem details"
        return response, solution_summary

    # ── SUBSEQUENT attempts ────────────────────────────────────────────────────
    prefix = RESPONSE_TEMPLATES["solution_acknowledged"] if is_rejection else ""

    if intent == "Internet Problem":
        if ai_attempt_count == 1:
            response = join_prefix(prefix, RESPONSE_TEMPLATES["internet_step2"])
            solution_summary = "Suggested checking WAN cable and router indicator lights"
        elif ai_attempt_count == 2:
            response = join_prefix(prefix, RESPONSE_TEMPLATES["internet_step3"])
            solution_summary = "Suggested full network/router reset"
        else:
            response = RESPONSE_TEMPLATES["max_attempts"]
            solution_summary = "Offered human agent escalation after exhausting troubleshooting steps"

    elif intent == "Technical Issue":
        if ai_attempt_count == 1:
            response = join_prefix(prefix, RESPONSE_TEMPLATES["technical_step2"])
            solution_summary = "Suggested clearing cache and app data"
        elif knowledge_article and ai_attempt_count < 3:
            steps = knowledge_article.get("steps", "")
            try:
                import json as _json
                steps_list = _json.loads(steps)
                step_text = " ".join(f"Step {i+1}, {s}." for i, s in enumerate(steps_list[:3]))
            except Exception:
                step_text = (steps or knowledge_article.get("solution", ""))[:400]
            response = join_prefix(prefix, (
                f"Let me try another approach from our support resources.\n\n"
                f"{knowledge_article.get('title', 'Next Steps')}.\n\n"
                f"{step_text}\n\n"
                f"Please try these steps and let me know if the issue is resolved."
            ))
            solution_summary = f"Applied knowledge base: {knowledge_article.get('title', 'solution')}"
        else:
            response = RESPONSE_TEMPLATES["human_offered"]
            solution_summary = "Offered human agent escalation"

    elif knowledge_article and ai_attempt_count < 3:
        steps = knowledge_article.get("steps", "")
        try:
            import json as _json
            steps_list = _json.loads(steps)
            step_text = " ".join(f"Step {i+1}, {s}." for i, s in enumerate(steps_list[:3]))
        except Exception:
            step_text = (steps or knowledge_article.get("solution", ""))[:400]
        response = join_prefix(prefix, (
            f"Let me try a different approach based on our support resources.\n\n"
            f"{knowledge_article.get('title', 'Next Steps')}.\n\n"
            f"{step_text}\n\n"
            f"Please try these steps and let me know if the issue is resolved."
        ))
        solution_summary = f"Applied knowledge base: {knowledge_article.get('title', 'solution')}"
    else:
        if ai_attempt_count >= settings.MAX_AI_ATTEMPTS - 1:
            response = RESPONSE_TEMPLATES["max_attempts"]
            solution_summary = "Offered human agent escalation"
        else:
            response = join_prefix(prefix, RESPONSE_TEMPLATES["generic_help"])
            solution_summary = "Requested more information to continue troubleshooting"

    return response, solution_summary


async def generate_ai_response_async(
    ticket_title: str,
    ticket_description: str,
    intent: str,
    sentiment: str,
    urgency: str,
    ai_attempt_count: int,
    conversation_history: List[Dict],
    knowledge_article: Optional[Dict],
    failed_solutions: List[str],
    customer_message: str,
    is_voice: bool = False,
) -> Tuple[str, str]:
    """
    Asynchronous version of generate_ai_response.
    Uses non-blocking Groq API call if available, falling back to rule engine.
    """
    try:
        from app.services.groq_service import groq_service
        if groq_service.is_available():
            groq_res = await groq_service.generate_response(
                ticket_title=ticket_title,
                ticket_description=ticket_description,
                customer_message=customer_message,
                conversation_history=conversation_history,
                knowledge_article=knowledge_article,
                ai_attempt_count=ai_attempt_count,
                failed_solutions=failed_solutions,
                is_voice=is_voice,
            )
            if groq_res and groq_res[0]:
                logger.info(f"AI response successfully generated via Async Groq ({groq_service.model})")
                return groq_res[0], groq_res[1]
    except Exception as e:
        logger.warning(f"Async Groq generation failed: {e}")

    return generate_ai_response(
        ticket_title=ticket_title,
        ticket_description=ticket_description,
        intent=intent,
        sentiment=sentiment,
        urgency=urgency,
        ai_attempt_count=ai_attempt_count,
        conversation_history=conversation_history,
        knowledge_article=knowledge_article,
        failed_solutions=failed_solutions,
        customer_message=customer_message,
    )


# ──────────────────────────────────────────────
# HANDOFF SUMMARY
# ──────────────────────────────────────────────

def generate_handoff_summary(
    ticket_title: str,
    customer_name: str,
    latest_analysis: Optional[Dict],
    solution_attempts: List[Dict],
    last_customer_message: str,
) -> str:
    """Generate AI handoff summary for human agent."""
    attempts_text = ""
    for attempt in solution_attempts:
        result = attempt.get("result", "PENDING")
        summary = attempt.get("solution_summary", "Unknown step")
        num = attempt.get("attempt_number", "?")
        attempts_text += f"\n{num}. {summary} — **{result}**"

    analysis_text = ""
    if latest_analysis:
        analysis_text = (
            f"- **Sentiment:** {latest_analysis.get('sentiment_label', 'N/A')}\n"
            f"- **Intent:** {latest_analysis.get('intent_label', 'N/A')}\n"
            f"- **Urgency:** {latest_analysis.get('urgency_label', 'N/A')}\n"
            f"- **Escalation Risk:** {latest_analysis.get('escalation_risk_level', 'N/A')} "
            f"({latest_analysis.get('escalation_risk_score', 0):.0f}%)"
        )

    recommended_action = ""
    if latest_analysis:
        rec = latest_analysis.get("recommended_action", "")
        if rec:
            recommended_action = f"\n\n**Recommended Next Action:** {rec}"

    summary = f"""## AI Handoff Summary

**Issue:** {ticket_title}
**Customer:** {customer_name}

### Analysis
{analysis_text if analysis_text else "No analysis available"}

### Attempted Solutions
{attempts_text if attempts_text else "No solutions attempted yet"}

### Customer's Last Message
> "{last_customer_message}"
{recommended_action}
"""
    return summary.strip()


# ──────────────────────────────────────────────
# AI COPILOT FOR AGENTS
# ──────────────────────────────────────────────

def generate_agent_copilot(
    customer_name: str,
    sentiment: str,
    intent: str,
    urgency: str,
    last_customer_message: str,
    solution_attempts: List[Dict],
    knowledge_article: Optional[Dict],
) -> Dict[str, str]:
    """Generate private AI copilot recommendations for human agent."""
    mood_comment = {
        "NEGATIVE": f"{customer_name} appears frustrated and upset. Acknowledge their frustration first.",
        "NEUTRAL": f"{customer_name} is patient. Keep communication clear and professional.",
        "POSITIVE": f"{customer_name} seems cooperative. Focus on providing the solution.",
    }.get(sentiment, "Maintain a professional, empathetic tone.")

    if intent == "Internet Problem":
        next_action = "Check service outage status in the customer's area and review account status for any service suspension."
    elif intent in ["Billing Problem", "Payment Problem"]:
        next_action = "Review the customer's billing history and recent transactions in the billing system."
    elif intent == "Refund Request":
        next_action = "Check the refund eligibility based on company policy and initiate the refund process if eligible."
    elif intent == "Account Problem":
        next_action = "Manually verify the customer's account status and unlock if necessary."
    elif intent == "Complaint":
        next_action = "Apologize sincerely, offer a resolution, and consider a goodwill gesture if appropriate."
    elif knowledge_article:
        next_action = f"Refer to: {knowledge_article.get('title', 'knowledge base')} — {knowledge_article.get('solution', '')[:200]}"
    else:
        next_action = "Gather more information about the issue before proposing a solution."

    urgency_note = {
        "CRITICAL": "⚠️ CRITICAL urgency — resolve immediately or escalate to supervisor.",
        "HIGH": "🔴 High urgency — prioritize this ticket.",
        "MEDIUM": "🟡 Medium urgency — handle promptly.",
        "LOW": "🟢 Low urgency — standard response time.",
    }.get(urgency, "")

    suggested_response = (
        f"Hi {customer_name}, I've reviewed everything you've been through. "
        f"I'll personally take care of this for you right now."
    )

    article_title = knowledge_article.get("title") if knowledge_article else None

    return {
        "mood_comment": mood_comment,
        "urgency_note": urgency_note,
        "suggested_response": suggested_response,
        "next_action": next_action,
        "knowledge_article": article_title or "No specific article found",
    }


# ──────────────────────────────────────────────
# FULL ANALYSIS PIPELINE
# ──────────────────────────────────────────────

def full_analysis(
    text: str,
    ai_attempt_count: int = 0,
    failed_solutions: int = 0,
    conversation_history: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Run full AI analysis pipeline on a customer message."""
    sentiment = analyze_sentiment(text)
    intent = classify_intent(text)
    urgency = detect_urgency(text, sentiment["label"], intent["label"])
    escalation = detect_escalation_risk(
        text,
        sentiment=sentiment["label"],
        urgency=urgency["label"],
        ai_attempt_count=ai_attempt_count,
        failed_solutions=failed_solutions,
        conversation_history=conversation_history,
    )

    return {
        "sentiment": sentiment,
        "intent": intent,
        "urgency": urgency,
        "escalation_risk": escalation,
    }
