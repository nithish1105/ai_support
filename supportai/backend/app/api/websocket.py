"""
WebSocket endpoint for real-time chat.
Handles: customer messages, AI responses, agent messages, typing indicators.
"""
import json
import asyncio
import logging
from typing import Dict, Set, Any, Optional, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database.database import AsyncSessionLocal
from app.models.ticket import Ticket, TicketStatus
from app.models.message import Message, SenderType
from app.models.analysis import AIAnalysis, SolutionAttempt
from app.models.knowledge_article import KnowledgeArticle, TicketEvent
from app.models.user import User, UserRole
from app.models.voice import VoiceSession, VoiceTranscript, VoiceSessionStatus, VoiceSpeakerType
from app.utils.security import decode_access_token
from app.services import ai_service
from app.services.speech_to_text_service import stt_service
from app.services.text_to_speech_service import tts_service
from app.services.audio_processing_service import audio_service
from app.services.voice_session_service import voice_session_service
from app.services.voice_ai_service import voice_ai_service
from app.services.mongo_sync_service import (
    sync_message_to_mongo,
    sync_voice_transcript_to_mongo,
    sync_ticket_to_mongo,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

# Connection manager
class ConnectionManager:
    def __init__(self):
        # ticket_id -> set of WebSockets
        self.connections: Dict[int, Set[WebSocket]] = {}
        # ws -> user_id
        self.ws_users: Dict[WebSocket, int] = {}

    async def connect(self, ticket_id: int, ws: WebSocket, user_id: int = None):
        await ws.accept()
        if ticket_id not in self.connections:
            self.connections[ticket_id] = set()
        self.connections[ticket_id].add(ws)
        if user_id:
            self.ws_users[ws] = user_id
        logger.info(f"WebSocket connected: ticket={ticket_id}, user={user_id}")

    def disconnect(self, ticket_id: int, ws: WebSocket):
        if ticket_id in self.connections:
            self.connections[ticket_id].discard(ws)
            if not self.connections[ticket_id]:
                del self.connections[ticket_id]
        self.ws_users.pop(ws, None)

    async def broadcast(self, ticket_id: int, message: dict, exclude: WebSocket = None):
        if ticket_id in self.connections:
            disconnected = set()
            for ws in self.connections[ticket_id].copy():
                if ws == exclude:
                    continue
                try:
                    await ws.send_json(message)
                except Exception:
                    disconnected.add(ws)
            for ws in disconnected:
                self.disconnect(ticket_id, ws)

    async def send_personal(self, ws: WebSocket, message: dict):
        try:
            await ws.send_json(message)
        except Exception as e:
            logger.error(f"Failed to send personal message: {e}")


manager = ConnectionManager()


async def get_knowledge_articles(db: AsyncSession):
    result = await db.execute(select(KnowledgeArticle).where(KnowledgeArticle.is_active == True))
    articles = result.scalars().all()
    return [
        {
            "id": a.id,
            "title": a.title,
            "category": a.category,
            "problem_description": a.problem_description,
            "solution": a.solution,
            "steps": a.steps,
            "keywords": a.keywords,
        }
        for a in articles
    ]


@router.websocket("/ws/tickets/{ticket_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    ticket_id: int,
    token: str = Query(None),
):
    # Authenticate
    user = None
    if token:
        payload = decode_access_token(token)
        if payload:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(User).where(User.id == int(payload.get("sub", 0))))
                user = result.scalar_one_or_none()

    await manager.connect(ticket_id, websocket, user.id if user else None)

    try:
        # Send connection confirmation
        await manager.send_personal(websocket, {
            "type": "connected",
            "message": "Connected to support chat",
            "ticket_id": ticket_id,
        })

        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "customer_message":
                await handle_customer_message(websocket, ticket_id, data, user)

            elif msg_type == "agent_message":
                await handle_agent_message(websocket, ticket_id, data, user)

            elif msg_type == "typing":
                # Broadcast typing indicator
                await manager.broadcast(ticket_id, {
                    "type": "typing",
                    "sender": data.get("sender", "customer"),
                }, exclude=websocket)

            elif msg_type == "ping":
                await manager.send_personal(websocket, {"type": "pong"})

            elif msg_type == "request_human":
                await handle_escalation_request(websocket, ticket_id, data, user)

            elif msg_type == "accept_ticket":
                await handle_agent_accept(websocket, ticket_id, data, user)

            elif msg_type == "resolve_ticket":
                await handle_agent_resolve(websocket, ticket_id, data, user)

            elif msg_type == "feedback":
                await handle_customer_feedback(websocket, ticket_id, data, user)

    except WebSocketDisconnect:
        manager.disconnect(ticket_id, websocket)
        logger.info(f"WebSocket disconnected: ticket={ticket_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(ticket_id, websocket)


async def handle_customer_message(ws: WebSocket, ticket_id: int, data: dict, user: User):
    """Process customer message, run AI, send AI response."""
    content = data.get("content", "").strip()
    if not content:
        return

    async with AsyncSessionLocal() as db:
        # Load ticket
        result = await db.execute(
            select(Ticket)
            .options(
                selectinload(Ticket.messages),
                selectinload(Ticket.analyses),
                selectinload(Ticket.solution_attempts),
                selectinload(Ticket.customer),
                selectinload(Ticket.assigned_agent),
            )
            .where(Ticket.id == ticket_id)
        )
        ticket = result.scalar_one_or_none()
        if not ticket:
            return

        # Save customer message
        customer_msg = Message(
            ticket_id=ticket_id,
            sender_type=SenderType.CUSTOMER,
            sender_id=user.id if user else None,
            content=content,
        )
        db.add(customer_msg)
        await db.flush()
        await db.refresh(customer_msg)
        try:
            asyncio.create_task(sync_message_to_mongo(customer_msg))
        except Exception:
            pass

        # Broadcast to all in room
        await manager.broadcast(ticket_id, {
            "type": "customer_message",
            "id": customer_msg.id,
            "content": content,
            "sender_type": "CUSTOMER",
            "sender_name": ticket.customer.name if ticket.customer else "Customer",
            "created_at": customer_msg.created_at.isoformat() if customer_msg.created_at else None,
        })

        # If agent is active, don't auto-generate AI response
        if ticket.status == TicketStatus.HUMAN_AGENT_ACTIVE:
            # Generate copilot suggestion (private, only to agent)
            await _send_copilot_to_agent(db, ticket_id, ticket, content)
            await db.commit()
            return

        # AI is handling — send typing indicator
        await manager.broadcast(ticket_id, {"type": "ai_typing", "is_typing": True})

        # Run AI analysis
        conversation_history = [
            {"content": m.content, "sender_type": m.sender_type.value}
            for m in ticket.messages
        ]
        customer_messages = [m.content for m in ticket.messages if m.sender_type == SenderType.CUSTOMER]
        failed_solutions = [s for s in ticket.solution_attempts if s.result == "FAILED"]

        analysis = ai_service.full_analysis(
            text=content,
            ai_attempt_count=ticket.ai_attempt_count,
            failed_solutions=len(failed_solutions),
            conversation_history=customer_messages,
        )

        # Save analysis
        ai_analysis = AIAnalysis(
            ticket_id=ticket_id,
            message_id=customer_msg.id,
            sentiment_label=analysis["sentiment"]["label"],
            sentiment_score=analysis["sentiment"]["score"],
            intent_label=analysis["intent"]["label"],
            intent_score=analysis["intent"]["score"],
            urgency_label=analysis["urgency"]["label"],
            urgency_score=analysis["urgency"]["score"],
            escalation_risk_level=analysis["escalation_risk"]["level"],
            escalation_risk_score=analysis["escalation_risk"]["score"],
        )

        # Search knowledge base
        articles = await get_knowledge_articles(db)
        kb_article = ai_service.search_knowledge_base(articles, analysis["intent"]["label"], content)

        # Recommended action
        ai_analysis.key_issue = ai_service.extract_key_issue(ticket.title, ticket.description, customer_messages)
        if kb_article:
            ai_analysis.recommended_action = f"Apply knowledge base: {kb_article.get('title')}"
        db.add(ai_analysis)

        # Broadcast analysis update
        await manager.broadcast(ticket_id, {
            "type": "analysis_update",
            "analysis": {
                "sentiment": {"label": analysis["sentiment"]["label"], "score": analysis["sentiment"]["score"]},
                "intent": {"label": analysis["intent"]["label"], "score": analysis["intent"]["score"]},
                "urgency": {"label": analysis["urgency"]["label"], "score": analysis["urgency"]["score"]},
                "escalation_risk": {
                    "level": analysis["escalation_risk"]["level"],
                    "score": analysis["escalation_risk"]["score"],
                },
            },
        })

        # Check explicit human request
        if analysis["escalation_risk"].get("human_requested"):
            # Auto-escalate
            await _trigger_escalation(db, ticket_id, ticket, "Customer explicitly requested human agent")
            await db.commit()
            await manager.broadcast(ticket_id, {
                "type": "escalation",
                "message": "I'll connect you with a human support agent right away.",
                "status": "WAITING_FOR_AGENT",
            })
            await manager.broadcast(ticket_id, {"type": "ai_typing", "is_typing": False})
            return

        # Check max attempts
        if ticket.ai_attempt_count >= ai_service.settings.MAX_AI_ATTEMPTS:
            await _trigger_escalation(db, ticket_id, ticket, "Maximum AI attempts reached")
            ai_resp = ai_service.RESPONSE_TEMPLATES["max_attempts"]
            await _save_and_broadcast_ai_message(db, ticket_id, ai_resp)
            await db.commit()
            await manager.broadcast(ticket_id, {"type": "ai_typing", "is_typing": False})
            return

        # Generate AI response
        sol_attempt_dicts = [
            {"attempt_number": s.attempt_number, "solution_summary": s.solution_summary, "result": s.result}
            for s in ticket.solution_attempts
        ]
        ai_response, solution_summary = await ai_service.generate_ai_response_async(
            ticket_title=ticket.title,
            ticket_description=ticket.description,
            intent=analysis["intent"]["label"],
            sentiment=analysis["sentiment"]["label"],
            urgency=analysis["urgency"]["label"],
            ai_attempt_count=ticket.ai_attempt_count,
            conversation_history=conversation_history,
            knowledge_article=kb_article,
            failed_solutions=[s.solution_summary for s in ticket.solution_attempts if s.result == "FAILED"],
            customer_message=content,
        )

        # Save solution attempt
        attempt = SolutionAttempt(
            ticket_id=ticket_id,
            attempt_number=ticket.ai_attempt_count + 1,
            solution_summary=solution_summary,
            full_response=ai_response,
            result="PENDING",
        )
        db.add(attempt)
        ticket.ai_attempt_count += 1
        ticket.status = TicketStatus.WAITING_FOR_CUSTOMER

        # Save and broadcast AI message
        await _save_and_broadcast_ai_message(db, ticket_id, ai_response)
        await manager.broadcast(ticket_id, {"type": "ai_typing", "is_typing": False})

        # Log event
        event = TicketEvent(
            ticket_id=ticket_id,
            event_type="AI_SOLUTION_SENT",
            description=f"AI solution #{ticket.ai_attempt_count}: {solution_summary}",
        )
        db.add(event)

        await db.commit()


async def _save_and_broadcast_ai_message(db: AsyncSession, ticket_id: int, content: str):
    ai_msg = Message(
        ticket_id=ticket_id,
        sender_type=SenderType.AI,
        content=content,
    )
    db.add(ai_msg)
    await db.flush()
    await db.refresh(ai_msg)
    try:
        asyncio.create_task(sync_message_to_mongo(ai_msg))
    except Exception:
        pass

    await manager.broadcast(ticket_id, {
        "type": "ai_message",
        "id": ai_msg.id,
        "content": content,
        "sender_type": "AI",
        "sender_name": "AI Assistant",
        "created_at": ai_msg.created_at.isoformat() if ai_msg.created_at else None,
    })


async def _trigger_escalation(
    db: AsyncSession,
    ticket_id_or_ticket: Any,
    ticket_or_reason: Any = None,
    reason: str = "Customer requested human agent",
):
    if isinstance(ticket_id_or_ticket, Ticket):
        ticket = ticket_id_or_ticket
        ticket_id = ticket.id
        if isinstance(ticket_or_reason, str):
            reason = ticket_or_reason
    else:
        ticket_id = int(ticket_id_or_ticket)
        if isinstance(ticket_or_reason, Ticket):
            ticket = ticket_or_reason
        elif isinstance(ticket_or_reason, str):
            reason = ticket_or_reason
            result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
            ticket = result.scalar_one_or_none()
        else:
            result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
            ticket = result.scalar_one_or_none()

    if not ticket:
        return

    ticket.status = TicketStatus.WAITING_FOR_AGENT
    ticket.escalation_reason = reason
    event = TicketEvent(
        ticket_id=ticket_id,
        event_type="ESCALATION_REQUESTED",
        description=reason,
    )
    db.add(event)
    sys_msg = Message(
        ticket_id=ticket_id,
        sender_type=SenderType.SYSTEM,
        content="Your request has been added to the human support queue. A support agent will join you shortly. Please stay in this conversation.",
    )
    db.add(sys_msg)
    await db.flush()
    await db.commit()

    escalation_payload = {
        "type": "escalation",
        "status": "WAITING_FOR_AGENT",
        "message": "Connecting you with a human support agent. Please stay on the line.",
        "reason": reason,
    }
    await manager.broadcast(ticket_id, {
        "type": "ticket_status",
        "status": "WAITING_FOR_AGENT",
        "message": "Connecting you with a human agent...",
    })
    await manager.broadcast(ticket_id, escalation_payload)
    await voice_manager.broadcast(ticket_id, escalation_payload)


async def handle_agent_message(ws: WebSocket, ticket_id: int, data: dict, user: User):
    """Agent sends a message to the customer."""
    if not user or user.role not in [UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN]:
        return

    content = data.get("content", "").strip()
    if not content:
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
        ticket = result.scalar_one_or_none()
        if not ticket:
            return

        msg = Message(
            ticket_id=ticket_id,
            sender_type=SenderType.AGENT,
            sender_id=user.id,
            content=content,
        )
        db.add(msg)
        await db.flush()
        await db.refresh(msg)
        try:
            asyncio.create_task(sync_message_to_mongo(msg))
        except Exception:
            pass

        event = TicketEvent(
            ticket_id=ticket_id,
            event_type="AGENT_MESSAGE_SENT",
            description=f"Agent {user.name} sent a message",
            actor_id=user.id,
        )
        db.add(event)
        await db.commit()

    agent_payload = {
        "type": "agent_message",
        "id": msg.id,
        "content": content,
        "text": content,
        "speaker": "agent",
        "sender_type": "AGENT",
        "sender_name": user.name,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }
    await manager.broadcast(ticket_id, agent_payload)
    await voice_manager.broadcast(ticket_id, agent_payload)


async def handle_escalation_request(ws: WebSocket, ticket_id: int, data: dict, user: User):
    """Customer requests human escalation via WebSocket."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Ticket)
            .options(selectinload(Ticket.solution_attempts))
            .where(Ticket.id == ticket_id)
        )
        ticket = result.scalar_one_or_none()
        if not ticket:
            return

        await _trigger_escalation(db, ticket_id, ticket, data.get("reason", "Customer requested human agent"))
        await db.commit()

    await manager.broadcast(ticket_id, {
        "type": "escalation",
        "message": "You've been added to the human support queue. An agent will join shortly.",
        "status": "WAITING_FOR_AGENT",
    })


async def handle_agent_accept(ws: WebSocket, ticket_id: int, data: dict, user: User):
    """Agent accepts a ticket via WebSocket."""
    if not user or user.role not in [UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN]:
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Ticket)
            .options(
                selectinload(Ticket.customer),
                selectinload(Ticket.analyses),
                selectinload(Ticket.solution_attempts),
                selectinload(Ticket.messages),
            )
            .where(Ticket.id == ticket_id)
        )
        ticket = result.scalar_one_or_none()
        if not ticket:
            return

        ticket.assigned_agent_id = user.id
        ticket.status = TicketStatus.HUMAN_AGENT_ACTIVE

        event = TicketEvent(
            ticket_id=ticket_id,
            event_type="AGENT_JOINED",
            description=f"{user.name} accepted the ticket",
            actor_id=user.id,
        )
        db.add(event)

        sys_msg = Message(
            ticket_id=ticket_id,
            sender_type=SenderType.SYSTEM,
            content=f"✓ {user.name} has joined the conversation.",
        )
        db.add(sys_msg)

        # Generate handoff summary
        analyses = ticket.analyses
        latest_analysis = None
        if analyses:
            latest_analysis = {
                "sentiment_label": analyses[-1].sentiment_label,
                "intent_label": analyses[-1].intent_label,
                "urgency_label": analyses[-1].urgency_label,
                "escalation_risk_level": analyses[-1].escalation_risk_level,
                "escalation_risk_score": analyses[-1].escalation_risk_score,
                "recommended_action": analyses[-1].recommended_action,
            }

        customer_messages = [m.content for m in ticket.messages if m.sender_type == SenderType.CUSTOMER]
        last_customer_msg = customer_messages[-1] if customer_messages else "No messages"

        sol_dicts = [
            {"attempt_number": s.attempt_number, "solution_summary": s.solution_summary, "result": s.result}
            for s in ticket.solution_attempts
        ]

        handoff = ai_service.generate_handoff_summary(
            ticket_title=ticket.title,
            customer_name=ticket.customer.name if ticket.customer else "Customer",
            latest_analysis=latest_analysis,
            solution_attempts=sol_dicts,
            last_customer_message=last_customer_msg,
        )

        # Search KB for copilot
        articles = await get_knowledge_articles(db)
        kb_article = ai_service.search_knowledge_base(
            articles,
            latest_analysis.get("intent_label", "Other") if latest_analysis else "Other",
            ticket.title,
        )

        copilot = None
        if latest_analysis:
            copilot = ai_service.generate_agent_copilot(
                customer_name=ticket.customer.name if ticket.customer else "Customer",
                sentiment=latest_analysis.get("sentiment_label", "NEUTRAL"),
                intent=latest_analysis.get("intent_label", "Other"),
                urgency=latest_analysis.get("urgency_label", "MEDIUM"),
                last_customer_message=last_customer_msg,
                solution_attempts=sol_dicts,
                knowledge_article=kb_article,
            )

        await db.flush()
        await db.commit()

    # Broadcast agent joined to everyone
    joined_payload = {
        "type": "agent_joined",
        "agent_name": user.name,
        "status": "HUMAN_AGENT_ACTIVE",
        "message": f"✓ {user.name} has joined the conversation.",
    }
    await manager.broadcast(ticket_id, joined_payload)
    await voice_manager.broadcast(ticket_id, joined_payload)

    # Send handoff summary only to agent
    await manager.send_personal(ws, {
        "type": "handoff_summary",
        "summary": handoff,
        "copilot": copilot,
    })


async def handle_agent_resolve(ws: WebSocket, ticket_id: int, data: dict, user: User):
    """Agent resolves ticket via WebSocket."""
    if not user or user.role not in [UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN]:
        return

    from datetime import datetime
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
        ticket = result.scalar_one_or_none()
        if not ticket:
            return

        ticket.status = TicketStatus.RESOLVED
        ticket.resolved_at = datetime.utcnow()
        event = TicketEvent(
            ticket_id=ticket_id,
            event_type="TICKET_RESOLVED",
            description=f"Resolved by {user.name}",
            actor_id=user.id,
        )
        db.add(event)
        sys_msg = Message(
            ticket_id=ticket_id,
            sender_type=SenderType.SYSTEM,
            content="Your support agent has marked this issue as resolved. Was your issue successfully resolved?",
        )
        db.add(sys_msg)
        await db.commit()

    resolve_payload = {
        "type": "ticket_resolved",
        "status": "RESOLVED",
        "message": f"Resolved by {user.name}",
        "show_satisfaction": True,
    }
    await manager.broadcast(ticket_id, resolve_payload)
    await manager.broadcast(ticket_id, {
        "type": "ticket_status",
        "status": "RESOLVED",
    })
    await voice_manager.broadcast(ticket_id, {
        "type": "agent_resolved",
        "status": "RESOLVED",
        "message": f"Ticket has been resolved by {user.name}.",
    })


async def handle_customer_feedback(ws: WebSocket, ticket_id: int, data: dict, user: User):
    """Customer provides satisfaction feedback."""
    resolved = data.get("resolved", False)
    rating = data.get("rating")

    from datetime import datetime
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
        ticket = result.scalar_one_or_none()
        if not ticket:
            return

        ticket.was_resolved = resolved
        ticket.satisfaction_rating = rating

        if resolved:
            ticket.status = TicketStatus.CLOSED
            ticket.closed_at = datetime.utcnow()
            event_type = "TICKET_CLOSED"
            msg_content = "Thank you! Your ticket has been closed. We're glad we could help! 🎉"
        else:
            ticket.status = TicketStatus.REOPENED
            event_type = "TICKET_REOPENED"
            msg_content = "We're sorry the issue wasn't resolved. Your ticket has been reopened and will be reviewed again."

        event = TicketEvent(ticket_id=ticket_id, event_type=event_type)
        db.add(event)
        sys_msg = Message(ticket_id=ticket_id, sender_type=SenderType.SYSTEM, content=msg_content)
        db.add(sys_msg)
        await db.commit()

    await manager.broadcast(ticket_id, {
        "type": "ticket_status",
        "status": ticket.status.value,
        "message": msg_content,
    })


async def _send_copilot_to_agent(db: AsyncSession, ticket_id: int, ticket: Ticket, customer_message: str):
    """Send AI copilot suggestions privately to the agent."""
    if not ticket.assigned_agent_id:
        return

    articles = await get_knowledge_articles(db)
    analyses = ticket.analyses
    latest = analyses[-1] if analyses else None

    if not latest:
        return

    kb_article = ai_service.search_knowledge_base(
        articles, latest.intent_label or "Other", customer_message
    )
    sol_dicts = [
        {"attempt_number": s.attempt_number, "solution_summary": s.solution_summary, "result": s.result}
        for s in ticket.solution_attempts
    ]
    copilot = ai_service.generate_agent_copilot(
        customer_name=ticket.customer.name if ticket.customer else "Customer",
        sentiment=latest.sentiment_label or "NEUTRAL",
        intent=latest.intent_label or "Other",
        urgency=latest.urgency_label or "MEDIUM",
        last_customer_message=customer_message,
        solution_attempts=sol_dicts,
        knowledge_article=kb_article,
    )

    # Find agent's websocket and send privately
    if ticket_id in manager.connections:
        for ws, uid in manager.ws_users.items():
            if uid == ticket.assigned_agent_id and ws in manager.connections.get(ticket_id, set()):
                await manager.send_personal(ws, {
                    "type": "copilot_update",
                    "copilot": copilot,
                })
                break


# ─────────────────────────────────────────────────────────────
# VOICE WEBSOCKET ENDPOINT (/ws/voice/{ticket_id})
# ─────────────────────────────────────────────────────────────

class VoiceConnectionManager:
    def __init__(self):
        self.connections: Dict[int, Set[WebSocket]] = {}
        self.ws_users: Dict[WebSocket, int] = {}
        self.active_sessions: Dict[int, int] = {}  # ticket_id -> voice_session_id
        self.ai_speaking_state: Dict[int, bool] = {}

    async def connect(self, ticket_id: int, ws: WebSocket, user_id: int = None):
        await ws.accept()
        if ticket_id not in self.connections:
            self.connections[ticket_id] = set()
        self.connections[ticket_id].add(ws)
        if user_id:
            self.ws_users[ws] = user_id
        logger.info(f"Voice WebSocket connected: ticket={ticket_id}, user={user_id}")

    def disconnect(self, ticket_id: int, ws: WebSocket):
        if ticket_id in self.connections:
            self.connections[ticket_id].discard(ws)
            if not self.connections[ticket_id]:
                del self.connections[ticket_id]
        self.ws_users.pop(ws, None)

    async def broadcast(self, ticket_id: int, message: dict, exclude: WebSocket = None):
        if ticket_id in self.connections:
            disconnected = set()
            for ws in self.connections[ticket_id].copy():
                if ws == exclude:
                    continue
                try:
                    await ws.send_json(message)
                except Exception:
                    disconnected.add(ws)
            for ws in disconnected:
                self.disconnect(ticket_id, ws)

    async def send_personal(self, ws: WebSocket, message: dict):
        try:
            await ws.send_json(message)
        except Exception as e:
            logger.error(f"Failed to send personal voice message: {e}")


voice_manager = VoiceConnectionManager()


@router.websocket("/ws/voice/{ticket_id}")
async def voice_websocket_endpoint(
    websocket: WebSocket,
    ticket_id: int,
    token: str = Query(None),
):
    """
    Dedicated real-time AI Voice WebSocket endpoint.
    Handles:
    - voice_start
    - audio_chunk (streaming PCM / VAD)
    - speech_start (barge-in interruption)
    - partial_transcript (live streaming text)
    - final_transcript (AI reasoning, solution attempt, voice response)
    - interrupt (barge-in cancel)
    - request_human (escalation)
    - call_end
    """
    # Authenticate
    user = None
    if token:
        payload = decode_access_token(token)
        if payload:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(User).where(User.id == int(payload.get("sub", 0))))
                user = result.scalar_one_or_none()

    await voice_manager.connect(ticket_id, websocket, user.id if user else None)

    try:
        # Acknowledge connection
        await voice_manager.send_personal(websocket, {
            "type": "connected",
            "message": "Connected to SupportAI Voice Gateway",
            "ticket_id": ticket_id,
        })

        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "voice_start":
                await handle_voice_start(websocket, ticket_id, data, user)

            elif msg_type == "audio_chunk":
                await handle_voice_audio_chunk(websocket, ticket_id, data)

            elif msg_type == "speech_start":
                # Customer began speaking -> trigger barge-in / interrupt AI speech
                voice_manager.ai_speaking_state[ticket_id] = False
                await voice_manager.broadcast(ticket_id, {
                    "type": "speech_start",
                    "speaker": "customer",
                })
                # Alert chat room
                await manager.broadcast(ticket_id, {
                    "type": "typing",
                    "sender": "customer (voice)",
                })

            elif msg_type == "partial_transcript":
                # Stream partial speech to both voice and text channels
                text = data.get("text", "")
                await voice_manager.broadcast(ticket_id, {
                    "type": "partial_transcript",
                    "text": text,
                    "speaker": "customer",
                }, exclude=websocket)

            elif msg_type == "final_transcript":
                await handle_voice_final_transcript(websocket, ticket_id, data, user)

            elif msg_type == "interrupt":
                # Explicit customer barge-in click
                voice_manager.ai_speaking_state[ticket_id] = False
                await voice_manager.broadcast(ticket_id, {
                    "type": "ai_interrupted",
                    "message": "Customer interrupted AI",
                })

            elif msg_type in ["request_human", "escalate"]:
                await handle_voice_escalation(websocket, ticket_id, data, user)

            elif msg_type == "call_end":
                await handle_voice_call_end(websocket, ticket_id, data)

            elif msg_type == "ping":
                await voice_manager.send_personal(websocket, {"type": "pong"})

    except WebSocketDisconnect:
        voice_manager.disconnect(ticket_id, websocket)
        logger.info(f"Voice WebSocket disconnected: ticket={ticket_id}")
    except Exception as e:
        logger.error(f"Voice WebSocket error: {e}")
        voice_manager.disconnect(ticket_id, websocket)


async def handle_voice_start(ws: WebSocket, ticket_id: int, data: dict, user: Optional[User]):
    """Initialize or bind voice session."""
    language = data.get("language", "en-US")
    async with AsyncSessionLocal() as db:
        session = await voice_session_service.create_session(db, ticket_id, language)
        voice_manager.active_sessions[ticket_id] = session.id

        await voice_manager.send_personal(ws, {
            "type": "voice_start",
            "session_id": session.id,
            "ticket_id": ticket_id,
            "language": language,
            "recording_enabled": session.recording_enabled,
        })

        # Broadcast to main chat so agents know voice support is active
        await manager.broadcast(ticket_id, {
            "type": "system",
            "message": f"Customer started AI Voice Call session (#{session.id}).",
        })


async def handle_voice_audio_chunk(ws: WebSocket, ticket_id: int, data: dict):
    """Process incoming audio metrics / VAD."""
    pcm_base64 = data.get("data")
    if not pcm_base64:
        return

    import base64
    try:
        raw_pcm = base64.b64decode(pcm_base64)
        vad = audio_service.detect_voice_activity(raw_pcm)

        await voice_manager.send_personal(ws, {
            "type": "vad_status",
            "has_speech": vad["has_speech"],
            "is_silence": vad["is_silence"],
            "is_low_volume": vad["is_low_volume"],
            "volume_percentage": vad["volume_percentage"],
        })
    except Exception as e:
        logger.debug(f"Audio chunk decoding error: {e}")


async def handle_voice_final_transcript(ws: WebSocket, ticket_id: int, data: dict, user: Optional[User]):
    """Process customer voice input with AI reasoning and generate voice response."""
    raw_text = data.get("text", "").strip()
    confidence = float(data.get("confidence", 0.95))
    session_id = voice_manager.active_sessions.get(ticket_id, 0)

    if not raw_text:
        return

    # 1. Clean transcript
    clean_text = stt_service.clean_transcript(raw_text)

    async with AsyncSessionLocal() as db:
        # Load ticket with relationships
        result = await db.execute(
            select(Ticket)
            .where(Ticket.id == ticket_id)
            .options(
                selectinload(Ticket.messages),
                selectinload(Ticket.analyses),
                selectinload(Ticket.solution_attempts),
                selectinload(Ticket.customer),
            )
        )
        ticket = result.scalar_one_or_none()
        if not ticket:
            return

        # 2. Store customer voice transcript
        if session_id:
            await voice_session_service.add_transcript(
                db=db,
                session_id=session_id,
                ticket_id=ticket_id,
                speaker=VoiceSpeakerType.CUSTOMER,
                text=clean_text,
                confidence=confidence,
                is_final=True,
            )

        # 3. Save as Message in ticket history
        msg = Message(
            ticket_id=ticket_id,
            sender_type=SenderType.CUSTOMER,
            sender_id=user.id if user else ticket.customer_id,
            content=clean_text,
        )
        db.add(msg)
        await db.commit()
        await db.refresh(msg)
        try:
            asyncio.create_task(sync_message_to_mongo(msg))
        except Exception:
            pass

        # 4. Broadcast customer transcript to both Voice and Text WebSockets
        customer_payload = {
            "type": "final_transcript",
            "id": msg.id,
            "speaker": "customer",
            "text": clean_text,
            "confidence": confidence,
            "created_at": msg.created_at.isoformat() if msg.created_at else None,
        }
        await voice_manager.broadcast(ticket_id, customer_payload)
        await manager.broadcast(ticket_id, {
            "type": "customer_message",
            "id": msg.id,
            "sender_type": "CUSTOMER",
            "sender_name": user.name if user else "Customer",
            "content": clean_text,
            "created_at": msg.created_at.isoformat() if msg.created_at else None,
        })

        # If human agent is already connected, don't generate automated AI speech
        if ticket.status == TicketStatus.HUMAN_AGENT_ACTIVE:
            await _send_copilot_to_agent(db, ticket_id, ticket, clean_text)
            await db.commit()
            return

        # 5. Emit AI Thinking indicator
        await voice_manager.broadcast(ticket_id, {"type": "ai_thinking", "is_thinking": True})
        await manager.broadcast(ticket_id, {"type": "ai_typing", "is_typing": True})

        # 6. Conversation history for context
        conv_history = [
            {"sender_type": m.sender_type.value, "content": m.content}
            for m in ticket.messages
        ]
        failed_solutions = [
            s.solution_summary for s in ticket.solution_attempts if s.result == "FAILED"
        ]

        # Knowledge article search
        articles = await get_knowledge_articles(db)
        kb_article = ai_service.search_knowledge_base(articles, "Technical Issue", clean_text)

        # 7. Process voice with Voice AI reasoning (Groq LLM)
        result_ai = await voice_ai_service.process_customer_voice_async(
            transcript=clean_text,
            confidence=confidence,
            ticket_title=ticket.title,
            ticket_description=ticket.description,
            conversation_history=conv_history,
            ai_attempt_count=ticket.ai_attempt_count,
            failed_solutions=failed_solutions,
            knowledge_article=kb_article,
        )

        # 8. Save analysis
        analysis_data = result_ai["analysis"]
        analysis_record = AIAnalysis(
            ticket_id=ticket_id,
            sentiment_label=analysis_data["sentiment"]["label"],
            sentiment_score=analysis_data["sentiment"]["score"],
            intent_label=analysis_data["intent"]["label"],
            intent_score=analysis_data["intent"]["score"],
            urgency_label=analysis_data["urgency"]["label"],
            urgency_score=analysis_data["urgency"]["score"],
            escalation_risk_level=analysis_data["escalation_risk"]["level"],
            escalation_risk_score=analysis_data["escalation_risk"]["score"],
            key_issue=clean_text[:300],
            recommended_action=result_ai["solution_summary"],
        )
        db.add(analysis_record)

        # Record solution attempt
        ticket.ai_attempt_count += 1
        sol_attempt = SolutionAttempt(
            ticket_id=ticket_id,
            attempt_number=ticket.ai_attempt_count,
            solution_summary=result_ai["solution_summary"],
            result="PENDING",
        )
        db.add(sol_attempt)
        await db.commit()

        # Check escalation trigger
        if result_ai["is_escalation"]:
            await _trigger_escalation(
                db, ticket_id, ticket, result_ai.get("solution_summary") or "Customer requested human escalation during voice call"
            )
            await voice_manager.broadcast(ticket_id, {
                "type": "escalation",
                "status": "WAITING_FOR_AGENT",
                "message": "Connecting you to a human support agent. Please stay on the line.",
            })

        # 9. Save AI response message
        ai_msg = Message(
            ticket_id=ticket_id,
            sender_type=SenderType.AI,
            content=result_ai["raw_response"],
        )
        db.add(ai_msg)
        await db.commit()
        await db.refresh(ai_msg)
        try:
            asyncio.create_task(sync_message_to_mongo(ai_msg))
        except Exception:
            pass

        # 10. Store AI voice transcript
        if session_id:
            await voice_session_service.add_transcript(
                db=db,
                session_id=session_id,
                ticket_id=ticket_id,
                speaker=VoiceSpeakerType.AI,
                text=result_ai["spoken_response"],
                confidence=1.0,
                is_final=True,
            )

        # 11. Prepare TTS
        tts_meta = tts_service.synthesize_speech(result_ai["spoken_response"])
        voice_manager.ai_speaking_state[ticket_id] = True

        # 12. Broadcast AI Response & TTS Events
        await voice_manager.broadcast(ticket_id, {"type": "ai_thinking", "is_thinking": False})
        await manager.broadcast(ticket_id, {"type": "ai_typing", "is_typing": False})

        ai_voice_payload = {
            "type": "ai_response",
            "id": ai_msg.id,
            "speaker": "ai",
            "text": result_ai["raw_response"],
            "spoken_text": result_ai["spoken_response"],
            "tts": tts_meta,
            "created_at": ai_msg.created_at.isoformat() if ai_msg.created_at else None,
        }
        await voice_manager.broadcast(ticket_id, ai_voice_payload)

        # Also emit to text chat channel
        await manager.broadcast(ticket_id, {
            "type": "ai_message",
            "id": ai_msg.id,
            "sender_type": "AI",
            "sender_name": "SupportAI",
            "content": result_ai["raw_response"],
            "created_at": ai_msg.created_at.isoformat() if ai_msg.created_at else None,
        })

        # Update Agent Copilot privately if human agent is assigned
        await _send_copilot_to_agent(db, ticket_id, ticket, clean_text)


async def handle_voice_escalation(ws: WebSocket, ticket_id: int, data: dict, user: Optional[User]):
    """Handle explicit escalation request from voice interface."""
    reason = data.get("reason", "Customer requested human agent during voice call")
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
        ticket = result.scalar_one_or_none()
        if not ticket:
            return

        await _trigger_escalation(db, ticket_id, ticket, reason)


async def handle_voice_call_end(ws: WebSocket, ticket_id: int, data: dict):
    """Terminate voice session."""
    session_id = voice_manager.active_sessions.pop(ticket_id, None)
    if not session_id:
        session_id = data.get("session_id")

    duration = 0
    if session_id:
        async with AsyncSessionLocal() as db:
            ended_session = await voice_session_service.end_session(
                db=db,
                session_id=session_id,
                status=VoiceSessionStatus.ENDED,
                metrics=data.get("metrics"),
            )
            if ended_session:
                duration = ended_session.duration

    end_payload = {
        "type": "call_end",
        "ticket_id": ticket_id,
        "session_id": session_id,
        "duration": duration,
        "message": "Voice call concluded successfully.",
    }
    await voice_manager.broadcast(ticket_id, end_payload)
    await manager.broadcast(ticket_id, {
        "type": "system",
        "message": f"AI Voice Call ended (Duration: {duration}s).",
    })

