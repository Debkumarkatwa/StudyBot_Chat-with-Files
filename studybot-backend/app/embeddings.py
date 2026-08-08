from sentence_transformers import SentenceTransformer

# Loaded once at import time — reused for every embedding call.
# First load will download the model (~130MB) from Hugging Face; cached
# locally after that, no repeated downloads.
_model = SentenceTransformer("BAAI/bge-small-en-v1.5")


def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Generates embeddings for a list of text chunks in one batched call —
    batching is significantly faster than embedding one chunk at a time.
    Returns a list of 384-dim float vectors, in the same order as `texts`.
    """
    # bge models recommend NOT using a special instruction prefix for
    # documents being stored (only for the search QUERY at retrieval time,
    # which we'll handle separately when we build the chat/search endpoint).
    embeddings = _model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
    return embeddings.tolist()