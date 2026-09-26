"""Checks that signup and login canonicalize email addresses consistently."""

from app.schemas.user import UserLogin, UserSignup


def main():
    signup_email = str(UserSignup(
        email="Student@Example.COM",
        password="StrongPass123",
        full_name="Test User",
    ).email)
    login_email = str(UserLogin(
        email="student@example.com",
        password="StrongPass123",
    ).email)

    if signup_email == login_email == "student@example.com":
        print("PASSED: signup and login email normalization match.")
    else:
        raise SystemExit(
            f"FAILED: expected student@example.com, got {signup_email!r} and {login_email!r}."
        )


if __name__ == "__main__":
    main()