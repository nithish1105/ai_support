import os
from typing import Optional

try:
    from pydantic_settings import BaseSettings
except ImportError:
    try:
        from pydantic import BaseSettings
    except ImportError:
        class BaseSettings:
            def __init__(self, **kwargs):
                for k, v in self.__class__.__dict__.items():
                    if not k.startswith("_") and not callable(v):
                        env_val = os.getenv(k)
                        if env_val is not None:
                            setattr(self, k, env_val)
                        else:
                            setattr(self, k, v)


class Settings(BaseSettings):
    # Database (Relational)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./supportai.db")

    # MongoDB Atlas Database
    MONGODB_URL: Optional[str] = (
        os.getenv("MONGODB_URL")
        or os.getenv("MONGODB_URI")
        or os.getenv("mongodb")
        or None
    )
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "supportai")

    # JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", "supersecretjwtkey2026supportai")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")

    # AI Models
    SENTIMENT_MODEL: str = os.getenv("SENTIMENT_MODEL", "distilbert-base-uncased-finetuned-sst-2-english")
    ZERO_SHOT_MODEL: str = os.getenv("ZERO_SHOT_MODEL", "facebook/bart-large-mnli")

    # App settings
    MAX_AI_ATTEMPTS: int = int(os.getenv("MAX_AI_ATTEMPTS", "3"))
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    BACKEND_URL: str = os.getenv("BACKEND_URL", "http://localhost:8000")

    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    USE_AI_MODELS: bool = os.getenv("USE_AI_MODELS", "true").lower() in ("true", "1")

    # Groq AI Integration
    GROQ_API_KEY: Optional[str] = os.getenv("GROQ_API_KEY", None)
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
    GROQ_WHISPER_MODEL: str = os.getenv("GROQ_WHISPER_MODEL", "whisper-large-v3-turbo")
    USE_GROQ: bool = os.getenv("USE_GROQ", "true").lower() in ("true", "1")

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
