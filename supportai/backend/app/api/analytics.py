"""
Analytics API — overview stats, charts, agent performance.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from typing import Dict, Any, List

from app.database.database import get_db
from app.models.ticket import Ticket, TicketStatus, TicketCategory
from app.models.analysis import AIAnalysis
from app.models.user import User, UserRole
from app.api.auth import get_current_user

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview")
async def get_analytics_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    # Total tickets
    total = await db.scalar(select(func.count(Ticket.id)))
    active = await db.scalar(
        select(func.count(Ticket.id)).where(
            Ticket.status.in_([TicketStatus.AI_ASSISTING, TicketStatus.HUMAN_AGENT_ACTIVE, TicketStatus.AGENT_ASSIGNED])
        )
    )
    waiting = await db.scalar(
        select(func.count(Ticket.id)).where(
            Ticket.status.in_([TicketStatus.WAITING_FOR_AGENT, TicketStatus.ESCALATION_REQUESTED])
        )
    )
    resolved = await db.scalar(
        select(func.count(Ticket.id)).where(Ticket.status == TicketStatus.RESOLVED)
    )
    closed = await db.scalar(
        select(func.count(Ticket.id)).where(Ticket.status == TicketStatus.CLOSED)
    )
    ai_resolved = await db.scalar(
        select(func.count(Ticket.id)).where(Ticket.status == TicketStatus.AI_RESOLVED)
    )
    reopened = await db.scalar(
        select(func.count(Ticket.id)).where(Ticket.status == TicketStatus.REOPENED)
    )
    escalated = await db.scalar(
        select(func.count(Ticket.id)).where(
            Ticket.status.in_([TicketStatus.WAITING_FOR_AGENT, TicketStatus.ESCALATION_REQUESTED, TicketStatus.HUMAN_AGENT_ACTIVE])
        )
    )

    # Sentiment distribution
    sentiment_result = await db.execute(
        select(AIAnalysis.sentiment_label, func.count(AIAnalysis.id))
        .group_by(AIAnalysis.sentiment_label)
    )
    sentiment_dist = {row[0]: row[1] for row in sentiment_result.fetchall() if row[0]}

    # Category distribution
    cat_result = await db.execute(
        select(Ticket.category, func.count(Ticket.id))
        .group_by(Ticket.category)
    )
    category_dist = {str(row[0].value if hasattr(row[0], 'value') else row[0]): row[1] for row in cat_result.fetchall()}

    # AI Resolution Rate
    total_resolved = (resolved or 0) + (closed or 0) + (ai_resolved or 0)
    ai_resolution_rate = round((ai_resolved or 0) / max(total_resolved, 1) * 100, 1)
    human_escalation_rate = round((escalated or 0) / max(total or 1, 1) * 100, 1)

    # Average satisfaction
    avg_sat_result = await db.scalar(
        select(func.avg(Ticket.satisfaction_rating)).where(Ticket.satisfaction_rating.isnot(None))
    )

    # Daily ticket counts (last 7 days) — simplified
    daily_result = await db.execute(
        select(
            func.date(Ticket.created_at).label("date"),
            func.count(Ticket.id).label("count")
        ).group_by(func.date(Ticket.created_at))
        .order_by(func.date(Ticket.created_at).desc())
        .limit(7)
    )
    daily_data = [{"date": str(row[0]), "count": row[1]} for row in daily_result.fetchall()]
    daily_data.reverse()

    return {
        "total_tickets": total or 0,
        "active_tickets": active or 0,
        "waiting_for_agent": waiting or 0,
        "resolved": resolved or 0,
        "closed": closed or 0,
        "ai_resolved": ai_resolved or 0,
        "reopened": reopened or 0,
        "escalated": escalated or 0,
        "ai_resolution_rate": ai_resolution_rate,
        "human_escalation_rate": human_escalation_rate,
        "avg_satisfaction": round(avg_sat_result or 0, 2),
        "sentiment_distribution": sentiment_dist,
        "category_distribution": category_dist,
        "daily_tickets": daily_data,
    }


@router.get("/agent-performance")
async def get_agent_performance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """Get per-agent performance metrics."""
    if current_user.role not in [UserRole.SUPERVISOR, UserRole.ADMIN]:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(User).where(User.role.in_([UserRole.AGENT, UserRole.SUPERVISOR]))
    )
    agents = result.scalars().all()
    performance = []

    for agent in agents:
        # Tickets resolved
        resolved = await db.scalar(
            select(func.count(Ticket.id)).where(
                Ticket.assigned_agent_id == agent.id,
                Ticket.status.in_([TicketStatus.RESOLVED, TicketStatus.CLOSED]),
            )
        )
        total_assigned = await db.scalar(
            select(func.count(Ticket.id)).where(Ticket.assigned_agent_id == agent.id)
        )
        avg_sat = await db.scalar(
            select(func.avg(Ticket.satisfaction_rating)).where(
                Ticket.assigned_agent_id == agent.id,
                Ticket.satisfaction_rating.isnot(None),
            )
        )

        performance.append({
            "agent_id": agent.id,
            "agent_name": agent.name,
            "total_assigned": total_assigned or 0,
            "resolved": resolved or 0,
            "resolution_rate": round((resolved or 0) / max(total_assigned or 1, 1) * 100, 1),
            "avg_satisfaction": round(avg_sat or 0, 2),
        })

    return performance
