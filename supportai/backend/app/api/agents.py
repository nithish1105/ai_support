"""
Agents API — queue, analytics, performance.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from typing import List

from app.database.database import get_db
from app.models.ticket import Ticket, TicketStatus
from app.models.user import User, UserRole
from app.models.message import Message
from app.models.analysis import AIAnalysis
from app.schemas.ticket import TicketResponse
from app.schemas.auth import UserResponse
from app.api.auth import get_current_user

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("/queue", response_model=List[TicketResponse])
async def get_agent_queue(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get tickets waiting for agent assignment."""
    if current_user.role not in [UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN]:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(Ticket)
        .options(
            selectinload(Ticket.customer),
            selectinload(Ticket.assigned_agent),
            selectinload(Ticket.analyses),
            selectinload(Ticket.solution_attempts),
            selectinload(Ticket.events),
        )
        .where(
            Ticket.status.in_([
                TicketStatus.WAITING_FOR_AGENT,
                TicketStatus.ESCALATION_REQUESTED,
            ])
        )
        .order_by(desc(Ticket.created_at))
    )
    tickets = result.scalars().all()
    return [TicketResponse.model_validate(t) for t in tickets]


@router.get("/my-tickets", response_model=List[TicketResponse])
async def get_my_tickets(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get tickets assigned to the current agent."""
    if current_user.role not in [UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN]:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(Ticket)
        .options(
            selectinload(Ticket.customer),
            selectinload(Ticket.assigned_agent),
            selectinload(Ticket.analyses),
            selectinload(Ticket.solution_attempts),
            selectinload(Ticket.events),
        )
        .where(Ticket.assigned_agent_id == current_user.id)
        .order_by(desc(Ticket.created_at))
    )
    tickets = result.scalars().all()
    return [TicketResponse.model_validate(t) for t in tickets]


@router.get("/list", response_model=List[UserResponse])
async def list_agents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all agents."""
    if current_user.role not in [UserRole.SUPERVISOR, UserRole.ADMIN]:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(User).where(User.role.in_([UserRole.AGENT, UserRole.SUPERVISOR]))
    )
    agents = result.scalars().all()
    return [UserResponse.model_validate(a) for a in agents]
