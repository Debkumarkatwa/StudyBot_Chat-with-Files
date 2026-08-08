import re

from transformers import AutoTokenizer

from app.config import CHUNK_SIZE_TOKENS, CHUNK_OVERLAP_TOKENS

# Loaded once at import time — reused for every chunking call.
# Same tokenizer the actual embedding model uses, so token counts here
# are exact, not estimated.
_tokenizer = AutoTokenizer.from_pretrained("BAAI/bge-small-en-v1.5")

# We only ever use this tokenizer to COUNT tokens (for chunk sizing decisions),
# never to feed oversized text directly into the model. Without this, HF's
# tokenizer warns on every paragraph over 512 tokens, assuming we're about
# to run it through the model directly — which we're not, so we silence it.
_tokenizer.model_max_length = int(1e9)


def count_tokens(text: str) -> int:
    return len(_tokenizer.encode(text, add_special_tokens=False))


def _split_into_paragraphs(text: str) -> list[str]:
    paragraphs = re.split(r"\n\s*\n", text)
    return [p.strip() for p in paragraphs if p.strip()]


def _split_into_sentences(text: str) -> list[str]:
    # Simple sentence splitter — good enough for study documents.
    # Not perfect (won't handle every abbreviation edge case), but doesn't
    # need to be: worst case a "sentence" is slightly mis-split, which
    # barely affects chunk quality.
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return [s.strip() for s in sentences if s.strip()]


def chunk_text(text: str) -> list[str]:
    """
    Recursively splits text into chunks targeting CHUNK_SIZE_TOKENS,
    with CHUNK_OVERLAP_TOKENS of overlap between consecutive chunks.

    Strategy: paragraphs first (natural semantic boundaries), falling
    back to sentence-level splitting if a paragraph alone exceeds the
    target chunk size.
    """
    paragraphs = _split_into_paragraphs(text)

    # Flatten into a list of "units" (paragraphs, or sentences if a
    # paragraph is too large on its own) that we'll then pack into chunks.
    units: list[str] = []
    for para in paragraphs:
        if count_tokens(para) <= CHUNK_SIZE_TOKENS:
            units.append(para)
        else:
            units.extend(_split_into_sentences(para))

    chunks: list[str] = []
    current_chunk_units: list[str] = []
    current_token_count = 0

    for unit in units:
        unit_tokens = count_tokens(unit)

        if current_token_count + unit_tokens > CHUNK_SIZE_TOKENS and current_chunk_units:
            # Current chunk is full — finalize it
            chunks.append(" ".join(current_chunk_units))

            # Build overlap: carry the last few units forward into the
            # next chunk until we've got roughly CHUNK_OVERLAP_TOKENS worth
            overlap_units: list[str] = []
            overlap_token_count = 0
            for prev_unit in reversed(current_chunk_units):
                prev_tokens = count_tokens(prev_unit)
                if overlap_token_count + prev_tokens > CHUNK_OVERLAP_TOKENS:
                    break
                overlap_units.insert(0, prev_unit)
                overlap_token_count += prev_tokens

            current_chunk_units = overlap_units
            current_token_count = overlap_token_count

        current_chunk_units.append(unit)
        current_token_count += unit_tokens

    if current_chunk_units:
        chunks.append(" ".join(current_chunk_units))

    return chunks