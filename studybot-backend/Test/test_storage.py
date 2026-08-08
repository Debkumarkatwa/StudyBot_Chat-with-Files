"""
Tests Supabase Storage connectivity: upload, signed URL, delete.
Run from the `backend/` folder: python Test/test_storage.py
"""

import uuid
import time

from app.storage import upload_file, get_signed_url, delete_file


def main():
    test_path = f"test/{uuid.uuid4().hex}_test.txt"

    upload_file(test_path, b"hello studybot", "text/plain")
    print(f"✅ Uploaded: {test_path}")

    url = get_signed_url(test_path)
    print(f"✅ Signed URL generated: {url}")
    print("   (Paste this into a browser within the next 20s to visually confirm the file loads.)")

    time.sleep(20)

    delete_file(test_path)
    print("✅ Deleted.")

    print("\n✅ PASSED: Supabase Storage upload/signed-url/delete cycle works.")


if __name__ == "__main__":
    main()
