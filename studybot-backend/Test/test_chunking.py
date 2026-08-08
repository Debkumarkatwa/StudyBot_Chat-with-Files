"""
Tests parsing + chunking together (chunking needs real extracted text to be meaningful).
Run from the `backend/` folder: python Test/test_chunking.py "path/to/file.pdf"
"""

import mimetypes

from app.parsing import extract_text
from app.chunking import chunk_text, count_tokens

def main():
    print("Usage: Chunking Pipeline Testing Started...............")

    file_path = input('Enter the File Path -->  ')

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    mime_type, _ = mimetypes.guess_type(file_path)
    text = extract_text(file_bytes, mime_type)
    print(f"Total extracted characters: {len(text)}")

    chunks = chunk_text(text)
    print(f"Total chunks: {len(chunks)}")

    for i, c in enumerate(chunks):
        print(f"\n--- Chunk {i} ({count_tokens(c)} tokens) ---")
        print(c[:200])

    over_limit = [i for i, c in enumerate(chunks) if count_tokens(c) > 512]
    if chunks and not over_limit:
        print(f"\n✅ PASSED: {len(chunks)} chunks created, all under the model's 512-token limit.")
    else:
        print(f"\n❌ FAILED: Chunks {over_limit} exceed the 512-token limit." if over_limit else "\n❌ FAILED: No chunks produced.")


if __name__ == "__main__":
    main()
