"""
Database seeder — creates demo users, agents, admin, knowledge articles, and demo tickets.
"""
import asyncio
import json
from sqlalchemy import select
from app.database.database import AsyncSessionLocal, init_db
from app.models.user import User, UserRole
from app.models.ticket import Ticket, TicketStatus, TicketPriority, TicketCategory
from app.models.message import Message, SenderType
from app.models.analysis import AIAnalysis, SolutionAttempt
from app.models.knowledge_article import KnowledgeArticle, TicketEvent
from app.utils.security import get_password_hash
from app.utils.token_generator import generate_support_token
from app.utils.logger import logger


KNOWLEDGE_ARTICLES = [
    {
        "title": "Internet Connection Troubleshooting",
        "category": "Internet Problem",
        "problem_description": "Customer's internet connection is not working or intermittently dropping.",
        "solution": "Follow the step-by-step troubleshooting guide to identify and fix the connectivity issue.",
        "steps": json.dumps([
            "Restart your router by unplugging it for 30 seconds",
            "Check all cable connections on the back of your router",
            "Verify the WAN/Internet indicator light is on",
            "Try connecting via ethernet cable instead of Wi-Fi",
            "Check for service outages in your area",
            "Perform a factory reset on your router if all else fails",
        ]),
        "keywords": "internet, connection, wifi, network, router, broadband, offline, disconnected, not working",
    },
    {
        "title": "Payment Failed or Declined",
        "category": "Payment Problem",
        "problem_description": "Customer's payment failed or was declined during checkout.",
        "solution": "Verify payment details and try alternative payment methods.",
        "steps": json.dumps([
            "Verify your card number, expiry date, and CVV are correct",
            "Ensure your billing address matches your bank records",
            "Check if your card has sufficient funds",
            "Try a different payment method",
            "Contact your bank to authorize the transaction",
            "Clear browser cache and try again",
        ]),
        "keywords": "payment, failed, declined, card, transaction, billing, checkout",
    },
    {
        "title": "Refund Request Process",
        "category": "Refund",
        "problem_description": "Customer wants a refund for a purchase.",
        "solution": "Process refund according to company policy within 5-7 business days.",
        "steps": json.dumps([
            "Verify the purchase date (refunds accepted within 30 days)",
            "Confirm the order ID or transaction reference",
            "Verify the reason for refund",
            "Submit refund request to billing team",
            "Refund will be processed to original payment method within 5-7 business days",
            "Customer will receive email confirmation",
        ]),
        "keywords": "refund, money back, return, reimburse, cancel order",
    },
    {
        "title": "Account Locked or Cannot Login",
        "category": "Account Problem",
        "problem_description": "Customer cannot access their account due to lockout or incorrect credentials.",
        "solution": "Reset password and verify account status.",
        "steps": json.dumps([
            "Go to the login page and click 'Forgot Password'",
            "Enter your registered email address",
            "Check your email including spam/junk folder",
            "Click the reset link within 24 hours",
            "Create a new strong password",
            "If still locked, contact support for manual unlock",
        ]),
        "keywords": "account, locked, login, access, forgot password, cannot login, blocked",
    },
    {
        "title": "Billing Statement Dispute",
        "category": "Billing Problem",
        "problem_description": "Customer disputes a charge on their billing statement.",
        "solution": "Review billing records and resolve discrepancy.",
        "steps": json.dumps([
            "Locate the specific charge in your billing statement",
            "Note the date and amount of the disputed charge",
            "Check if it corresponds to any service or subscription",
            "Provide the transaction reference number",
            "Our billing team will investigate within 3-5 business days",
            "A credit will be applied if the charge is confirmed erroneous",
        ]),
        "keywords": "bill, billing, invoice, charge, overcharged, statement, dispute",
    },
    {
        "title": "Order Status and Delivery Tracking",
        "category": "Order Issue",
        "problem_description": "Customer wants to track their order or report a delivery issue.",
        "solution": "Provide order tracking information and escalate if delivery is delayed.",
        "steps": json.dumps([
            "Provide your order ID or reference number",
            "Check your email for tracking number",
            "Use the tracking number at the courier's website",
            "If delivery is delayed beyond expected date, report it here",
            "We'll contact the courier on your behalf",
        ]),
        "keywords": "order, delivery, tracking, package, shipped, delayed, missing",
    },
    {
        "title": "Subscription Management",
        "category": "Subscription",
        "problem_description": "Customer wants to manage, upgrade, downgrade, or cancel subscription.",
        "solution": "Update subscription settings from the account portal.",
        "steps": json.dumps([
            "Log in to your account",
            "Navigate to Account Settings > Subscription",
            "Select your desired plan change",
            "Changes take effect at the next billing cycle",
            "For cancellation, select 'Cancel Subscription' and confirm",
            "You'll retain access until the end of the billing period",
        ]),
        "keywords": "subscription, plan, upgrade, downgrade, cancel, monthly, renewal, billing",
    },
    {
        "title": "Password Reset",
        "category": "Password",
        "problem_description": "Customer has forgotten their password or wants to change it.",
        "solution": "Reset password via email link.",
        "steps": json.dumps([
            "Go to the login page",
            "Click 'Forgot Password'",
            "Enter your registered email address",
            "Check your inbox for reset email (check spam too)",
            "Click the reset link within 24 hours",
            "Enter and confirm your new password",
        ]),
        "keywords": "password, forgot, reset, change password, login",
    },
]

DEMO_CUSTOMERS = [
    {"name": "Sarah Johnson", "email": "sarah@demo.com", "phone": "+1-555-0101"},
    {"name": "Michael Brown", "email": "michael@demo.com", "phone": "+1-555-0102"},
    {"name": "Emily Davis", "email": "emily@demo.com", "phone": "+1-555-0103"},
    {"name": "David Wilson", "email": "david@demo.com", "phone": "+1-555-0104"},
    {"name": "James Miller", "email": "james@demo.com", "phone": "+1-555-0105"},
]

DEMO_AGENTS = [
    {"name": "Alex Thompson", "email": "alex@supportai.com"},
    {"name": "John Martinez", "email": "john@supportai.com"},
    {"name": "Priya Patel", "email": "priya@supportai.com"},
    {"name": "Daniel Kim", "email": "daniel@supportai.com"},
]


async def seed():
    """Seed the database with demo data."""
    await init_db()

    async with AsyncSessionLocal() as db:
        # Check if already seeded
        result = await db.execute(select(User).where(User.email == "admin@supportai.com"))
        if result.scalar_one_or_none():
            logger.info("Database already seeded, skipping.")
            return

        logger.info("Seeding database...")

        # Create admin
        admin = User(
            email="admin@supportai.com",
            name="Admin User",
            hashed_password=get_password_hash("admin123"),
            role=UserRole.ADMIN,
        )
        db.add(admin)

        # Create agents
        agents = []
        for agent_data in DEMO_AGENTS:
            agent = User(
                email=agent_data["email"],
                name=agent_data["name"],
                hashed_password=get_password_hash("agent123"),
                role=UserRole.AGENT,
                is_online=True,
            )
            db.add(agent)
            agents.append(agent)

        # Create customers
        customers = []
        for cust_data in DEMO_CUSTOMERS:
            customer = User(
                email=cust_data["email"],
                name=cust_data["name"],
                phone=cust_data["phone"],
                hashed_password=get_password_hash("customer123"),
                role=UserRole.CUSTOMER,
            )
            db.add(customer)
            customers.append(customer)

        await db.flush()

        # Create knowledge articles
        for article_data in KNOWLEDGE_ARTICLES:
            article = KnowledgeArticle(**article_data)
            db.add(article)

        await db.flush()

        # Create demo tickets
        # Ticket 1 - Resolved (AI assisted)
        t1 = Ticket(
            public_token=generate_support_token(),
            customer_id=customers[0].id,
            title="Password Reset Issue",
            description="I cannot reset my password. The reset email never arrives.",
            category=TicketCategory.PASSWORD,
            priority=TicketPriority.MEDIUM,
            status=TicketStatus.CLOSED,
            ai_attempt_count=1,
            was_resolved=True,
            satisfaction_rating=4.5,
        )
        db.add(t1)
        await db.flush()

        db.add(Message(ticket_id=t1.id, sender_type=SenderType.CUSTOMER, sender_id=customers[0].id,
                       content="I cannot reset my password. The reset email never arrives."))
        db.add(Message(ticket_id=t1.id, sender_type=SenderType.AI,
                       content="I can help you reset your password! Please check your spam folder first. The reset link is sent to your registered email and expires after 24 hours."))
        db.add(Message(ticket_id=t1.id, sender_type=SenderType.CUSTOMER, sender_id=customers[0].id,
                       content="Found it in spam! It worked, thank you!"))
        db.add(AIAnalysis(ticket_id=t1.id, sentiment_label="POSITIVE", sentiment_score=0.85,
                          intent_label="Password Reset", intent_score=0.95,
                          urgency_label="MEDIUM", urgency_score=0.6,
                          escalation_risk_level="LOW", escalation_risk_score=15.0))

        # Ticket 2 - Waiting for agent (escalated)
        t2 = Ticket(
            public_token=generate_support_token(),
            customer_id=customers[1].id,
            title="Internet Connection Not Working",
            description="My internet stopped working completely this morning. Already restarted the router twice.",
            category=TicketCategory.INTERNET_PROBLEM,
            priority=TicketPriority.HIGH,
            status=TicketStatus.WAITING_FOR_AGENT,
            ai_attempt_count=3,
            escalation_reason="Customer explicitly requested human agent after 3 failed attempts",
        )
        db.add(t2)
        await db.flush()

        db.add(Message(ticket_id=t2.id, sender_type=SenderType.CUSTOMER, sender_id=customers[1].id,
                       content="My internet stopped working completely this morning. Already restarted the router twice."))
        db.add(Message(ticket_id=t2.id, sender_type=SenderType.AI,
                       content="I understand you're having internet issues. Since you've already restarted the router, let's check the WAN cable connection."))
        db.add(Message(ticket_id=t2.id, sender_type=SenderType.CUSTOMER, sender_id=customers[1].id,
                       content="Still not working after checking the cable."))
        db.add(Message(ticket_id=t2.id, sender_type=SenderType.AI,
                       content="Let's try a network reset. Please hold the reset button on your router for 10 seconds."))
        db.add(Message(ticket_id=t2.id, sender_type=SenderType.CUSTOMER, sender_id=customers[1].id,
                       content="I want to speak to a human agent please!"))
        db.add(Message(ticket_id=t2.id, sender_type=SenderType.SYSTEM,
                       content="Your request has been added to the human support queue. A support agent will join shortly."))
        db.add(AIAnalysis(ticket_id=t2.id, sentiment_label="NEGATIVE", sentiment_score=0.91,
                          intent_label="Internet Problem", intent_score=0.93,
                          urgency_label="HIGH", urgency_score=0.85,
                          escalation_risk_level="CRITICAL", escalation_risk_score=95.0))
        db.add(SolutionAttempt(ticket_id=t2.id, attempt_number=1,
                               solution_summary="Suggested router restart", result="FAILED"))
        db.add(SolutionAttempt(ticket_id=t2.id, attempt_number=2,
                               solution_summary="Suggested checking WAN cable", result="FAILED"))
        db.add(SolutionAttempt(ticket_id=t2.id, attempt_number=3,
                               solution_summary="Suggested full network reset", result="FAILED"))

        # Ticket 3 - AI Assisting (active)
        t3 = Ticket(
            public_token=generate_support_token(),
            customer_id=customers[2].id,
            title="Payment Deducted But Account Shows Unpaid",
            description="My payment was deducted from my account but my billing shows it as unpaid.",
            category=TicketCategory.PAYMENT_PROBLEM,
            priority=TicketPriority.HIGH,
            status=TicketStatus.WAITING_FOR_CUSTOMER,
            ai_attempt_count=1,
        )
        db.add(t3)
        await db.flush()

        db.add(Message(ticket_id=t3.id, sender_type=SenderType.CUSTOMER, sender_id=customers[2].id,
                       content="My payment was deducted from my account but my billing shows it as unpaid."))
        db.add(Message(ticket_id=t3.id, sender_type=SenderType.AI,
                       content="I'm sorry about this payment issue. Could you please confirm the payment date and amount? I'll investigate this immediately."))
        db.add(AIAnalysis(ticket_id=t3.id, sentiment_label="NEGATIVE", sentiment_score=0.78,
                          intent_label="Payment Problem", intent_score=0.89,
                          urgency_label="HIGH", urgency_score=0.75,
                          escalation_risk_level="MEDIUM", escalation_risk_score=45.0))

        # Ticket 4 - Human Agent Active
        t4 = Ticket(
            public_token=generate_support_token(),
            customer_id=customers[3].id,
            assigned_agent_id=agents[0].id,
            title="Refund Request for Order #12345",
            description="I want a refund for my order. The product was defective.",
            category=TicketCategory.REFUND,
            priority=TicketPriority.MEDIUM,
            status=TicketStatus.HUMAN_AGENT_ACTIVE,
            ai_attempt_count=2,
            escalation_reason="Customer requested human for refund processing",
        )
        db.add(t4)
        await db.flush()

        db.add(Message(ticket_id=t4.id, sender_type=SenderType.CUSTOMER, sender_id=customers[3].id,
                       content="I want a refund for my order #12345. The product was defective."))
        db.add(Message(ticket_id=t4.id, sender_type=SenderType.AI,
                       content="I understand you'd like a refund. Refund requests are processed within 5-7 business days. I'll connect you with an agent to expedite this."))
        db.add(Message(ticket_id=t4.id, sender_type=SenderType.SYSTEM,
                       content=f"✓ {agents[0].name} has joined the conversation."))
        db.add(Message(ticket_id=t4.id, sender_type=SenderType.AGENT, sender_id=agents[0].id,
                       content="Hi David, I've reviewed your request. I'll process the refund for order #12345 immediately. You should see it in 5-7 business days."))

        # Ticket 5 - Resolved
        t5 = Ticket(
            public_token=generate_support_token(),
            customer_id=customers[4].id,
            assigned_agent_id=agents[1].id,
            title="This is ridiculous - Account locked for no reason",
            description="I can't access my account and I need it urgently. I've already contacted support 3 times!",
            category=TicketCategory.ACCOUNT_PROBLEM,
            priority=TicketPriority.CRITICAL,
            status=TicketStatus.RESOLVED,
            ai_attempt_count=1,
            satisfaction_rating=4.0,
            was_resolved=True,
            escalation_reason="Very negative sentiment, customer mentioned speaking to manager",
        )
        db.add(t5)
        await db.flush()

        db.add(AIAnalysis(ticket_id=t5.id, sentiment_label="NEGATIVE", sentiment_score=0.97,
                          intent_label="Account Problem", intent_score=0.92,
                          urgency_label="CRITICAL", urgency_score=0.95,
                          escalation_risk_level="CRITICAL", escalation_risk_score=95.0))

        # Add events for tickets
        for ticket in [t1, t2, t3, t4, t5]:
            db.add(TicketEvent(ticket_id=ticket.id, event_type="TICKET_CREATED",
                               description=f"Ticket created: {ticket.title}"))
            db.add(TicketEvent(ticket_id=ticket.id, event_type="AI_ANALYSIS_COMPLETED",
                               description="AI analysis completed"))

        await db.commit()
        logger.info("Database seeded successfully!")
        logger.info("\n=== DEMO CREDENTIALS ===")
        logger.info("CUSTOMERS:")
        for c in DEMO_CUSTOMERS:
            logger.info(f"  {c['email']} / customer123")
        logger.info("AGENTS:")
        for a in DEMO_AGENTS:
            logger.info(f"  {a['email']} / agent123")
        logger.info("ADMIN: admin@supportai.com / admin123")
        logger.info("========================\n")


if __name__ == "__main__":
    asyncio.run(seed())
