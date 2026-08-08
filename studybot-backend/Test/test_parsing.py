"""
Tests document text extraction (PDF/DOCX/PPTX/TXT).
Run from the `backend/` folder: python Test/test_parsing.py "path/to/file.pdf"
"""

import sys
import mimetypes

from app.parsing import extract_text


def main():
    print("Usage: Text Parsing Testing Started...............")
    
    file_path = input('Enter the File Path -->  ')

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    mime_type, _ = mimetypes.guess_type(file_path)
    if mime_type is None:
        print("❌ Could not detect MIME type from file extension.")
        sys.exit(1)

    text = extract_text(file_bytes, mime_type)

    print(f"✅ Extracted {len(text)} characters from {file_path} ({mime_type})")
    print(f"Preview: {text[:500]!r}")

    if text.strip():
        print("\n✅ PASSED: Text extraction produced non-empty output.")
    else:
        print("\n❌ FAILED: No text extracted.")


if __name__ == "__main__":
    main()
