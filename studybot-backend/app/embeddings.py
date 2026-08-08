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

    Use this for DOCUMENT chunks being stored. For search queries at
    retrieval time, use embed_query() instead — bge-small was trained
    asymmetrically and expects different treatment for queries vs documents.
    """
    embeddings = _model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
    return embeddings.tolist()


# bge-small's officially recommended instruction prefix for search queries.
# Skipping this measurably hurts retrieval quality — the model was
# specifically trained with this asymmetry between queries and documents.
_QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: "


def embed_query(query: str) -> list[float]:
    """
    Embeds a single user question for retrieval. Applies bge's required
    query instruction prefix — do NOT use generate_embeddings() for this.
    """
    prefixed = _QUERY_INSTRUCTION + query
    embedding = _model.encode([prefixed], convert_to_numpy=True, normalize_embeddings=True)
    return embedding[0].tolist()