"""
Standalone pipeline test — run this directly to verify parsing, chunking,
and embedding work correctly, completely separate from the API/upload
endpoint/background task machinery. Isolates the core logic so if
something breaks, we know exactly which stage failed.

Run from the `backend/` folder: python Test/test_pipeline_full.py "path/to/file.pdf"
"""

import sys
import mimetypes

from app.parsing import extract_text
from app.chunking import chunk_text, count_tokens
from app.embeddings import generate_embeddings


def main():
    print("Usage: Whole Pipeline Testing Started...............")

    file_path = input('Enter the File Path -->  ')

    print(f"\n[Step 0] Reading file: {file_path}")
    with open(file_path, "rb") as f:
        file_bytes = f.read()

    mime_type, _ = mimetypes.guess_type(file_path)
    if mime_type is None:
        print("❌ Could not detect MIME type from file extension. Aborting.")
        sys.exit(1)
    print(f"✅ File read: {len(file_bytes)} bytes | Detected MIME type: {mime_type}")

    print(f"\n[Step 1] Extracting text...")
    try:
        text = extract_text(file_bytes, mime_type)
    except Exception as e:
        print(f"❌ Parsing failed: {e}")
        sys.exit(1)

    if not text.strip():
        print("❌ Parsing produced NO text. (Scanned/image-only PDF? Empty file?)")
        sys.exit(1)
    print(f"✅ Parsing done: {len(text)} characters extracted")
    print(f"   Preview: {text[:150]!r}")

    print(f"\n[Step 2] Chunking text...")
    try:
        chunks = chunk_text(text)
    except Exception as e:
        print(f"❌ Chunking failed: {e}")
        sys.exit(1)

    if not chunks:
        print("❌ Chunking produced ZERO chunks.")
        sys.exit(1)
    token_counts = [count_tokens(c) for c in chunks]
    print(f"✅ Chunking done: {len(chunks)} chunks created")
    print(f"   Token counts: min={min(token_counts)}, max={max(token_counts)}, avg={sum(token_counts)//len(token_counts)}")
    print(f"   First chunk preview: {chunks[0][:150]!r}")

    print(f"\n[Step 3] Generating embeddings...")
    try:
        embeddings = generate_embeddings(chunks)
    except Exception as e:
        print(f"❌ Embedding failed: {e}")
        sys.exit(1)

    if len(embeddings) != len(chunks):
        print(f"❌ Mismatch: {len(chunks)} chunks but {len(embeddings)} embeddings returned.")
        sys.exit(1)
    print(f"✅ Embedding done: {len(embeddings)} vectors created, each with {len(embeddings[0])} dimensions")

    print(f"\n🎉 Full pipeline succeeded end-to-end.")


if __name__ == "__main__":
    main()
