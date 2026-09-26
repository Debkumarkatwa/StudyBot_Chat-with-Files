# StudyBot Test and Improvement Report

**Review date:** 2026-09-28  
**Scope:** `studybot-backend`, `studybot-frontend`, migrations, tests, and project documentation  
**Status:** V1 features exist, but the project is not ready to be marked fully verified.

## How to Read This Report

This is the single source of truth for the next fixes. Issues are ordered from smaller, local changes to larger cross-layer or architectural changes. The order is based on implementation effort, not only severity.

- **Confirmed:** visible in the current code or directly reproducible from the committed test setup.
- **Needs runtime confirmation:** plausible from static review but requires a live database, storage service, browser, or concurrent request test.
- **Deferred:** intentional V2 scope unless product requirements change.

## Immediate Security Action

### SEC-00: Rotate the exposed Groq credential

- **Priority:** Immediate
- **Effort:** Operational action, then small repository cleanup
- **Status:** Completed by owner
- A real-looking `GROQ_API_KEY` is present in `studybot-backend/.env`.
- The owner confirmed the credential will not be shared from this point forward.
- Credential rotation and any local secret cleanup are owner-managed actions.

## Ranked Fix Plan

### 1. Small, local changes

These changes are mostly isolated edits with low migration risk.

#### S-01: Add missing direct dependencies

- **Files:** `studybot-backend/requirements.txt`, `studybot-backend/app/llm.py`, `studybot-backend/Test/test_document_routes.py`
- **Status:** Completed by owner
- `groq` and `requests` are listed in the current requirements file.
- `requests` was verified importable in the current environment.
- A clean-environment install and backend startup check remain optional verification work.

#### S-02: Fix stale documentation and comments

- **Files:** `README.md`, `studybot-backend/app/chunking.py`, `studybot-backend/app/models/chunk.py`, `studybot-frontend/js/auth.js`
- **Status:** Completed in the previous pass
- Align the documented vector dimension with 512, identify Jina as the embedding provider, and remove obsolete mock-auth wording.
- Keep the tokenizer mismatch documented until it is resolved by a code change.

#### S-03: Make the chunking smoke test reliable

- **File:** `studybot-backend/Test/test_chunking.py`
- **Status:** Code update completed; sample-document verification pending
- Check `CHUNK_SIZE_TOKENS` instead of the old 512-token value.
- Accept the documented command-line file path and return a non-zero exit code on failure.
- Add a non-interactive fixture-based test for overlap and hard-limit behavior.

#### S-04: Correct the login error path

- **File:** `studybot-frontend/js/api.js`
- **Status:** Fixed in this pass; browser/API regression test pending
- `_apiFetch()` treats the 401 from `/auth/login` as an expired session and can replace the useful invalid-credentials response.
- Exclude login and signup from automatic refresh handling, or use an explicit request option for public auth endpoints.
- Add a browser/API regression test for wrong-password login.

#### S-05: Remove small frontend correctness defects

- **Files:** `studybot-frontend/js/documents.js`, `studybot-frontend/js/api.js`, `studybot-frontend/js/chat.js`
- **Status:** Fixed in this pass; browser regression tests pending
- Use configured retention days instead of hardcoding `7`.
- Exclude failed documents from “usable documents” counts and empty-state decisions.
- Remove deleted document IDs from the chat selection state.
- Add focused frontend tests for each behavior.

#### S-06: Handle missing upload filenames

- **File:** `studybot-backend/app/storage.py`
- **Status:** Fixed in this pass; direct upload-route test pending
- `build_storage_path()` assumes `filename` is not `None`.
- Reject missing or empty names with a clear client error, or generate a controlled fallback name.
- Add tests for missing, empty, long, and unusual filenames.

#### S-07: Register every model with Alembic metadata

- **File:** `studybot-backend/alembic/env.py`
- **Status:** Fixed in this pass; autogenerate verification pending
- Import `RefreshToken` so autogeneration does not propose dropping `refresh_tokens`.
- Run autogenerate against a test database and verify the generated migration is empty.

### 2. Medium changes within existing boundaries

These changes affect data consistency or security behavior but can retain the current architecture.

#### M-01: Normalize email addresses

- **Files:** `studybot-backend/app/routes/auth.py`, user schema/model, email tests
- **Status:** Verified
- Signup and login payloads now canonicalize email addresses before the auth routes store or query them.
- The focused normalization regression passes for case variants such as `A@example.com` and `a@example.com`.
- Browser validation passed: mixed-case signup succeeded, and login with the lowercase form succeeded for the same account.
- Both flows reached the authenticated landing page through the live frontend and backend.

#### M-02: Revoke refresh tokens after password changes

- **File:** `studybot-backend/app/routes/auth.py`
- **Status:** Implemented; web validation passed
- The password-change transaction now revokes all active refresh-token rows for the user.
- Browser validation passed: the profile form reported a successful password change, the old password was rejected, and the new password logged in successfully.
- Direct refresh-token replay testing remains a separate backend verification requirement.

#### M-03: Make recycle-bin cleanup consistent

- **File:** `studybot-backend/app/routes/documents.py`
- **Status:** Implemented; web validation passed
- Bulk cleanup now keeps a database row when storage deletion fails, commits successful deletions, and returns a 502 response when any files remain.
- Live browser validation passed: a document was uploaded, moved to the recycle bin, permanently cleared with “Delete all,” and the bin returned to `0/5`.
- A simulated storage-failure test is still needed to verify that failed rows remain available for retry.

#### M-04: Improve hybrid-mode reporting

- **Files:** `studybot-backend/app/routes/chat.py`, LLM service, chat schema/frontend
- **Status:** Reverted and deferred
- The structured JSON response experiment caused LLM errors and was removed.
- The route-only fallback was also rejected: a hybrid answer with unrelated retrieved chunks was incorrectly labeled as document-grounded.
- The current implementation is back to the previous plain-text response contract and exact warning-marker detection.
- A future attempt should use provider-compatible structured metadata and be tested against the live Groq model before adoption.

#### M-05: Add retrieval quality controls

- **Files:** `studybot-backend/app/retrieval.py`, `studybot-backend/app/config.py`, `.env.sample`
- **Status:** Implemented; web validation passed
- Added configurable `CHAT_MAX_COSINE_DISTANCE` with a default of `0.8`.
- The cutoff is applied while preserving owner, active-status, and selected-document filters.
- Live chat validation passed with both `requirements.txt` and `LLM Workflow and Transformer full.pdf`.
- PDF checks returned accurate answers for Multi-Head Attention and GPT-versus-BERT, with the “From your documents” label and relevant source citations.
- `Test/test_retrieval.py` now verifies the distance operator, cutoff value, candidate pool, final top-K limit, owner/status scoping, and selected-document filtering.

#### M-06: Make migrations safe for existing data

- **Files:** `studybot-backend/alembic/versions/1a95e75f2f93_add_file_size_to_documents.py`, `92325dc57b68_bump_chunk_embedding_dimension_to_512_.py`
- **Status:** Confirmed risk
- Add `file_size` with a safe backfill/default strategy before enforcing `NOT NULL`.
- Do not silently truncate production chunks during an embedding-dimension change. Use an explicit migration/data-rebuild plan and document downtime or re-embedding requirements.
- Test upgrade and downgrade paths against populated databases.

### 3. Large cross-layer changes

These changes affect multiple modules and require concurrency or browser validation.

#### L-01: Choose and complete one authentication transport

- **Files:** `studybot-backend/app/routes/auth.py`, dependencies, `studybot-frontend/js/api.js`, browser tests, CORS configuration
- **Status:** Confirmed design inconsistency
- The backend issues HttpOnly cookies, while the frontend stores and sends bearer tokens from `localStorage` and does not send `credentials: "include"`.
- Preferred direction: use HttpOnly cookies, send credentials on frontend requests, remove browser-readable JWT storage, and make the backend read the cookie consistently.
- Add login, refresh, logout, session-expiry, CORS, and XSS-resistance regression tests.

#### L-02: Make refresh rotation atomic and single-flight

- **Files:** `studybot-backend/app/routes/auth.py`, `studybot-frontend/js/api.js`, refresh-token tests
- **Status:** Confirmed design gap; concurrency behavior needs a live test
- Backend rotation currently reads an unrevoked token and revokes it later, allowing concurrent requests to race.
- Use a conditional database update or row lock so exactly one request can consume a refresh token.
- Add one frontend refresh promise shared by concurrent requests so parallel page loads do not submit duplicate refreshes.
- Test simultaneous refresh calls and simultaneous expired-session API calls.

#### L-03: Enforce the active-document quota transactionally

- **File:** `studybot-backend/app/routes/documents.py`, database schema/transaction logic
- **Status:** Confirmed race risk; needs concurrent upload test
- The count-then-insert flow allows parallel uploads to exceed the configured limit.
- Use a reservation/locking strategy or another database-enforced quota mechanism.
- Test concurrent uploads, restore-versus-upload races, and processing failures.

#### L-04: Fix chunking limits and tokenizer strategy

- **Files:** `studybot-backend/app/chunking.py`, configuration, chunking tests, processing pipeline
- **Status:** Confirmed
- Overlap can be carried into a new chunk and push it above the configured 400-token limit.
- Paragraph-sized units can produce little or no overlap.
- Chunk sizing uses a BGE tokenizer while embeddings are generated by Jina, and the tokenizer is downloaded at import time.
- Enforce a final hard split, define overlap behavior for large units, and decide whether to use a compatible tokenizer or an explicitly documented approximation.
- Add deterministic unit tests for paragraphs, long sentences, unpunctuated text, overlap, empty input, and exact boundary sizes.

## Test and Verification Requirements

Before marking the project verified, add or run these checks:

- Clean-install backend from `requirements.txt` and import `app.main`.
- Run Alembic upgrade/autogenerate checks against a populated test database.
- Test wrong-password login, email case variants, password-change revocation, cookie sessions, and concurrent refresh.
- Test upload quota races, missing filenames, failed processing cleanup, and storage deletion failures.
- Test chunk size and overlap with deterministic tokenizer fixtures.
- Test retrieval thresholds and owner/document scoping.
- Run browser checks for login expiry, stale chat selections, failed-document counts, hybrid labels, and recycle-bin expiry.
- Replace historical claims such as “17/17” and “10/10” with reproducible commands and committed assertions.

## Deferred V2 Improvements

These are not required for the first bug-fix pass unless product scope changes:

- Password-reset email delivery.
- Background processing and a persistent upload queue.
- Chat history and multi-turn conversations.
- Rate limiting and abuse protection.
- MIME/content sniffing rather than trusting the client MIME header.
- OCR and legacy `.doc`/`.ppt` parsing.
- OAuth, admin roles, subscriptions, and upgrade plans.
- Full accessibility audit and production deployment testing.

## Current Verification Summary

The codebase has useful foundations: database-level email uniqueness, owner-scoped retrieval, private storage with signed URLs, cascade relationships, safe HTML rendering, and SRI-protected CDN scripts. Those strengths do not close the unresolved issues above. The next implementation pass should start with S-01 through S-07, then proceed to M-01 through M-06, and finally address the larger L-series changes.