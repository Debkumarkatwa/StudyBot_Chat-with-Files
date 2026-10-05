import re
from pathlib import Path

from huggingface_hub.constants import HF_HUB_CACHE
from transformers import AutoTokenizer

from app.config import CHUNK_SIZE_TOKENS, CHUNK_OVERLAP_TOKENS


def _load_tokenizer():
    model_name = "BAAI/bge-small-en-v1.5"
    try:
        return AutoTokenizer.from_pretrained(model_name)
    except FileExistsError as error:
        model_cache = Path(HF_HUB_CACHE) / "models--BAAI--bge-small-en-v1.5" / "snapshots"
        snapshots = sorted(path for path in model_cache.iterdir() if path.is_dir())
        if not snapshots:
            raise error
        return AutoTokenizer.from_pretrained(str(snapshots[-1]), local_files_only=True)


# Loaded once at import time — reused for every chunking call.
# This tokenizer is used only for chunk-sizing estimates. The embedding
# provider is Jina, so these counts are not guaranteed to match its tokenizer.
_tokenizer = _load_tokenizer()

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


def _split_by_token_limit(text: str, max_tokens: int) -> list[str]:
    encoded = _tokenizer(
        text,
        add_special_tokens=False,
        return_offsets_mapping=True,
    )
    offsets = encoded["offset_mapping"]
    chunks: list[str] = []
    for start in range(0, len(offsets), max_tokens):
        end = min(start + max_tokens, len(offsets)) - 1
        chunk = text[offsets[start][0]:offsets[end][1]].strip()
        if chunk:
            chunks.append(chunk)
    return chunks


def _token_tail(text: str, max_tokens: int) -> str:
    if max_tokens <= 0:
        return ""
    encoded = _tokenizer(
        text,
        add_special_tokens=False,
        return_offsets_mapping=True,
    )
    offsets = encoded["offset_mapping"]
    if not offsets:
        return ""
    start = max(0, len(offsets) - max_tokens)
    return text[offsets[start][0]:offsets[-1][1]].strip()


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
            for sentence in _split_into_sentences(para):
                if count_tokens(sentence) <= CHUNK_SIZE_TOKENS:
                    units.append(sentence)
                else:
                    units.extend(_split_by_token_limit(sentence, CHUNK_SIZE_TOKENS))

    chunks: list[str] = []
    current_chunk_units: list[str] = []
    current_token_count = 0

    for unit in units:
        unit_tokens = count_tokens(unit)

        if current_token_count + unit_tokens > CHUNK_SIZE_TOKENS and current_chunk_units:
            # Current chunk is full — finalize it
            chunks.append(" ".join(current_chunk_units))

            # Keep a token tail only when it fits beside the next unit. This
            # avoids overlap-only chunks and preserves the hard size limit
            # when the next unit is close to the limit.
            available_overlap = min(
                CHUNK_OVERLAP_TOKENS,
                CHUNK_SIZE_TOKENS - unit_tokens,
            )
            overlap_text = _token_tail(
                " ".join(current_chunk_units), available_overlap
            )
            current_chunk_units = [overlap_text] if overlap_text else []
            current_token_count = count_tokens(overlap_text)

        current_chunk_units.append(unit)
        current_token_count += unit_tokens

    if current_chunk_units:
        chunks.append(" ".join(current_chunk_units))

    return chunks