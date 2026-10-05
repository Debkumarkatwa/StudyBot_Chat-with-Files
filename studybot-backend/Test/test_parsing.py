"""
Tests document text extraction (PDF/DOCX/PPTX/TXT).
Run from the backend folder: python -m Test.test_parsing "path/to/file.pdf"
"""

import sys
import mimetypes

from app.parsing import extract_text


def test_extract_text_strips_nul_bytes():
    text = extract_text(b"alpha\x00beta\x00gamma", "text/plain")
    assert text == "alphabetagamma"
    assert "\x00" not in text


def main():
    print("Usage: Text Parsing Testing Started...............")
    
    # 1. Regression test: strip NUL bytes
    test_extract_text_strips_nul_bytes()
    print("PASS: NUL bytes stripped successfully.")

    # 2. File parsing test
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
    elif os.path.exists("../LLM Workflow and Transformer full.pdf"):
        file_path = "../LLM Workflow and Transformer full.pdf"
    elif os.path.exists("LLM Workflow and Transformer full.pdf"):
        file_path = "LLM Workflow and Transformer full.pdf"
    else:
        file_path = None

    if file_path:
        with open(file_path, "rb") as f:
            file_bytes = f.read()

        mime_type, _ = mimetypes.guess_type(file_path)
        if mime_type is None:
            print("FAILED: Could not detect MIME type from file extension.")
            sys.exit(1)

        text = extract_text(file_bytes, mime_type)
        print(f"Extracted {len(text)} characters from {file_path} ({mime_type})")
        print(f"Preview: {text[:200]!r}")

        if not text.strip():
            print("\nFAILED: No text extracted.")
            raise SystemExit(1)

    print("\nPASSED: Text extraction completed successfully.")


if __name__ == "__main__":
    import os
    main()
