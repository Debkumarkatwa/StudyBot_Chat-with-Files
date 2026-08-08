"""
Tests JWT access token creation and decoding.
Run from the `backend/` folder: python Test/test_jwt.py
"""

from app.jwt_utils import create_access_token, decode_token


def main():
    token = create_access_token("test-user-id-123")
    print(f"Token: {token}")

    payload = decode_token(token)
    print(f"Decoded payload: {payload}")

    checks = (
        payload.get("sub") == "test-user-id-123"
        and payload.get("type") == "access"
        and "exp" in payload
    )

    if checks:
        print("\n✅ PASSED: JWT create/decode works correctly.")
    else:
        print("\n❌ FAILED: Decoded payload doesn't match expected shape.")


if __name__ == "__main__":
    main()
