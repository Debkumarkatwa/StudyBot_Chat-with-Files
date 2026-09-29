import uuid
import os
import re
import unicodedata
from supabase import create_client, Client

from app.config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BUCKET_NAME, MAX_STORAGE_NAME_LEN

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def _safe_storage_name(filename: str | None) -> str:
    """Storage keys only contain [A-Za-z0-9._-]. The user's original
    filename is kept separately in the database for display."""
    name = (filename or "").replace("\\", "/").split("/")[-1].strip()
    name = unicodedata.normalize("NFKD", name)
    name = "".join(ch for ch in name if not unicodedata.combining(ch))
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name).lstrip(".")
    if not name:
        return "unnamed_file"
    if len(name) > MAX_STORAGE_NAME_LEN:
        base, ext = os.path.splitext(name)
        name = (base[: max(1, MAX_STORAGE_NAME_LEN - len(ext))] + ext)[:MAX_STORAGE_NAME_LEN]
    return name


def build_storage_path(owner_id: uuid.UUID, filename: str | None) -> str:
    """
    Builds a unique, collision-safe storage path.
    Namespaced by owner_id so users' files never collide with each other,
    and prefixed with a random UUID so even the SAME user re-uploading
    a file with the same name never overwrites the original.
    """
    unique_prefix = uuid.uuid4().hex
    return f"{owner_id}/{unique_prefix}_{_safe_storage_name(filename)}"

def upload_file(storage_path: str, file_bytes: bytes, content_type: str) -> None:
    """
    Uploads raw file bytes to the private Supabase bucket at storage_path.
    Raises an exception on failure — caller should handle/translate to a
    proper HTTP error.
    """
    supabase.storage.from_(SUPABASE_BUCKET_NAME).upload(
        path=storage_path,
        file=file_bytes,
        file_options={"content-type": content_type},
    )


def get_signed_url(storage_path: str, expires_in_seconds: int = 3600) -> str:
    """
    Generates a temporary, time-limited signed URL to access a private file.
    Since the bucket is private, this is the ONLY way to read a file back —
    there is no permanent public URL.
    """
    response = supabase.storage.from_(SUPABASE_BUCKET_NAME).create_signed_url(
        path=storage_path,
        expires_in=expires_in_seconds,
    )
    return response["signedURL"]


def delete_file(storage_path: str) -> None:
    """Permanently removes a file from storage. Used when a recycle-bin
    document's 7-day retention period expires."""
    supabase.storage.from_(SUPABASE_BUCKET_NAME).remove([storage_path])