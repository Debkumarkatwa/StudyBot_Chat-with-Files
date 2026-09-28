"""Two simultaneous /auth/refresh calls with the same token: one 200, one 401.

Run with the backend already running:
    python -m Test.test_refresh_race
Optional: STUDYBOT_URL=http://localhost:8000 (default)
"""
import os
import sys
import threading
import uuid

import requests

BASE = os.getenv("STUDYBOT_URL", "http://localhost:8000")


def main() -> int:
    email = f"race-{uuid.uuid4().hex[:8]}@example.com"
    password = "Testpass123"

    r = requests.post(f"{BASE}/auth/signup", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 201, f"signup failed: {r.status_code} {r.text}"
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tokens = r.json()

    barrier = threading.Barrier(2)
    codes = []

    def call():
        barrier.wait()
        resp = requests.post(
            f"{BASE}/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]},
            timeout=30,
        )
        codes.append(resp.status_code)

    threads = [threading.Thread(target=call) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # Clean up the test user.
    requests.delete(
        f"{BASE}/auth/me",
        json={"password": password},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
        timeout=30,
    )

    print("status codes:", sorted(codes))
    if sorted(codes) == [200, 401]:
        print("PASS")
        return 0
    print("FAIL: expected exactly one 200 and one 401")
    return 1


if __name__ == "__main__":
    sys.exit(main())
