import time

import httpx

from app.config import JINA_API_KEY

# jina-embeddings-v5-text-small: 677M params, 32K context, Qwen3-0.6B-Base backbone.
# Matryoshka output truncated to 512 dims here — NOT 384. Neither v3 nor v5
# officially support a 384-dim breakpoint (confirmed breakpoints: 32, 64, 128,
# 256, 512, 768, 1024). 512 was chosen over 256 because retrieval accuracy
# degrades noticeably below the 256 mark, and 512 keeps storage reasonable
# vs the full 1024.
#
# IMPORTANT: this dimension MUST match app/models/chunk.py's EMBEDDING_DIM
# and the DB column type (see the migration that bumps chunks.embedding to
# vector(512)). If you ever change this value, you also need a new Alembic
# migration + HNSW index rebuild — it is not a drop-in swap like the
# provider switch was.
_JINA_API_URL = "https://api.jina.ai/v1/embeddings"
_JINA_MODEL_NAME = "jina-embeddings-v5-text-small"
_EMBEDDING_DIM = 512
_JINA_BATCH_SIZE = 64
_JINA_MAX_RETRIES = 4
_RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}

_HEADERS = {
    "Authorization": f"Bearer {JINA_API_KEY}",
    "Content-Type": "application/json",
}

# httpx client reused across calls (connection pooling) instead of opening
# a new connection per request.
_client = httpx.Client(timeout=30.0)


def _request_embedding_batch(batch: list[str], task: str) -> list[list[float]]:
    payload = {
        "model": _JINA_MODEL_NAME,
        "task": task,
        "dimensions": _EMBEDDING_DIM,
        "input": batch,
    }

    for attempt in range(_JINA_MAX_RETRIES):
        try:
            response = _client.post(_JINA_API_URL, headers=_HEADERS, json=payload)
            if response.status_code in _RETRYABLE_STATUS_CODES:
                raise httpx.HTTPStatusError(
                    f"Jina responded with status {response.status_code}",
                    request=httpx.Request("POST", _JINA_API_URL),
                    response=response,
                )
            response.raise_for_status()
            data = response.json()

            sorted_items = sorted(data["data"], key=lambda item: item["index"])
            return [item["embedding"] for item in sorted_items]
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            if status_code in _RETRYABLE_STATUS_CODES and attempt < _JINA_MAX_RETRIES - 1:
                time.sleep(2 ** attempt)
                continue
            raise

    raise RuntimeError(f"Jina embedding request failed for {len(batch)} texts after {_JINA_MAX_RETRIES} attempts.")


def _call_jina(texts: list[str], task: str) -> list[list[float]]:
    if not texts:
        return []

    all_embeddings: list[list[float]] = []
    for start in range(0, len(texts), _JINA_BATCH_SIZE):
        batch = texts[start:start + _JINA_BATCH_SIZE]
        all_embeddings.extend(_request_embedding_batch(batch, task))
    return all_embeddings


def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Generates embeddings for a list of text chunks in one batched call.
    Returns a list of 512-dim float vectors, in the same order as `texts`.

    Use this for DOCUMENT chunks being stored. For search queries at
    retrieval time, use embed_query() instead — Jina uses a different
    task type for queries vs documents.
    """
    return _call_jina(texts, task="retrieval.passage")


def embed_query(query: str) -> list[float]:
    """
    Embeds a single user question for retrieval, using Jina's
    query-specific task type.
    """
    return _call_jina([query], task="retrieval.query")[0]