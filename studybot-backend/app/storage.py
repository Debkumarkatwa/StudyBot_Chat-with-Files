import os
import uuid

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_BUCKET_NAME = os.getenv("SUPABASE_BUCKET_NAME")

if not all([SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BUCKET_NAME]):
    raise ValueError("Supabase config missing. Check SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BUCKET_NAME in .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def build_storage_path(owner_id: uuid.UUID, filename: str) -> str:
    """
    Builds a unique, collision-safe storage path.
    Namespaced by owner_id so users' files never collide with each other,
    and prefixed with a random UUID so even the SAME user re-uploading
    a file with the same name never overwrites the original.
    """
    unique_prefix = uuid.uuid4().hex
    safe_filename = os.path.basename(filename).replace(" ", "_")
    return f"{owner_id}/{unique_prefix}_{safe_filename}"


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