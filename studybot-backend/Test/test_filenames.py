"""
Unit tests for storage key generation (no network needed).
Run from the backend root:  python -m Test.test_filenames
Exits non-zero on failure.
"""

import re
import uuid

from app.storage import build_storage_path

OWNER = uuid.uuid4()
SAFE = re.compile(r"^[A-Za-z0-9._-]+$")

# (label, filename, expected suffix or None)
CASES = [
    ("normal", "notes.pdf", ".pdf"),
    ("spaces", "my lecture notes.pdf", ".pdf"),
    ("empty", "", None),
    ("none", None, None),
    ("whitespace only", "   ", None),
    ("300 chars", "a" * 296 + ".pdf", ".pdf"),
    ("unicode accents", "résumé.pdf", ".pdf"),
    ("unicode cjk", "文档.pdf", ".pdf"),
    ("emoji", "notes 😀.pdf", ".pdf"),
    ("brackets", "[week 1] (final).pdf", ".pdf"),
    ("quotes", "it's \"final\".pdf", ".pdf"),
    ("path traversal", "../../etc/passwd", None),
    ("windows path", "C:\\Users\\me\\notes.pdf", ".pdf"),
    ("only dots", "....", None),
]


def main():
    failures = []
    for label, filename, suffix in CASES:
        path = build_storage_path(OWNER, filename)
        prefix = f"{OWNER}/"
        problems = []

        if not path.startswith(prefix):
            problems.append("missing owner prefix")
        else:
            key = path[len(prefix):]
            unique, _, name = key.partition("_")
            if not SAFE.match(key):
                problems.append(f"unsafe characters in key: {key!r}")
            if len(unique) != 32 or not name:
                problems.append("missing unique prefix or name part")
            if len(name) > 100:
                problems.append(f"name part too long ({len(name)})")
            if suffix and not key.endswith(suffix):
                problems.append(f"lost the {suffix} extension: {key!r}")
        if len(path) > 500:
            problems.append("path exceeds the 500-char column")

        if problems:
            failures.append(label)
            print(f"FAIL {label}: {'; '.join(problems)}")
        else:
            print(f"ok   {label}: {path[len(prefix):]}")

    same_a = build_storage_path(OWNER, "same.pdf")
    same_b = build_storage_path(OWNER, "same.pdf")
    if same_a == same_b:
        failures.append("uniqueness")
        print("FAIL uniqueness: same name produced the same path twice")

    if failures:
        print(f"\nFAILED: {failures}")
        raise SystemExit(1)
    print("\nPASSED: all filename cases produce safe, unique storage keys.")


if __name__ == "__main__":
    main()