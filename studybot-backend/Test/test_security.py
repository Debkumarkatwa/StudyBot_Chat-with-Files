"""
Tests bcrypt password hashing and verification.
Run from the backend folder: python -m Test.test_security
"""

import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.security import hash_password, verify_password


def main():
    hashed = hash_password("mypassword123")
    print(f"Hashed: {hashed}")

    correct = verify_password("mypassword123", hashed)
    print(f"Correct password verifies True: {correct}")

    incorrect = verify_password("wrongpassword", hashed)
    print(f"Wrong password verifies False: {not incorrect}")

    if correct and not incorrect:
        print("\n✅ PASSED: Password hashing works correctly.")
    else:
        print("\n❌ FAILED: Something is wrong with hash/verify logic.")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
