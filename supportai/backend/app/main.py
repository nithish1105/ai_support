"""
SupportAI — FastAPI Application Entry Point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

import asyncio
from app.config import settings
from app.database.database import init_db, AsyncSessionLocal
from app.database.mongodb import connect_to_mongo, close_mongo_connection, check_mongo_health
from app.database.seed import seed
from app.services.ai_service import load_models
from app.services.mongo_sync_service import sync_all_existing_data
from app.api import auth, tickets, agents, analytics, knowledge_base, messages, websocket, voice

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown."""
    logger.info("Starting SupportAI backend...")

    # Initialize relational database
    await init_db()

    # Seed demo data
    await seed()

    # Initialize MongoDB Atlas connection
    try:
        await connect_to_mongo()
        # Initial background sync of SQLite data to MongoDB Atlas
        asyncio.create_task(sync_all_existing_data(AsyncSessionLocal))
    except Exception as e:
        logger.warning(f"MongoDB initialization notice: {e}")

    # Load AI models (non-blocking — uses fallback if unavailable)
    try:
        load_models()
    except Exception as e:
        logger.warning(f"AI model loading deferred: {e}")

    logger.info("SupportAI backend ready with MongoDB Atlas connected!")
    yield

    logger.info("SupportAI backend shutting down...")
    try:
        await close_mongo_connection()
    except Exception as e:
        logger.warning(f"Error closing MongoDB connection: {e}")


app = FastAPI(
    title="SupportAI API",
    description="AI-Powered Real-Time Customer Support Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(tickets.router)
app.include_router(agents.router)
app.include_router(analytics.router)
app.include_router(knowledge_base.router)
app.include_router(messages.router)
app.include_router(websocket.router)
app.include_router(voice.router)


@app.get("/")
async def root():
    return {
        "name": "SupportAI API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    mongo_status = await check_mongo_health()
    return {
        "status": "healthy",
        "database": "sqlite",
        "mongodb": mongo_status,
    }


@app.get("/api/database/status")
async def database_status():
    mongo_status = await check_mongo_health()
    return {
        "relational_database": {
            "type": "SQLite / SQLAlchemy async",
            "status": "healthy",
        },
        "mongodb": mongo_status,
    }
