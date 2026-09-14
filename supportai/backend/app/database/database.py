import logging
from app.config import settings

logger = logging.getLogger(__name__)

try:
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from sqlalchemy.orm import DeclarativeBase

    class Base(DeclarativeBase):
        pass

    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.ENVIRONMENT == "development",
        connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
    )

    AsyncSessionLocal = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
        autocommit=False,
    )

    async def get_db():
        async with AsyncSessionLocal() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    async def init_db():
        from app.models import user, ticket, message, analysis, knowledge_article, voice
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created successfully")

except ImportError:
    class Base:
        pass
    engine = None
    AsyncSessionLocal = None
    async def get_db():
        yield None
    async def init_db():
        pass
