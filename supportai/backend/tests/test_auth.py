from app.utils.security import verify_password, get_password_hash, create_access_token, decode_access_token
from app.utils.token_generator import generate_support_token
import re

def test_password_hashing():
    raw = "supersecret123"
    hashed = get_password_hash(raw)
    assert verify_password(raw, hashed) is True
    assert verify_password("wrongpassword", hashed) is False

def test_jwt_token_generation_and_decoding():
    payload = {"sub": "42", "role": "CUSTOMER"}
    token = create_access_token(payload)
    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded.get("sub") == "42"

def test_support_token_format():
    token = generate_support_token()
    assert re.match(r"^SUP-\d{4}-[A-Z0-9]{6}$", token) is not None
    token2 = generate_support_token()
    assert token != token2
