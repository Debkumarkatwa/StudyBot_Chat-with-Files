import os

from dotenv import load_dotenv

load_dotenv()


class MissingEnvVarError(RuntimeError):
    """Raised when a required environment variable is missing or empty.
    Fails fast at import time instead of letting the app start with a
    silently wrong default that only surfaces later as a confusing bug
    (e.g. ALLOWED_ORIGINS defaulting to localhost in production, or
    EMBEDDING_PROVIDER silently loading the heavy local model)."""

    def __init__(self, var_name: str):
        super().__init__(
            f"Required environment variable '{var_name}' is missing or empty. "
            f"Set it in your .env file (see .env.sample)."
        )


def require_env(var_name: str) -> str:
    """Use for anything that legitimately differs between dev/test/prod,
    or is security-sensitive. No default — missing means the app refuses
    to start, loudly, instead of guessing."""
    value = os.getenv(var_name, "").strip()
    if not value:
        raise MissingEnvVarError(var_name)
    return value


def optional_env(var_name: str, default: str) -> str:
    """Use for tuning knobs that hold the same sensible value across every
    environment — safe to default if unset."""
    return os.getenv(var_name, default)


# ============================================================
# REQUIRED — differ between dev/test/prod, or security-sensitive.
# No default. Missing var = app refuses to start.
# ============================================================

DATABASE_URL: str = require_env("DATABASE_URL")

JWT_SECRET_KEY: str = require_env("JWT_SECRET_KEY")

SUPABASE_URL: str = require_env("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY: str = require_env("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_BUCKET_NAME: str = require_env("SUPABASE_BUCKET_NAME")

ALLOWED_ORIGINS: list[str] = [
    origin.strip() for origin in require_env("ALLOWED_ORIGINS").split(",") if origin.strip()
]

ALLOWED_MIME_TYPES: list[str] = [
    mime.strip() for mime in require_env("ALLOWED_MIME_TYPES").split(",") if mime.strip()
]

JINA_API_KEY: str = require_env("JINA_API_KEY")

GROQ_API_KEY: str = require_env("GROQ_API_KEY")
GROQ_MODEL_NAME: str = require_env("GROQ_MODEL_NAME")


# ============================================================
# OPTIONAL — same sensible value across every environment.
# Safe to default if unset.
# ============================================================

# Fixed bug: this used to read "MAX_FILE_SIZE_MB", a name that doesn't
# exist anywhere in .env.sample — .env could never override it.
MAX_FILE_SIZE: int = int(optional_env("MAX_FILE_SIZE_BYTES", "10485760"))  # 10 MB

MAX_ACTIVE_DOCUMENTS: int = int(optional_env("MAX_ACTIVE_DOCUMENTS", "3"))
MAX_BIN_DOCUMENTS: int = int(optional_env("MAX_BIN_DOCUMENTS", "5"))
RECYCLE_BIN_RETENTION_DAYS: int = int(optional_env("RECYCLE_BIN_RETENTION_DAYS", "7"))

CHUNK_SIZE_TOKENS: int = int(optional_env("CHUNK_SIZE_TOKENS", "400"))
CHUNK_OVERLAP_TOKENS: int = int(optional_env("CHUNK_OVERLAP_TOKENS", "50"))

CHAT_TOP_K: int = int(optional_env("CHAT_TOP_K", "5"))
CHAT_MAX_COSINE_DISTANCE: float = float(optional_env("CHAT_MAX_COSINE_DISTANCE", "0.8"))
CHAT_RETRIEVAL_CANDIDATES: int = int(
    optional_env("CHAT_RETRIEVAL_CANDIDATES", str(CHAT_TOP_K * 4))
)

HYBRID_MODE_ENABLED: bool = optional_env("HYBRID_MODE_ENABLED", "false").lower() == "true"

SQL_ECHO: bool = optional_env("SQL_ECHO", "false").lower() == "true"

# Moved out of jwt_utils.py — token lifetime is exactly the kind of thing
# you want short in a test environment, longer in prod.
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(optional_env("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS: int = int(optional_env("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
