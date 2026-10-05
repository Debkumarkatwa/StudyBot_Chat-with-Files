"""Deterministic regression tests for chunk overlap and size limits."""

from app.chunking import _split_by_token_limit, chunk_text, count_tokens
from app.config import CHUNK_SIZE_TOKENS


def _paragraph(token: str, count: int) -> str:
    return " ".join([token] * count)


def _assert_valid_chunks(chunks: list[str]) -> None:
    assert chunks
    assert all(count_tokens(chunk) <= CHUNK_SIZE_TOKENS for chunk in chunks)
    assert all(
        not chunks[index + 1].startswith(chunks[index])
        for index in range(len(chunks) - 1)
    )
    assert all(chunks[index] != chunks[index + 1] for index in range(len(chunks) - 1))


def test_boundary_paragraphs_do_not_overflow_or_duplicate():
    text = "\n\n".join(
        [
            _paragraph("alpha", 45),
            _paragraph("beta", 390),
            _paragraph("gamma", 45),
            _paragraph("delta", 390),
        ]
    )
    _assert_valid_chunks(chunk_text(text))


def test_paragraphs_get_real_overlap():
    chunks = chunk_text(
        "\n\n".join(
            [
                _paragraph("alpha", 120),
                _paragraph("beta", 120),
                _paragraph("gamma", 120),
                _paragraph("delta", 120),
            ]
        )
    )
    _assert_valid_chunks(chunks)
    assert any("alpha" in chunk and "beta" in chunk for chunk in chunks)


def test_exact_limit_boundary_stays_within_limit():
    chunks = chunk_text("\n\n".join([_paragraph("alpha", 400), _paragraph("beta", 45)]))
    _assert_valid_chunks(chunks)


def test_hard_split_preserves_mixed_case():
    chunks = _split_by_token_limit(" ".join(["MiXeDCaseToken"] * 500), 400)
    assert any(char.isupper() for char in chunks[0])
    assert all(count_tokens(chunk) <= CHUNK_SIZE_TOKENS for chunk in chunks)


if __name__ == "__main__":
    test_boundary_paragraphs_do_not_overflow_or_duplicate()
    test_paragraphs_get_real_overlap()
    test_exact_limit_boundary_stays_within_limit()
    test_hard_split_preserves_mixed_case()
    print("PASS: chunk overlap, boundary, and casing cases")
