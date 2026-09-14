"""
Messages API.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from pydantic import BaseModel

from app.database.database import get_db
from app.models.message import Message, SenderType
from app.models.ticket import Ticket
from app.models.user import User, UserRole
from app.schemas.ticket import MessageResponse
from app.api.auth import get_current_user

router = APIRouter(prefix="/api/messages", tags=["messages"])


class SendMessageRequest(BaseModel):
    content: str
    is_internal: bool = False


@router.get("/ticket/{ticket_id}", response_model=List[MessageResponse])
async def get_ticket_messages(
    ticket_id: int,
    include_internal: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Access control
    if current_user.role == UserRole.CUSTOMER and ticket.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    query = (
        select(Message)
        .options(selectinload(Message.sender))
        .where(Message.ticket_id == ticket_id)
        .order_by(Message.created_at)
    )

    # Customers don't see internal messages
    if current_user.role == UserRole.CUSTOMER or not include_internal:
        query = query.where(Message.is_internal == False)

    result = await db.execute(query)
    messages = result.scalars().all()
    return [MessageResponse.model_validate(m) for m in messages]
