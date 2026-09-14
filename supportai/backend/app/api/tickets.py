"""
Tickets API — CRUD, status transitions, escalation, resolution.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from datetime import datetime
from typing import List, Optional

from app.database.database import get_db
from app.models.user import User, UserRole
from app.models.ticket import Ticket, TicketStatus, TicketPriority, TicketCategory
from app.models.message import Message, SenderType
from app.models.analysis import AIAnalysis, SolutionAttempt
from app.models.knowledge_article import AgentNote, TicketEvent, KnowledgeArticle
from app.schemas.ticket import (
    CreateTicketRequest, TicketResponse, SatisfactionRequest,
    EscalationRequest, NoteRequest, AgentNoteResponse, AIAnalysisResponse
)
from app.schemas.auth import UserResponse
from app.api.auth import get_current_user
from app.utils.token_generator import generate_support_token
from app.services import ai_service
from app.utils.logger import logger

from app.services.mongo_sync_service import sync_ticket_to_mongo

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


async def _load_ticket(ticket_id: int, db: AsyncSession) -> Ticket:
    result = await db.execute(
        select(Ticket)
        .options(
            selectinload(Ticket.customer),
            selectinload(Ticket.assigned_agent),
            selectinload(Ticket.messages).selectinload(Message.sender),
            selectinload(Ticket.analyses),
            selectinload(Ticket.solution_attempts),
            selectinload(Ticket.notes).selectinload(AgentNote.agent),
            selectinload(Ticket.events),
        )
        .where(Ticket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    try:
        await sync_ticket_to_mongo(ticket)
    except Exception:
        pass
    return ticket


def _add_event(db_session, ticket_id: int, event_type: str, description: str = "", actor_id: int = None):
    event = TicketEvent(
        ticket_id=ticket_id,
        event_type=event_type,
        description=description,
        actor_id=actor_id,
    )
    db_session.add(event)


@router.post("", response_model=TicketResponse, status_code=201)
async def create_ticket(
    request: CreateTicketRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Generate unique token
    token = generate_support_token()
    # Ensure uniqueness
    for _ in range(10):
        result = await db.execute(select(Ticket).where(Ticket.public_token == token))
        if not result.scalar_one_or_none():
            break
        token = generate_support_token()

    # Map category
    cat_map = {c.value: c for c in TicketCategory}
    category = cat_map.get(request.category, TicketCategory.OTHER)

    ticket = Ticket(
        public_token=token,
        customer_id=current_user.id,
        title=request.title,
        description=request.description,
        category=category,
        priority=TicketPriority.MEDIUM,
        status=TicketStatus.CREATED,
    )
    db.add(ticket)
    await db.flush()
    await db.refresh(ticket)

    # Add creation event
    _add_event(db, ticket.id, "TICKET_CREATED", f"Ticket created: {request.title}", current_user.id)

    # Add system welcome message
    welcome_msg = Message(
        ticket_id=ticket.id,
        sender_type=SenderType.SYSTEM,
        content=f"Support ticket {token} created successfully. AI assistant is ready to help.",
    )
    db.add(welcome_msg)

    # Transition to AI_ASSISTING
    ticket.status = TicketStatus.AI_ASSISTING
    await db.flush()

    return await _load_ticket(ticket.id, db)


@router.get("", response_model=List[TicketResponse])
async def list_tickets(
    status_filter: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Ticket).options(
        selectinload(Ticket.customer),
        selectinload(Ticket.assigned_agent),
        selectinload(Ticket.analyses),
        selectinload(Ticket.solution_attempts),
        selectinload(Ticket.events),
    )

    if current_user.role == UserRole.CUSTOMER:
        query = query.where(Ticket.customer_id == current_user.id)
    elif current_user.role == UserRole.AGENT:
        # Show assigned tickets + waiting
        from sqlalchemy import or_
        query = query.where(
            or_(
                Ticket.assigned_agent_id == current_user.id,
                Ticket.status.in_([TicketStatus.WAITING_FOR_AGENT, TicketStatus.ESCALATION_REQUESTED])
            )
        )

    if status_filter:
        try:
            status_enum = TicketStatus(status_filter)
            query = query.where(Ticket.status == status_enum)
        except ValueError:
            pass

    query = query.order_by(desc(Ticket.created_at))
    result = await db.execute(query)
    tickets = result.scalars().all()
    return [TicketResponse.model_validate(t) for t in tickets]


@router.get("/token/{token}", response_model=TicketResponse)
async def get_ticket_by_token(token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Ticket)
        .options(
            selectinload(Ticket.customer),
            selectinload(Ticket.assigned_agent),
            selectinload(Ticket.messages),
            selectinload(Ticket.analyses),
            selectinload(Ticket.solution_attempts),
            selectinload(Ticket.events),
        )
        .where(Ticket.public_token == token)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return TicketResponse.model_validate(ticket)


@router.get("/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = await _load_ticket(ticket_id, db)
    # Access control
    if current_user.role == UserRole.CUSTOMER and ticket.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return TicketResponse.model_validate(ticket)


@router.get("/{ticket_id}/analysis", response_model=List[AIAnalysisResponse])
async def get_ticket_analysis(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(AIAnalysis)
        .where(AIAnalysis.ticket_id == ticket_id)
        .order_by(desc(AIAnalysis.created_at))
    )
    analyses = result.scalars().all()
    return [AIAnalysisResponse.model_validate(a) for a in analyses]


@router.post("/{ticket_id}/satisfaction")
async def submit_satisfaction(
    ticket_id: int,
    request: SatisfactionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = await _load_ticket(ticket_id, db)
    if ticket.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    ticket.satisfaction_rating = request.rating
    ticket.satisfaction_comment = request.comment
    ticket.was_resolved = request.was_resolved

    if request.was_resolved:
        ticket.status = TicketStatus.CLOSED
        ticket.closed_at = datetime.utcnow()
        _add_event(db, ticket.id, "TICKET_CLOSED", "Customer confirmed resolution", current_user.id)
    else:
        ticket.status = TicketStatus.REOPENED
        _add_event(db, ticket.id, "TICKET_REOPENED", "Customer indicated issue not resolved", current_user.id)

    await db.flush()
    return {"message": "Satisfaction recorded", "status": ticket.status}


@router.post("/{ticket_id}/escalate")
async def escalate_ticket(
    ticket_id: int,
    request: EscalationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = await _load_ticket(ticket_id, db)
    if current_user.role == UserRole.CUSTOMER and ticket.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if ticket.status in [TicketStatus.CLOSED]:
        raise HTTPException(status_code=400, detail="Cannot escalate a closed ticket")

    ticket.status = TicketStatus.WAITING_FOR_AGENT
    ticket.escalation_reason = request.reason or "Customer requested human agent"
    _add_event(db, ticket.id, "ESCALATION_REQUESTED", ticket.escalation_reason, current_user.id)

    # Add escalation message
    msg = Message(
        ticket_id=ticket.id,
        sender_type=SenderType.SYSTEM,
        content="Your request has been escalated to our human support team. A support agent will join shortly.",
    )
    db.add(msg)
    await db.flush()
    return {"message": "Escalated successfully", "status": ticket.status}


@router.post("/{ticket_id}/assign")
async def assign_ticket(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in [UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only agents can accept tickets")

    ticket = await _load_ticket(ticket_id, db)

    if ticket.status not in [TicketStatus.WAITING_FOR_AGENT, TicketStatus.ESCALATION_REQUESTED, TicketStatus.REOPENED]:
        raise HTTPException(status_code=400, detail=f"Ticket cannot be assigned in status: {ticket.status}")

    ticket.assigned_agent_id = current_user.id
    ticket.status = TicketStatus.AGENT_ASSIGNED
    _add_event(db, ticket.id, "AGENT_ASSIGNED", f"Agent {current_user.name} accepted the ticket", current_user.id)

    # System message to customer
    msg = Message(
        ticket_id=ticket.id,
        sender_type=SenderType.SYSTEM,
        content=f"✓ {current_user.name} has joined the conversation.",
    )
    db.add(msg)

    await db.flush()

    # Transition to HUMAN_AGENT_ACTIVE
    ticket.status = TicketStatus.HUMAN_AGENT_ACTIVE
    _add_event(db, ticket.id, "AGENT_JOINED", f"{current_user.name} joined the conversation", current_user.id)
    await db.flush()

    try:
        from app.api.websocket import manager, voice_manager
        joined_payload = {
            "type": "agent_joined",
            "agent_name": current_user.name,
            "agent_id": current_user.id,
            "status": "HUMAN_AGENT_ACTIVE",
            "message": f"✓ {current_user.name} has joined the conversation.",
        }
        await manager.broadcast(ticket.id, joined_payload)
        await manager.broadcast(ticket.id, {
            "type": "system",
            "message": f"✓ {current_user.name} has joined the conversation.",
        })
        await voice_manager.broadcast(ticket.id, joined_payload)
    except Exception as e:
        logger.warning(f"Failed to broadcast agent_joined on assign: {e}")

    return {"message": f"Ticket assigned to {current_user.name}", "status": ticket.status}


@router.post("/{ticket_id}/resolve")
async def resolve_ticket(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in [UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only agents can resolve tickets")

    ticket = await _load_ticket(ticket_id, db)

    ticket.status = TicketStatus.RESOLVED
    ticket.resolved_at = datetime.utcnow()
    _add_event(db, ticket.id, "TICKET_RESOLVED", f"Resolved by agent {current_user.name}", current_user.id)

    # Notify customer
    msg = Message(
        ticket_id=ticket.id,
        sender_type=SenderType.SYSTEM,
        content=f"Your support agent has marked this issue as resolved. Was your issue successfully resolved?",
    )
    db.add(msg)
    await db.flush()

    try:
        from app.api.websocket import manager, voice_manager
        resolve_payload = {
            "type": "ticket_resolved",
            "status": "RESOLVED",
            "message": f"Resolved by {current_user.name}",
            "show_satisfaction": True,
        }
        await manager.broadcast(ticket.id, resolve_payload)
        await manager.broadcast(ticket.id, {
            "type": "ticket_status",
            "status": "RESOLVED",
        })
        await voice_manager.broadcast(ticket.id, {
            "type": "agent_resolved",
            "status": "RESOLVED",
            "message": f"Ticket has been resolved by {current_user.name}.",
        })
    except Exception as e:
        logger.warning(f"Failed to broadcast resolution on resolve: {e}")

    return {"message": "Ticket resolved", "status": ticket.status}


@router.post("/{ticket_id}/reopen")
async def reopen_ticket(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = await _load_ticket(ticket_id, db)
    if current_user.role == UserRole.CUSTOMER and ticket.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    ticket.status = TicketStatus.REOPENED
    ticket.resolved_at = None
    _add_event(db, ticket.id, "TICKET_REOPENED", "Issue reopened — not fully resolved", current_user.id)
    await db.flush()
    return {"message": "Ticket reopened", "status": ticket.status}


@router.post("/{ticket_id}/notes", response_model=AgentNoteResponse)
async def add_note(
    ticket_id: int,
    request: NoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in [UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only agents can add notes")

    ticket = await _load_ticket(ticket_id, db)

    note = AgentNote(
        ticket_id=ticket_id,
        agent_id=current_user.id,
        content=request.content,
    )
    db.add(note)
    await db.flush()
    await db.refresh(note)

    # Load agent
    agent_result = await db.execute(select(User).where(User.id == current_user.id))
    agent = agent_result.scalar_one()
    note.agent = agent

    return AgentNoteResponse.model_validate(note)


@router.get("/{ticket_id}/notes", response_model=List[AgentNoteResponse])
async def get_notes(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in [UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(AgentNote)
        .options(selectinload(AgentNote.agent))
        .where(AgentNote.ticket_id == ticket_id)
        .order_by(AgentNote.created_at)
    )
    notes = result.scalars().all()
    return [AgentNoteResponse.model_validate(n) for n in notes]
