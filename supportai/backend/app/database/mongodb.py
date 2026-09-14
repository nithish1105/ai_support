"""
SupportAI — MongoDB Atlas Database Connection & Lifecycle Manager
Provides asynchronous Motor client, collection indexes, health checks, and database dependencies.
"""
import logging
import time
from typing import Optional, Dict, Any
from app.config import settings

logger = logging.getLogger(__name__)

# Global MongoDB client and database instances
mongo_client: Optional[Any] = None
mongo_db: Optional[Any] = None


def _get_clean_mongo_url() -> Optional[str]:
    """Clean MongoDB connection string (strip quotes and whitespace)."""
    raw_url = settings.MONGODB_URL
    if not raw_url:
        return None
    url = raw_url.strip().strip('"').strip("'")
    return url if url else None


async def connect_to_mongo():
    """Connect to MongoDB Atlas, test ping, and ensure collection indexes."""
    global mongo_client, mongo_db

    url = _get_clean_mongo_url()
    if not url:
        logger.warning("No MONGODB_URL configured. MongoDB integration will be inactive.")
        return None

    try:
        from motor.motor_asyncio import AsyncIOMotorClient

        logger.info("Connecting to MongoDB Atlas cluster...")
        # Initialize AsyncIOMotorClient with server selection timeout
        mongo_client = AsyncIOMotorClient(
            url,
            serverSelectionTimeoutMS=7000,
            connectTimeoutMS=7000,
            socketTimeoutMS=10000,
            maxPoolSize=20,
            minPoolSize=2,
            retryWrites=True,
            w="majority",
        )

        # Test connection with ping command
        start_time = time.perf_counter()
        ping_res = await mongo_client.admin.command("ping")
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        # Target database
        db_name = settings.MONGODB_DB_NAME or "supportai"
        mongo_db = mongo_client[db_name]

        logger.info(
            f"Connected to MongoDB Atlas successfully! (DB: '{db_name}', ping: {elapsed_ms}ms, ok: {ping_res.get('ok')})"
        )

        # Ensure collection indexes
        await _ensure_indexes(mongo_db)
        return mongo_db

    except Exception as e:
        logger.error(f"Failed to connect to MongoDB Atlas: {type(e).__name__} - {e}")
        mongo_client = None
        mongo_db = None
        return None


async def _ensure_indexes(db):
    """Create indexes for high performance queries and uniqueness."""
    try:
        # Users collection
        await db.users.create_index("id", unique=True, sparse=True)
        await db.users.create_index("email", unique=True, sparse=True)

        # Tickets collection
        await db.tickets.create_index("id", unique=True, sparse=True)
        await db.tickets.create_index("public_token", unique=True, sparse=True)
        await db.tickets.create_index("customer_id")
        await db.tickets.create_index("status")
        await db.tickets.create_index("created_at")

        # Messages collection
        await db.messages.create_index("id", unique=True, sparse=True)
        await db.messages.create_index([("ticket_id", 1), ("created_at", 1)])

        # AI Analyses collection
        await db.ai_analyses.create_index("ticket_id")

        # Voice Sessions & Transcripts
        await db.voice_sessions.create_index("session_id", unique=True, sparse=True)
        await db.voice_sessions.create_index("ticket_id")
        await db.voice_transcripts.create_index([("ticket_id", 1), ("voice_session_id", 1)])

        # Knowledge Articles
        await db.knowledge_articles.create_index("id", unique=True, sparse=True)
        await db.knowledge_articles.create_index("category")

        logger.info("MongoDB collection indexes verified successfully.")
    except Exception as e:
        logger.warning(f"Error ensuring MongoDB indexes: {e}")


async def close_mongo_connection():
    """Gracefully close MongoDB Atlas connection."""
    global mongo_client, mongo_db
    if mongo_client is not None:
        logger.info("Closing MongoDB Atlas connection...")
        mongo_client.close()
        mongo_client = None
        mongo_db = None
        logger.info("MongoDB connection closed.")


def get_mongo_db():
    """FastAPI dependency / helper to get MongoDB database instance."""
    return mongo_db


def get_mongo_client():
    """Get active AsyncIOMotorClient instance."""
    return mongo_client


async def check_mongo_health() -> Dict[str, Any]:
    """Check live MongoDB Atlas health, latency, and collection stats."""
    if mongo_client is None or mongo_db is None:
        return {
            "connected": False,
            "status": "disconnected",
            "message": "MongoDB client is not initialized or failed to connect",
        }

    try:
        start_time = time.perf_counter()
        ping_res = await mongo_client.admin.command("ping")
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

        collections = await mongo_db.list_collection_names()
        collection_counts = {}
        for coll_name in collections:
            try:
                count = await mongo_db[coll_name].count_documents({})
                collection_counts[coll_name] = count
            except Exception:
                collection_counts[coll_name] = 0

        return {
            "connected": True,
            "status": "healthy",
            "database": mongo_db.name,
            "latency_ms": latency_ms,
            "collections": collections,
            "document_counts": collection_counts,
            "total_collections": len(collections),
            "ping": ping_res,
        }
    except Exception as e:
        return {
            "connected": False,
            "status": "error",
            "error": f"{type(e).__name__}: {str(e)}",
        }
