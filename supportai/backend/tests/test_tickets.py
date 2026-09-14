from app.models.ticket import TicketStatus, TicketPriority, TicketCategory

def test_ticket_status_enums():
    assert TicketStatus.CREATED.value == "CREATED"
    assert TicketStatus.AI_ASSISTING.value == "AI_ASSISTING"
    assert TicketStatus.WAITING_FOR_AGENT.value == "WAITING_FOR_AGENT"
    assert TicketStatus.HUMAN_AGENT_ACTIVE.value == "HUMAN_AGENT_ACTIVE"
    assert TicketStatus.AI_RESOLVED.value == "AI_RESOLVED"
    assert TicketStatus.RESOLVED.value == "RESOLVED"
    assert TicketStatus.CLOSED.value == "CLOSED"
    assert TicketStatus.REOPENED.value == "REOPENED"

def test_ticket_categories():
    assert TicketCategory.INTERNET_PROBLEM.value == "Internet Problem"
    assert TicketCategory.PAYMENT_PROBLEM.value == "Payment Problem"
    assert TicketCategory.REFUND.value == "Refund"
    assert TicketCategory.ACCOUNT_PROBLEM.value == "Account Problem"
