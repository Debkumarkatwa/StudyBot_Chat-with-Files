"""
Two-user retrieval integration test. Needs the real database; no Jina call.

Run from the backend root:  python -m Test.test_retrieval
Exits non-zero on failure.
"""

import asyncio
import uuid
from unittest.mock import patch

from sqlalchemy import delete

from app.config import CHAT_MAX_COSINE_DISTANCE, CHAT_TOP_K
from app.database import AsyncSessionLocal
from app.models.chunk import Chunk, EMBEDDING_DIM
from app.models.document import Document, DocumentStatus
from app.models.user import User
from app.retrieval import retrieve_relevant_chunks


def vec(*head):
    v = [0.0] * EMBEDDING_DIM
    for i, x in enumerate(head):
        v[i] = float(x)
    return v


QUERY = vec(1, 0)
EXACT = vec(1, 0)   # cosine distance 0.0  (closest possible)
NEAR = vec(1, 1)    # cosine distance ~0.29 (inside the cutoff)
FAR = vec(0, 1)     # cosine distance 1.0  (outside the cutoff)


def make_doc(owner_id, name, status):
    return Document(
        id=uuid.uuid4(),
        owner_id=owner_id,
        filename=name,
        file_type="text/plain",
        storage_path=f"test/{uuid.uuid4()}/{name}",
        file_size=1,
        status=status,
    )


def make_chunks(doc_id, embedding, count, label):
    return [
        Chunk(
            id=uuid.uuid4(),
            document_id=doc_id,
            content=f"{label} {i}",
            embedding=embedding,
            chunk_index=i,
        )
        for i in range(count)
    ]


async def ask(user_id, document_ids=None):
    async with AsyncSessionLocal() as db:
        with patch("app.retrieval.embed_query", return_value=QUERY):
            rows = await retrieve_relevant_chunks(
                db, user_id, "test question", document_ids=document_ids
            )
    return [(chunk.content, filename) for chunk, filename in rows]


async def main():
    assert CHAT_MAX_COSINE_DISTANCE < 1.0, "test needs a cutoff below 1.0 to exclude FAR chunks"

    tag = uuid.uuid4().hex[:8]
    user_a = User(id=uuid.uuid4(), email=f"retr-a-{tag}@example.com", hashed_password="x", full_name="Retrieval A")
    user_b = User(id=uuid.uuid4(), email=f"retr-b-{tag}@example.com", hashed_password="x", full_name="Retrieval B")

    try:
        async with AsyncSessionLocal() as db:
            db.add_all([user_a, user_b])
            await db.commit()

            a1 = make_doc(user_a.id, "a1.txt", DocumentStatus.active)
            a2 = make_doc(user_a.id, "a2.txt", DocumentStatus.active)
            a_deleted = make_doc(user_a.id, "a_deleted.txt", DocumentStatus.deleted)
            a_failed = make_doc(user_a.id, "a_failed.txt", DocumentStatus.failed)
            a_processing = make_doc(user_a.id, "a_processing.txt", DocumentStatus.processing)
            b1 = make_doc(user_b.id, "b1.txt", DocumentStatus.active)
            db.add_all([a1, a2, a_deleted, a_failed, a_processing, b1])
            await db.commit()

            db.add_all(
                make_chunks(a1.id, NEAR, 3, "A1 near")
                + make_chunks(a2.id, NEAR, 3, "A2 near")
                + make_chunks(a1.id, FAR, 2, "A1 far")
                # Inactive docs with PERFECT matches: must never be returned.
                + make_chunks(a_deleted.id, EXACT, 3, "deleted")
                + make_chunks(a_failed.id, EXACT, 3, "failed")
                + make_chunks(a_processing.id, EXACT, 3, "processing")
                # Other user with far more, and closer, chunks than A.
                + make_chunks(b1.id, EXACT, 30, "B exact")
            )
            await db.commit()

        # 1. User A: only own active docs, still gets results, cutoff applied.
        rows = await ask(user_a.id)
        names = {name for _, name in rows}
        assert rows, "user A got no results even though A has matching chunks"
        assert names <= {"a1.txt", "a2.txt"}, f"user A saw unexpected docs: {names}"
        assert not any("far" in c for c, _ in rows), "chunk beyond the distance cutoff was returned"
        assert len(rows) == min(CHAT_TOP_K, 6), f"expected {min(CHAT_TOP_K, 6)} rows, got {len(rows)}"

        # 2. User B: sees only B's own chunks, never A's.
        rows = await ask(user_b.id)
        assert rows and {name for _, name in rows} == {"b1.txt"}, "user B saw a document that is not theirs"

        # 3. Selected-document filter narrows to that document.
        rows = await ask(user_a.id, [a2.id])
        assert rows and {name for _, name in rows} == {"a2.txt"}, "document selection was not respected"

        # 4. A cannot scope into B's document by passing its id.
        assert await ask(user_a.id, [b1.id]) == [], "user A retrieved user B's chunks via document_ids"

        # 5. Selecting a deleted / failed / processing doc returns nothing.
        for doc in (a_deleted, a_failed, a_processing):
            assert await ask(user_a.id, [doc.id]) == [], f"{doc.filename} should be excluded"

        print("PASSED: retrieval is scoped by owner, status, selection and cutoff.")
    finally:
        # FK cascade removes the documents and chunks too.
        async with AsyncSessionLocal() as db:
            await db.execute(delete(User).where(User.id.in_([user_a.id, user_b.id])))
            await db.commit()


if __name__ == "__main__":
    asyncio.run(main())