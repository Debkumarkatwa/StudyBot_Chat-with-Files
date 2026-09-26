"""Regression checks for retrieval cutoff, candidate pooling, and scoping."""

import asyncio
import uuid
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy.dialects import postgresql

from app.config import CHAT_MAX_COSINE_DISTANCE, CHAT_RETRIEVAL_CANDIDATES, CHAT_TOP_K
from app.retrieval import retrieve_relevant_chunks


class RecordingSession:
    def __init__(self):
        self.statement = None

    async def execute(self, statement):
        self.statement = statement
        return SimpleNamespace(all=lambda: [])


async def run_checks():
    session = RecordingSession()
    selected_document_id = uuid.uuid4()

    with patch("app.retrieval.embed_query", return_value=[0.0] * 512):
        result = await retrieve_relevant_chunks(
            session,
            uuid.uuid4(),
            "What is the role of residual connections?",
            document_ids=[selected_document_id],
        )

    assert result == []
    sql = str(session.statement.compile(dialect=postgresql.dialect()))
    normalized_sql = " ".join(sql.split()).lower()
    compiled = session.statement.compile(dialect=postgresql.dialect())

    assert "owner_id" in normalized_sql
    assert "status" in normalized_sql
    assert "document_id" in normalized_sql
    assert "<=>" in normalized_sql
    assert normalized_sql.count("limit") >= 2
    assert CHAT_MAX_COSINE_DISTANCE in compiled.params.values()
    assert CHAT_RETRIEVAL_CANDIDATES in compiled.params.values()
    assert CHAT_TOP_K in compiled.params.values()
    print("PASSED: retrieval query keeps scoping, cutoff, candidate pool, and final top-K limits.")


if __name__ == "__main__":
    asyncio.run(run_checks())