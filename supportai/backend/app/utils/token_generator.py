import random
import string
from datetime import datetime


def generate_support_token() -> str:
    """Generate a unique support token in format SUP-YYYY-XXXXXX"""
    year = datetime.now().year
    chars = string.ascii_uppercase + string.digits
    random_part = "".join(random.choices(chars, k=6))
    return f"SUP-{year}-{random_part}"
