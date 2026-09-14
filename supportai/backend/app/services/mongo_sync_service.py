"""
SupportAI — MongoDB Data Sync & Persistence Service
Persists and mirrors SupportAI entities (users, tickets, messages, voice, knowledge)
into MongoDB Atlas document collections with high reliability and zero downtime.
"""
import logging
from datetime import datetime
from typing import Optional, Dict, Any
from app.database.mongodb import get_mongo_db

logger = logging.getLogger(__name__)


def _to_iso(dt) -> Optional[str]:
    """Convert datetime object or string to ISO-8601 string."""
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.isoformat()
    return str(dt)


def _clean_doc(data: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure dictionary values are JSON / BSON serializable."""
    clean = {}
    for k, v in data.items():
        if isinstance(v, datetime):
            clean[k] = v.isoformat()
        elif hasattr(v, "value"):  # Enums
            clean[k] = str(v.value)
        else:
            clean[k] = v
    return clean


async def sync_user_to_mongo(user) -> bool:
    """Upsert user document into MongoDB Atlas."""
    mongo = get_mongo_db()
    if mongo is None or user is None:
        return False
    try:
        doc = {
            "id": getattr(user, "id", None),
            "email": getattr(user, "email", None),
            "name": getattr(user, "name", None),
            "role": str(getattr(user, "role", "")),
            "is_active": getattr(user, "is_active", True),
            "is_online": getattr(user, "is_online", False),
            "created_at": _to_iso(getattr(user, "created_at", None)),
            "updated_at": _to_iso(getattr(user, "updated_at", None)),
        }
        await mongo.users.update_one(
            {"id": doc["id"]},
            {"$set": _clean_doc(doc)},
            upsert=True,
        )
        return True
    except Exception as e:
        logger.warning(f"Failed to sync user #{getattr(user, 'id', '?')} to MongoDB: {e}")
        return False


async def sync_ticket_to_mongo(ticket) -> bool:
    """Upsert ticket document into MongoDB Atlas."""
    mongo = get_mongo_db()
    if mongo is None or ticket is None:
        return False
    try:
        status_val = getattr(ticket, "status", None)
        if hasattr(status_val, "value"):
            status_val = status_val.value

        priority_val = getattr(ticket, "priority", None)
        if hasattr(priority_val, "value"):
            priority_val = priority_val.value

        category_val = getattr(ticket, "category", None)
        if hasattr(category_val, "value"):
            category_val = category_val.value

        doc = {
            "id": getattr(ticket, "id", None),
            "public_token": getattr(ticket, "public_token", None),
            "customer_id": getattr(ticket, "customer_id", None),
            "assigned_agent_id": getattr(ticket, "assigned_agent_id", None),
            "title": getattr(ticket, "title", None),
            "description": getattr(ticket, "description", None),
            "category": str(category_val) if category_val else None,
            "priority": str(priority_val) if priority_val else None,
            "status": str(status_val) if status_val else None,
            "order_id": getattr(ticket, "order_id", None),
            "ai_attempt_count": getattr(ticket, "ai_attempt_count", 0),
            "escalation_reason": getattr(ticket, "escalation_reason", None),
            "escalation_risk": getattr(ticket, "escalation_risk", 0.0),
            "satisfaction_rating": getattr(ticket, "satisfaction_rating", None),
            "resolution_summary": getattr(ticket, "resolution_summary", None),
            "created_at": _to_iso(getattr(ticket, "created_at", None)),
            "updated_at": _to_iso(getattr(ticket, "updated_at", None)),
            "synced_at": datetime.utcnow().isoformat(),
        }

        # Include customer details if loaded
        customer = getattr(ticket, "customer", None)
        if customer:
            doc["customer"] = {
                "id": getattr(customer, "id", None),
                "name": getattr(customer, "name", None),
                "email": getattr(customer, "email", None),
            }

        # Include assigned agent details if loaded
        agent = getattr(ticket, "assigned_agent", None)
        if agent:
            doc["assigned_agent"] = {
                "id": getattr(agent, "id", None),
                "name": getattr(agent, "name", None),
                "email": getattr(agent, "email", None),
            }

        await mongo.tickets.update_one(
            {"id": doc["id"]},
            {"$set": _clean_doc(doc)},
            upsert=True,
        )
        return True
    except Exception as e:
        logger.warning(f"Failed to sync ticket #{getattr(ticket, 'id', '?')} to MongoDB: {e}")
        return False


async def sync_message_to_mongo(msg) -> bool:
    """Upsert chat message document into MongoDB Atlas."""
    mongo = get_mongo_db()
    if mongo is None or msg is None:
        return False
    try:
        sender_type_val = getattr(msg, "sender_type", None)
        if hasattr(sender_type_val, "value"):
            sender_type_val = sender_type_val.value

        doc = {
            "id": getattr(msg, "id", None),
            "ticket_id": getattr(msg, "ticket_id", None),
            "sender_type": str(sender_type_val) if sender_type_val else "customer",
            "sender_id": getattr(msg, "sender_id", None),
            "content": getattr(msg, "content", ""),
            "is_internal": getattr(msg, "is_internal", False),
            "created_at": _to_iso(getattr(msg, "created_at", None)),
            "synced_at": datetime.utcnow().isoformat(),
        }
        await mongo.messages.update_one(
            {"id": doc["id"]},
            {"$set": _clean_doc(doc)},
            upsert=True,
        )
        return True
    except Exception as e:
        logger.warning(f"Failed to sync message #{getattr(msg, 'id', '?')} to MongoDB: {e}")
        return False


async def sync_voice_session_to_mongo(session) -> bool:
    """Upsert voice session document into MongoDB Atlas."""
    mongo = get_mongo_db()
    if mongo is None or session is None:
        return False
    try:
        session_pk = getattr(session, "id", None)
        sess_uuid = getattr(session, "session_id", None) or f"sess_{session_pk}"
        status_val = getattr(session, "status", "active")
        if hasattr(status_val, "value"):
            status_val = status_val.value

        doc = {
            "id": session_pk,
            "ticket_id": getattr(session, "ticket_id", None),
            "session_id": sess_uuid,
            "user_id": getattr(session, "user_id", None),
            "status": str(status_val),
            "started_at": _to_iso(getattr(session, "started_at", None)),
            "ended_at": _to_iso(getattr(session, "ended_at", None)),
            "duration": getattr(session, "duration", 0),
            "language": getattr(session, "language", "en-US"),
            "synced_at": datetime.utcnow().isoformat(),
        }
        filter_query = {"id": session_pk} if session_pk else {"session_id": sess_uuid}
        await mongo.voice_sessions.update_one(
            filter_query,
            {"$set": _clean_doc(doc)},
            upsert=True,
        )
        return True
    except Exception as e:
        logger.warning(f"Failed to sync voice session to MongoDB: {e}")
        return False


async def sync_voice_transcript_to_mongo(transcript) -> bool:
    """Insert or upsert voice transcript entry into MongoDB Atlas."""
    mongo = get_mongo_db()
    if mongo is None or transcript is None:
        return False
    try:
        doc = {
            "id": getattr(transcript, "id", None),
            "ticket_id": getattr(transcript, "ticket_id", None),
            "voice_session_id": getattr(transcript, "voice_session_id", None),
            "speaker": getattr(transcript, "speaker", "customer"),
            "text": getattr(transcript, "text", ""),
            "confidence": getattr(transcript, "confidence", 1.0),
            "is_final": getattr(transcript, "is_final", True),
            "created_at": _to_iso(getattr(transcript, "created_at", None)),
            "synced_at": datetime.utcnow().isoformat(),
        }
        if doc["id"]:
            await mongo.voice_transcripts.update_one(
                {"id": doc["id"]},
                {"$set": _clean_doc(doc)},
                upsert=True,
            )
        else:
            await mongo.voice_transcripts.insert_one(_clean_doc(doc))
        return True
    except Exception as e:
        logger.warning(f"Failed to sync voice transcript to MongoDB: {e}")
        return False


async def sync_all_existing_data(async_session_factory) -> Dict[str, int]:
    """
    Initial migration utility:
    Reads all existing SQLite database records and syncs them to MongoDB Atlas.
    """
    mongo = get_mongo_db()
    if mongo is None:
        logger.warning("MongoDB not connected; skipping initial data sync.")
        return {}

    logger.info("Starting initial sync of SQLite data to MongoDB Atlas...")
    synced_counts = {
        "users": 0,
        "tickets": 0,
        "messages": 0,
        "knowledge_articles": 0,
        "voice_sessions": 0,
    }

    try:
        from sqlalchemy import select
        from app.models.user import User
        from app.models.ticket import Ticket
        from app.models.message import Message
        from app.models.knowledge_article import KnowledgeArticle
        from app.models.voice import VoiceSession

        async with async_session_factory() as session:
            # 1. Sync Users
            users_res = await session.execute(select(User))
            users = users_res.scalars().all()
            for u in users:
                if await sync_user_to_mongo(u):
                    synced_counts["users"] += 1

            # 2. Sync Tickets
            tickets_res = await session.execute(select(Ticket))
            tickets = tickets_res.scalars().all()
            for t in tickets:
                if await sync_ticket_to_mongo(t):
                    synced_counts["tickets"] += 1

            # 3. Sync Messages
            msgs_res = await session.execute(select(Message))
            msgs = msgs_res.scalars().all()
            for m in msgs:
                if await sync_message_to_mongo(m):
                    synced_counts["messages"] += 1

            # 4. Sync Knowledge Articles
            kb_res = await session.execute(select(KnowledgeArticle))
            articles = kb_res.scalars().all()
            for a in articles:
                try:
                    doc = {
                        "id": getattr(a, "id", None),
                        "title": getattr(a, "title", None),
                        "category": getattr(a, "category", None),
                        "problem_description": getattr(a, "problem_description", None),
                        "solution_steps": getattr(a, "solution_steps", None),
                        "keywords": getattr(a, "keywords", None),
                        "created_at": _to_iso(getattr(a, "created_at", None)),
                    }
                    await mongo.knowledge_articles.update_one(
                        {"id": doc["id"]},
                        {"$set": _clean_doc(doc)},
                        upsert=True,
                    )
                    synced_counts["knowledge_articles"] += 1
                except Exception as e:
                    logger.warning(f"Error syncing KB article #{getattr(a, 'id', '?')}: {e}")

            # 5. Sync Voice Sessions
            try:
                vs_res = await session.execute(select(VoiceSession))
                v_sessions = vs_res.scalars().all()
                for vs in v_sessions:
                    if await sync_voice_session_to_mongo(vs):
                        synced_counts["voice_sessions"] += 1
            except Exception:
                pass

            # 6. Sync Voice Transcripts
            try:
                from app.models.voice import VoiceTranscript
                vt_res = await session.execute(select(VoiceTranscript))
                transcripts = vt_res.scalars().all()
                for vt in transcripts:
                    if await sync_voice_transcript_to_mongo(vt):
                        synced_counts["voice_transcripts"] = synced_counts.get("voice_transcripts", 0) + 1
            except Exception:
                pass

            # 7. Sync AI Analyses
            try:
                from app.models.analysis import AIAnalysis
                ai_res = await session.execute(select(AIAnalysis))
                analyses = ai_res.scalars().all()
                for a in analyses:
                    doc = {
                        "id": getattr(a, "id", None),
                        "ticket_id": getattr(a, "ticket_id", None),
                        "sentiment": getattr(a, "sentiment", None),
                        "sentiment_score": getattr(a, "sentiment_score", 0.0),
                        "intent": getattr(a, "intent", None),
                        "urgency": getattr(a, "urgency", None),
                        "escalation_risk": getattr(a, "escalation_risk", 0.0),
                        "key_issue": getattr(a, "key_issue", None),
                        "recommended_action": getattr(a, "recommended_action", None),
                        "created_at": _to_iso(getattr(a, "created_at", None)),
                        "synced_at": datetime.utcnow().isoformat(),
                    }
                    if doc["ticket_id"]:
                        await mongo.ai_analyses.update_one(
                            {"ticket_id": doc["ticket_id"]},
                            {"$set": _clean_doc(doc)},
                            upsert=True,
                        )
                        synced_counts["ai_analyses"] = synced_counts.get("ai_analyses", 0) + 1
            except Exception:
                pass

        logger.info(f"Initial MongoDB sync complete: {synced_counts}")
        return synced_counts

    except Exception as e:
        logger.error(f"Error during MongoDB initial sync: {e}")
        return synced_counts
