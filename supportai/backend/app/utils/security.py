from datetime import datetime, timezone, timedelta
from typing import Optional
import json
import base64
import hmac
import hashlib
from app.config import settings

# Graceful passlib/jose imports with hashlib fallbacks
try:
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    _has_passlib = True
except ImportError:
    pwd_context = None
    _has_passlib = False

try:
    from jose import JWTError, jwt
    _has_jose = True
except ImportError:
    _has_jose = False


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if _has_passlib and pwd_context:
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            pass
    # Fallback to standard library pbkdf2
    try:
        parts = hashed_password.split("$")
        if len(parts) == 3 and parts[0] == "pbkdf2":
            salt = bytes.fromhex(parts[1])
            expected = bytes.fromhex(parts[2])
            computed = hashlib.pbkdf2_hmac("sha256", plain_password.encode(), salt, 100000)
            return hmac.compare_digest(expected, computed)
    except Exception:
        pass
    return plain_password == hashed_password


def get_password_hash(password: str) -> str:
    if _has_passlib and pwd_context:
        try:
            return pwd_context.hash(password)
        except Exception:
            pass
    # Fallback standard library pbkdf2
    import os
    salt = os.urandom(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)
    return f"pbkdf2${salt.hex()}${hashed.hex()}"


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})

    if _has_jose:
        return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.ALGORITHM)

    # Standard library fallback JWT encoder
    to_encode["exp"] = int(expire.timestamp())
    header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).decode().rstrip("=")
    payload = base64.urlsafe_b64encode(json.dumps(to_encode).encode()).decode().rstrip("=")
    signature = hmac.new(settings.JWT_SECRET.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    return f"{header}.{payload}.{sig_b64}"


def decode_access_token(token: str) -> Optional[dict]:
    if _has_jose:
        try:
            # Allow leeway for any clock drift
            return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM], options={"leeway": 60})
        except Exception as e:
            return None

    # Standard library fallback JWT decoder
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts

        # Verify signature
        expected_sig = hmac.new(settings.JWT_SECRET.encode(), f"{header_b64}.{payload_b64}".encode(), hashlib.sha256).digest()
        actual_sig = base64.urlsafe_b64decode(sig_b64 + "==")
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        payload_json = base64.urlsafe_b64decode(payload_b64 + "==").decode()
        payload = json.loads(payload_json)
        now_ts = int(datetime.now(timezone.utc).timestamp())
        if "exp" in payload and payload["exp"] < (now_ts - 60):
            return None
        return payload
    except Exception:
        return None
