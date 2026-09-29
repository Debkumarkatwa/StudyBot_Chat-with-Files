"""Regression tests for Jina batch sizing and retry behavior."""

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

import app.embeddings_jina as embeddings_jina


class FakeResp:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                f"status {self.status_code}",
                request=httpx.Request("POST", "https://api.jina.ai/v1/embeddings"),
                response=httpx.Response(self.status_code, request=httpx.Request("POST", "https://api.jina.ai/v1/embeddings")),
            )

    def json(self):
        return self._payload


class FakeClient:
    def __init__(self):
        self.calls = []
        self.attempts = 0

    def post(self, url, headers, json):
        self.calls.append(json)
        self.attempts += 1

        if self.attempts == 1 and len(json["input"]) == 64:
            raise httpx.HTTPStatusError(
                "429",
                request=httpx.Request("POST", url),
                response=httpx.Response(429, request=httpx.Request("POST", url)),
            )

        if len(json["input"]) == 64:
            payload = {"data": [{"index": i, "embedding": [float(i)] * 512} for i in range(len(json["input"]))]}
        else:
            payload = {"data": [{"index": i, "embedding": [float(i)] * 512} for i in range(len(json["input"]))]}
        return FakeResp(200, payload)


def test_generate_embeddings_batches_and_retries():
    client = FakeClient()
    original_client = embeddings_jina._client
    embeddings_jina._client = client
    try:
        texts = [f"chunk-{i}" for i in range(65)]
        result = embeddings_jina.generate_embeddings(texts)
        assert len(result) == 65
        assert len(client.calls) >= 2
        assert all(len(call["input"]) <= 64 for call in client.calls)
        assert any(len(call["input"]) == 1 for call in client.calls)
    finally:
        embeddings_jina._client = original_client


if __name__ == "__main__":
    test_generate_embeddings_batches_and_retries()
    print("PASS: Jina batching and retry logic works")
