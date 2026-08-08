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

MAX_FILE_SIZE: int = int(os.getenv("MAX_FILE_SIZE_MB", '10485760')) # Default 10 MB

MAX_ACTIVE_DOCUMENTS: int = int(os.getenv("MAX_ACTIVE_DOCUMENTS", "3"))

RECYCLE_BIN_RETENTION_DAYS: int = int(os.getenv("RECYCLE_BIN_RETENTION_DAYS", "7"))

if not ALLOWED_MIME_TYPES:
    raise ValueError("ALLOWED_MIME_TYPES not set or empty in .env")

CHUNK_SIZE_TOKENS: int = int(os.getenv("CHUNK_SIZE_TOKENS", "400"))
CHUNK_OVERLAP_TOKENS: int = int(os.getenv("CHUNK_OVERLAP_TOKENS", "50"))