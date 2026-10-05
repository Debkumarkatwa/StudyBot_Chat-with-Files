"""Regression test for retaining recycle-bin rows when storage deletion fails."""

import asyncio
import uuid

from fastapi import HTTPException
from sqlalchemy import delete, select

import app.routes.documents as documents_route
from app.database import AsyncSessionLocal
from app.models.document import Document, DocumentStatus
from app.models.user import User


async def main() -> None:
    user_id = uuid.uuid4()
    document_id = uuid.uuid4()
    email = f"storage-failure-{user_id.hex}@example.com"

    async with AsyncSessionLocal() as db:
        user = User(id=user_id, email=email, hashed_password="test-hash")
        db.add(user)
        await db.commit()

        document = Document(
            id=document_id,
            owner_id=user_id,
            filename="failed-delete.txt",
            file_type="text/plain",
            storage_path=f"test/{uuid.uuid4().hex}",
            file_size=1,
            status=DocumentStatus.deleted,
        )
        db.add(document)
        await db.commit()

        original_delete_file = documents_route.delete_file

        def fail_delete_file(storage_path: str) -> None:
            raise RuntimeError("simulated storage outage")

        documents_route.delete_file = fail_delete_file
        try:
            try:
                await documents_route.clear_bin(current_user=user, db=db)
            except HTTPException as error:
                assert error.status_code == 502
            else:
                raise AssertionError("clear_bin should report the simulated storage failure")

            result = await db.execute(select(Document).where(Document.id == document_id))
            retained = result.scalar_one_or_none()
            assert retained is not None
            assert retained.status == DocumentStatus.deleted
            print("PASS: failed storage deletion retains recycle-bin row for retry")
        finally:
            documents_route.delete_file = original_delete_file
            await db.execute(delete(Document).where(Document.id == document_id))
            await db.execute(delete(User).where(User.id == user_id))
            await db.commit()


if __name__ == "__main__":
    asyncio.run(main())
