import os

from dotenv import load_dotenv

load_dotenv()

# Parsed once here, imported everywhere else that needs it —
# single source of truth, matches the CONFIG pattern already used
# in the frontend's config.js.
ALLOWED_MIME_TYPES: list[str] = [
    mime.strip()
    for mime in os.getenv("ALLOWED_MIME_TYPES", "").split(",")
    if mime.strip()
]

ALLOWED_ORIGINS: list[str] = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://127.0.0.1:5500,http://localhost:5500",
    ).split(",")
    if origin.strip()
]

MAX_FILE_SIZE: int = int(os.getenv("MAX_FILE_SIZE_MB", '10485760')) # Default 10 MB

MAX_ACTIVE_DOCUMENTS: int = int(os.getenv("MAX_ACTIVE_DOCUMENTS", "3"))

MAX_BIN_DOCUMENTS: int = int(os.getenv("MAX_BIN_DOCUMENTS", "5"))

RECYCLE_BIN_RETENTION_DAYS: int = int(os.getenv("RECYCLE_BIN_RETENTION_DAYS", "7"))

CHUNK_SIZE_TOKENS: int = int(os.getenv("CHUNK_SIZE_TOKENS", "400"))
CHUNK_OVERLAP_TOKENS: int = int(os.getenv("CHUNK_OVERLAP_TOKENS", "50"))

CHAT_TOP_K: int = int(os.getenv("CHAT_TOP_K", "5"))

# When False (v1 default): LLM answers ONLY from retrieved document chunks,
# and says so explicitly when the answer isn't found in them.
# When True (future): if retrieval doesn't have enough relevant context,
# the LLM may fall back to its own general knowledge — but MUST prefix
# that portion of the answer with a clear warning that it's not sourced
# from the user's documents. Built into the prompt logic now so flipping
# this later is a one-line env change, no code restructuring.
HYBRID_MODE_ENABLED: bool = os.getenv("HYBRID_MODE_ENABLED", "false").lower() == "true"

GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")

GROQ_MODEL_NAME = os.getenv("GROQ_MODEL_NAME", "")

if not GROQ_MODEL_NAME:
    raise ValueError("GROQ_MODEL_NAME not found. Check your .env file.")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found. Check your .env file.")

if not ALLOWED_MIME_TYPES:
    raise ValueError("ALLOWED_MIME_TYPES not set or empty in .env")