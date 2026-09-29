"""Regression tests for Groq error handling and empty-retrieval behavior."""

import os

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ.setdefault("SUPABASE_URL", "https://example.com")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-key")
os.environ.setdefault("SUPABASE_BUCKET_NAME", "test-bucket")
os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost")
os.environ.setdefault("ALLOWED_MIME_TYPES", "text/plain")
os.environ.setdefault("JINA_API_KEY", "test-jina-key")
os.environ.setdefault("GROQ_API_KEY", "test-groq-key")
os.environ.setdefault("GROQ_MODEL_NAME", "llama-3.1-8b")

import httpx

import app.llm as llm


class FakeCompletions:
    def __init__(self, *, should_error=False):
        self.calls = 0
        self.should_error = should_error

    def create(self, **kwargs):
        self.calls += 1
        if self.should_error:
            response = httpx.Response(503)
            raise httpx.HTTPStatusError("503 Service Unavailable", request=httpx.Request("POST", "https://api.groq.com"), response=response)
        class Choice:
            class Message:
                content = "Answer"
            choices = [type("Obj", (), {"message": Message()})()]
        return type("Resp", (), {"choices": Choice.choices})()


class FakeClient:
    def __init__(self, *, should_error=False):
        self.chat = type("Chat", (), {"completions": FakeCompletions(should_error=should_error)})()


async def test_generate_answer_skips_groq_when_no_context_and_hybrid_is_off():
    original_client = llm.client
    llm.client = FakeClient()
    try:
        answer = await llm.generate_answer("What is this?", [], False)
        assert answer == "I couldn't find this in your uploaded documents."
        assert llm.client.chat.completions.calls == 0
    finally:
        llm.client = original_client


async def test_generate_answer_returns_friendly_message_on_groq_503():
    original_client = llm.client
    llm.client = FakeClient(should_error=True)
    try:
        answer = await llm.generate_answer("What is this?", [("doc text", "alpha.pdf")], False)
        assert "Sorry" in answer or "temporarily" in answer.lower()
        assert llm.client.chat.completions.calls == 1
    finally:
        llm.client = original_client


def test_is_hybrid_answer_accepts_emoji_free_marker():
    answer = "This part is not from your uploaded documents:\nThe rest is general knowledge."
    assert llm.is_hybrid_answer(answer)
    assert llm.is_hybrid_answer("⚠️ This part is not from your uploaded documents:\nGeneral knowledge.")


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_generate_answer_skips_groq_when_no_context_and_hybrid_is_off())
    asyncio.run(test_generate_answer_returns_friendly_message_on_groq_503())
    test_is_hybrid_answer_accepts_emoji_free_marker()
    print("PASS: Groq empty-context and 503 handling works")
