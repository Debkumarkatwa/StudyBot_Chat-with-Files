"""Concurrent PostgreSQL regression test for the upload quota lock."""

import asyncio
import uuid

from sqlalchemy import delete, func, select

from app.config import MAX_ACTIVE_DOCUMENTS
from app.database import AsyncSessionLocal
from app.models.document import Document, DocumentStatus
from app.models.user import User


async def reserve_upload_slot(user_id: uuid.UUID) -> bool:
    async with AsyncSessionLocal() as db:
        await db.begin()
        await db.execute(select(User).where(User.id == user_id).with_for_update())
        result = await db.execute(
            select(func.count(Document.id)).where(
                Document.owner_id == user_id,
                Document.status.in_([DocumentStatus.processing, DocumentStatus.active]),
            )
        )
        if result.scalar_one() >= MAX_ACTIVE_DOCUMENTS:
            await db.rollback()
            return False

        db.add(
            Document(
                owner_id=user_id,
                filename=f"race-{uuid.uuid4().hex}.txt",
                file_type="text/plain",
                storage_path=f"test/{uuid.uuid4().hex}",
                file_size=1,
                status=DocumentStatus.processing,
            )
        )
        await db.commit()
        return True


async def main() -> None:
    user_id = uuid.uuid4()
    email = f"quota-race-{user_id.hex}@example.com"

    async with AsyncSessionLocal() as db:
        db.add(User(id=user_id, email=email, hashed_password="test-hash"))
        await db.commit()

    async with AsyncSessionLocal() as db:
        for index in range(MAX_ACTIVE_DOCUMENTS - 1):
            db.add(
                Document(
                    owner_id=user_id,
                    filename=f"existing-{index}.txt",
                    file_type="text/plain",
                    storage_path=f"test/{uuid.uuid4().hex}",
                    file_size=1,
                    status=DocumentStatus.active,
                )
            )
        await db.commit()

    try:
        accepted = await asyncio.gather(
            reserve_upload_slot(user_id),
            reserve_upload_slot(user_id),
        )
        assert sum(accepted) == 1, f"expected exactly one accepted upload, got {accepted}"
        print("PASS: concurrent quota check accepted exactly one upload")
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(Document).where(Document.owner_id == user_id))
            await db.execute(delete(User).where(User.id == user_id))
            await db.commit()


if __name__ == "__main__":
    try:
        asyncio.run(asyncio.wait_for(main(), timeout=15))
    except asyncio.TimeoutError as exc:
        raise SystemExit("Database test timed out after 15 seconds; check PostgreSQL connectivity.") from exc
