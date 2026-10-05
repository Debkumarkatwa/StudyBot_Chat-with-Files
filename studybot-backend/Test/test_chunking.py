"""
Tests parsing + chunking together (chunking needs real extracted text to be meaningful).
Run from the backend folder: python -m Test.test_chunking "path/to/file.pdf"
"""

import mimetypes
import sys

from app.parsing import extract_text
from app.chunking import chunk_text, count_tokens
from app.config import CHUNK_SIZE_TOKENS

def main():
    print("Usage: Chunking Pipeline Testing Started...............")

    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        with open(file_path, "rb") as f:
            file_bytes = f.read()

        mime_type, _ = mimetypes.guess_type(file_path)
        if mime_type is None:
            print("❌ Could not detect MIME type from file extension.")
            sys.exit(1)
        text = extract_text(file_bytes, mime_type)
    else:
        print("No file supplied; using the deterministic chunking fixture.")
        text = "\n\n".join(
            [
                " ".join(["AlphaFixtureToken"] * 120),
                " ".join(["BetaFixtureToken"] * 120),
                " ".join(["GammaFixtureToken"] * 120),
            ]
        )

    print(f"Total extracted characters: {len(text)}")

    chunks = chunk_text(text)
    print(f"Total chunks: {len(chunks)}")

    for i, c in enumerate(chunks):
        print(f"\n--- Chunk {i} ({count_tokens(c)} tokens) ---")
        print(c[:200])

    over_limit = [i for i, c in enumerate(chunks) if count_tokens(c) > CHUNK_SIZE_TOKENS]
    if chunks and not over_limit:
        print(f"\nPASSED: {len(chunks)} chunks created, all within the configured {CHUNK_SIZE_TOKENS}-token limit.")
    else:
        print(f"\nFAILED: Chunks {over_limit} exceed the configured {CHUNK_SIZE_TOKENS}-token limit." if over_limit else "\nFAILED: No chunks produced.")
        sys.exit(1)


if __name__ == "__main__":
    main()
