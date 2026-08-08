import bcrypt


def hash_password(plain_password: str) -> str:
    """
    Hash a plaintext password for storage. Never store plain_password anywhere.
    bcrypt automatically generates and embeds a random salt in the output hash,
    so we don't need to manage salts separately.
    """
    password_bytes = plain_password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")  # store as string in the DB


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Check a plaintext password against a stored bcrypt hash.
    Used at login time.
    """
    password_bytes = plain_password.encode("utf-8")
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hashed_bytes)