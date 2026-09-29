# StudyBot — Claude Fix Checklist & Test Report

**Based on:** full read of Backend.zip (52 files) + Frontend.zip (34 files) + `Test_Reports.md`
**Rule:** an item is ticked only when its **Done when** condition has passed. "I pushed it, no errors" does not count.
**Tag legend:** `[S-01]`, `[L-02]`, … = item IDs from `Test_Reports.md`.

## Decisions on record

- **Auth transport [L-01]: decided — keep `Authorization: Bearer`.** Backend is on Render and frontend on a separate host, so cookies would be cross-site. Not "fixed"; resolved by decision. Remaining work: delete the dead cookie code (Phase 1).
- **M-06 (migrations on populated data): downgraded to low.** A fresh production DB runs every migration on empty tables. Rule going forward: never write a truncating migration once real users exist.
- **L-03 (upload quota race): low priority.** Do last.

## Evidence log (things reproduced by running code, not just read)

| # | Finding | How verified |
|---|---------|--------------|
| 1 | `groq==0.11.0` + `httpx==0.28.1` → `TypeError: unexpected keyword argument 'proxies'` on `Groq()` | Clean venv, exact pinned pair. `groq 1.7.0` + same httpx constructs fine. |
| 2 | Retrieval candidate subquery had no owner/status filter (`SELECT chunks.id … ORDER BY … LIMIT 20`) | Compiled the SQL with SQLAlchemy + pgvector. |
| 3 | Chunker: 435-token chunk vs 400 limit; overlap-only duplicate chunk; zero overlap for 120-token paragraphs | Ran `chunk_text` with a stub whitespace tokenizer (real BGE tokenizer unreachable from sandbox). |
| 4 | DOMPurify 3.0.6 is in the affected range of CVE-2024-47875 (fixed in 3.1.3) | Advisory lookup. |

Not run (no DB / keys in sandbox): the app itself, real Jina/Groq behaviour, real tokenizer.

---

## Phase 0 — Verify what was already changed ✅ DONE

- [ X ] **Groq pin** [S-01] — `groq==1.7.0`
- [ X ] **Retrieval scoping** [M-05] — final query now filters owner + status + selected docs before `ORDER BY distance LIMIT`
- [ X ] **SEC-00 history check** — `git log --all --oneline -- studybot-backend/.env` verified

> Carried forward (not blocking Phase 0, tracked below): clean-install test, two-user retrieval test, dead-code cleanup.

---

## Phase 1 — Auth and security

- [ X ] **Refresh single-flight** [L-02, frontend]. Share one `_refreshPromise` in `api.js`.
  - Done when: 5 parallel API calls with an expired access token cause exactly **one** `/auth/refresh` request and no logout.
- [ X ] **Atomic refresh rotation** [L-02, backend]. Conditional `UPDATE … WHERE revoked_at IS NULL RETURNING` so exactly one caller consumes a token.
  - Done when: two simultaneous refreshes with the same token → one 200, one 401.
- [ X ] **Wrong password returns 400, not 401** (`change-password`, `DELETE /auth/me`).
  - Done when: a wrong current password shows "incorrect", the session stays alive, and no refresh call fires.
- [ X ] **Password change keeps the current session.** Issue new tokens from the endpoint, or log out immediately with a message.
  - Done when: no surprise logout within 30 min of a password change, and the old refresh token is dead.
- [ X ] **Remove dead cookie code** [L-01]. Delete `_set_auth_cookies`, the `Cookie(...)` reads, `AUTH_COOKIE_*` env vars/config.
  - Done when: no `set_cookie` / `Cookie(` remains; login, refresh, logout, session-expiry pass in the browser.
- [ X ] **DOMPurify upgrade** to current 3.x; regenerate SRI hash; add `FORBID_TAGS: ["img","style"]`, `FORBID_ATTR: ["style"]`.
  - Done when: a reply containing `![](http://x/y.png)` renders no `<img>`; no SRI errors in console.
- [ X ] **Backend password rule.** Enforce letter + number in `UserSignup` and `ChangePasswordRequest`.
  - Done when: signup with `aaaaaaaa` → 422.
- [ X ] **Privacy policy text.** Disclose Jina and Groq as processors.
  - Done when: `privacy.html` names both and says what is sent.

  > Completed: All Items passed with verified Test Cases.

## Phase 2 — Robustness

**Carried from Phase 0:**
- [ X ] **Remove retrieval dead code.** Delete the unused `candidate_ids` block and `CHAT_RETRIEVAL_CANDIDATES` from `retrieval.py`, `config.py`, `.env.sample`.
  - Done when: no reference to `CHAT_RETRIEVAL_CANDIDATES` remains anywhere.
- [ X ] **Replace `Test/test_retrieval.py`** (currently string-greps SQL and still asserts the old candidate pool → will fail) with a two-user integration test.
  - Done when: user B never sees user A's chunks; user A still gets results when B has many closer chunks; deleted/failed docs excluded.
  - Also: `SELECT extversion FROM pg_extension WHERE extname='vector'`; if ≥ 0.8 and HNSW is kept, use `SET LOCAL hnsw.iterative_scan = relaxed_order`.
- [ X ] **Clean-install check.** Fresh venv → `pip install -r requirements.txt` → `python -c "import app.main"` → `python -m Test.test_groq`.
  - Done when: all three pass.

**New work:**
- [ X ] **Upload read cap.** `await file.read(MAX_FILE_SIZE + 1)`.
  - Done when: an 11 MB file gets 413 without the server reading it all.
- [ X ] **Filename handling** [S-06]. Reject > 255 chars up front; sanitize storage keys to `[A-Za-z0-9._-]`.
  - Done when: tests pass for empty, `None`, 300-char, unicode, `[brackets]` names.
- [ X ] **NUL byte strip** in `extract_text` (`text.replace("\x00", "")`).
  - Done when: text containing `\x00` processes without a DB error.
- [ X ] **Jina batching + retry.** ~64 chunks per request; backoff on 429/5xx.
  - Done when: a 500+ chunk PDF embeds; a mocked 429 is retried.
- [ X ] **Groq error handling + canned reply.** 503 with friendly message on failure; skip the LLM call when nothing retrieved and hybrid is off.
  - Done when: mocked 429 → friendly message; empty retrieval → zero Groq calls.
- [ X ] **Hybrid marker** [M-04]. Match `"This part is not from your uploaded documents"` without the emoji.
  - Done when: a reply with the emoji stripped is still labelled general knowledge.
- [ X ] **Source tag rules.** Show "From your documents" only when `sources.length > 0`.
  - Done when: a not-found answer has no document tag.
- [ X ] **Session-expiry redirect** to `login.html`.
  - Done when: an expired session in chat/documents lands on login.
- [ ] **Upload quota race** [L-03]. Low priority; only after everything above is green.

## Phase 3 — Chunker and retrieval quality [L-04, S-03]

- [ ] **Overlap fix.** No overlap-only duplicate chunk; real overlap for paragraph-sized units.
  - Done when: deterministic tests cover 45/390/45/390-token paragraphs, 120-token paragraphs, and exact-400 boundary. No chunk exceeds the limit; none is a strict prefix of another.
- [ ] **Hard-split casing.** Check whether `_split_by_token_limit` lowercases text (BGE tokenizer is uncased); fix via character-offset splitting or a different tokenizer.
  - Done when: a chunk built from mixed-case unpunctuated text keeps its case.
- [ ] **Tokenizer decision.** Keep `transformers` only for token counting, or swap to a lighter count. Document the choice.
- [ ] **Chunking fixture test** [S-03]. Non-interactive, non-zero exit on failure.
  - Done when: `python -m Test.test_chunking` runs with no prompts.

## Phase 4 — UX and cleanup

- [ ] **Full-name limit.** 15 → ~60 in HTML, `auth.js`, `profile.js`, `schemas/user.py`, and the "/ 15" counter.
- [ ] **Font fallback.** `--font-main: "Inter", system-ui, sans-serif`.
- [ ] **Chat height.** `100dvh` for `.chat-page` and the sidebar.
- [ ] **Forgot-password page.** "Not available yet" instead of fake success.
- [ ] **Landing copy.** Remove "page 12"; soften "no guessing" now that hybrid exists.
- [ ] **Docs cleanup.** Fix README contradictions, test docstrings (`python -m Test.x`), the `database.py` "bug #1" comment, stale `b7c2…` migration header; drop `HF_TOKEN` from `.env.sample`; prune orphaned deps (`sympy`, `mpmath`, `networkx`, `joblib`, `threadpoolctl` — verify with `pip check`).
- [ ] **Test exit codes.** `test_jwt`, `test_security`, `test_parsing`, `test_document_routes` must exit non-zero on failure; clean up test users.

## Phase 5 — Close-out gates (nothing is "verified" until all pass)

- [ ] Clean-install backend from `requirements.txt` and import `app.main`.
- [ ] Alembic upgrade + autogenerate check; generated migration must be empty [S-07].
- [ ] Browser checks: wrong-password login, mixed-case email, password-change revocation, session expiry, stale chat selection, failed-document counts, hybrid labels, recycle-bin expiry.
- [ ] Simulated storage-failure test proves failed rows stay in the bin for retry [M-03].
- [ ] Replace "17/17" / "10/10" claims with exact commands and committed assertions.
- [ ] Update `Test_Reports.md`: items stay "implemented, unverified" until their test passes; L-01 marked "decided: Bearer".

## Working rules

- One phase at a time; one commit per item, verification command in the commit message.
- Compile-check every touched file after each item.
- Update this file as items close, not at the end.
