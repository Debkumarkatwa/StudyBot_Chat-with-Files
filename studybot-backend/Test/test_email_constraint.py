"""
Verifies the email UNIQUE constraint on the users table actually rejects
duplicate emails at the DATABASE level (not just an app-level check) —
this is what makes signup safe under race conditions.

Run from the `backend/` folder: python Test/test_email_constraint.py
"""

import asyncio

from sqlalchemy.exc import IntegrityError
from sqlalchemy import delete

from app.database import AsyncSessionLocal
from app.models.user import User


async def main():
    test_email = "duplicate-test@example.com"

    async with AsyncSessionLocal() as session:
        # First insert — should succeed
        user1 = User(
            email=test_email,
            hashed_password="fake_hash_1",
            full_name="First User",
        )
        session.add(user1)
        await session.commit()
        print(f"✅ First user created: {user1.email}")

    async with AsyncSessionLocal() as session:
        # Second insert, same email — should FAIL at the DB level
        user2 = User(
            email=test_email,
            hashed_password="fake_hash_2",
            full_name="Duplicate User",
        )
        session.add(user2)
        try:
            await session.commit()
            print("❌ FAILED: Duplicate email was allowed to insert! Constraint is NOT working.")
        except IntegrityError as e:
            print("✅ PASSED: Duplicate email was rejected at the DB level.")
            print(f"   Postgres error: {e.orig}")
            await session.rollback()

    # Cleanup — remove the test user so it doesn't linger in your DB
    async with AsyncSessionLocal() as session:
        await session.execute(delete(User).where(User.email == test_email))
        await session.commit()
        print("🧹 Cleaned up test user.")


if __name__ == "__main__":
    asyncio.run(main())
