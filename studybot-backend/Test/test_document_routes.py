"""
End-to-end test for document management routes (list, soft-delete, restore,
bin list, permanent delete, clear bin) — hits a LIVE running server over
HTTP, since these routes depend on FastAPI's routing table, not just
isolated app logic. Route-ordering bugs (static vs dynamic paths) only
surface this way, not via unit-testing functions directly.

Prerequisite: your FastAPI server must already be running
    uvicorn app.main:app --reload

Run from the `backend/` folder: python Test/test_document_routes.py
"""

import io
import time
import uuid

import requests

BASE_URL = "http://127.0.0.1:8000"

passed = []
failed = []


def check(label, condition):
    if condition:
        print(f"✅ {label}")
        passed.append(label)
    else:
        print(f"❌ {label}")
        failed.append(label)


def main():
    session = requests.Session()

    # --- Setup: create a throwaway test user ---
    test_email = f"doctest-{uuid.uuid4().hex[:8]}@example.com"
    test_password = "TestPass123"

    print(f"\n[Setup] Creating test user: {test_email}")
    signup_res = session.post(f"{BASE_URL}/auth/signup", json={
        "email": test_email,
        "password": test_password,
        "full_name": "Doc Test User",
    })
    check("Signup succeeded", signup_res.status_code == 201)

    login_res = session.post(f"{BASE_URL}/auth/login", json={
        "email": test_email,
        "password": test_password,
    })
    check("Login succeeded", login_res.status_code == 200)
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    def upload_dummy_txt(name="test.txt", content=b"Hello StudyBot test content."):
        files = {"file": (name, io.BytesIO(content), "text/plain")}
        return session.post(f"{BASE_URL}/documents/upload", headers=headers, files=files)

    # --- 1. Upload two docs ---
    print("\n[1] Uploading documents...")
    upload1 = upload_dummy_txt("doc1.txt")
    upload2 = upload_dummy_txt("doc2.txt")
    check("Upload doc1 succeeded (201)", upload1.status_code == 201)
    check("Upload doc2 succeeded (201)", upload2.status_code == 201)
    doc1_id = upload1.json().get("id")
    doc2_id = upload2.json().get("id")

    # --- 2. List active documents ---
    print("\n[2] Listing active documents...")
    list_res = session.get(f"{BASE_URL}/documents", headers=headers)
    check("GET /documents returns 200", list_res.status_code == 200)
    active_ids = [d["id"] for d in list_res.json()]
    check("Both uploaded docs appear in active list", doc1_id in active_ids and doc2_id in active_ids)

    # --- 3. Soft-delete doc1 ---
    print("\n[3] Soft-deleting doc1 (move to bin)...")
    del_res = session.delete(f"{BASE_URL}/documents/{doc1_id}", headers=headers)
    check("DELETE /documents/{id} returns 200", del_res.status_code == 200)
    check("Soft-deleted doc has status 'deleted'", del_res.json().get("status") == "deleted")

    list_res = session.get(f"{BASE_URL}/documents", headers=headers)
    active_ids = [d["id"] for d in list_res.json()]
    check("doc1 no longer in active list", doc1_id not in active_ids)

    # --- 4. Check bin list ---
    print("\n[4] Checking Recycle Bin...")
    bin_res = session.get(f"{BASE_URL}/documents/bin", headers=headers)
    check("GET /documents/bin returns 200", bin_res.status_code == 200)
    bin_ids = [d["id"] for d in bin_res.json()]
    check("doc1 appears in bin", doc1_id in bin_ids)

    # --- 5. Restore doc1 ---
    print("\n[5] Restoring doc1 from bin...")
    restore_res = session.post(f"{BASE_URL}/documents/{doc1_id}/restore", headers=headers)
    check("POST /documents/{id}/restore returns 200", restore_res.status_code == 200)
    check("Restored doc has status back to 'processing' or 'active'",
          restore_res.json().get("status") in ("processing", "active"))

    list_res = session.get(f"{BASE_URL}/documents", headers=headers)
    active_ids = [d["id"] for d in list_res.json()]
    check("doc1 back in active list after restore", doc1_id in active_ids)

    # --- 6. Soft-delete doc1 again, then permanently delete from bin ---
    print("\n[6] Soft-deleting doc1 again, then permanently deleting...")
    session.delete(f"{BASE_URL}/documents/{doc1_id}", headers=headers)
    perm_del_res = session.delete(f"{BASE_URL}/documents/bin/{doc1_id}", headers=headers)
    check("DELETE /documents/bin/{id} returns 204", perm_del_res.status_code == 204)

    bin_res = session.get(f"{BASE_URL}/documents/bin", headers=headers)
    bin_ids = [d["id"] for d in bin_res.json()]
    check("doc1 permanently gone from bin", doc1_id not in bin_ids)

    # --- 7. THE BUG THIS TEST EXISTS TO CATCH: clear_bin route ordering ---
    print("\n[7] Testing clear bin (route-ordering regression check)...")
    session.delete(f"{BASE_URL}/documents/{doc2_id}", headers=headers)  # move doc2 to bin
    clear_res = session.delete(f"{BASE_URL}/documents/bin", headers=headers)
    check("DELETE /documents/bin returns 204 (NOT 422 — route ordering bug)", clear_res.status_code == 204)

    bin_res = session.get(f"{BASE_URL}/documents/bin", headers=headers)
    check("Bin is empty after clear_bin", len(bin_res.json()) == 0)

    # --- Summary ---
    print(f"\n{'='*50}")
    print(f"✅ Passed: {len(passed)}   ❌ Failed: {len(failed)}")
    if failed:
        print("\nFailed checks:")
        for f in failed:
            print(f"  - {f}")
    else:
        print("\n🎉 All document route checks passed.")


if __name__ == "__main__":
    main()