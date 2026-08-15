# StudyBot_Chat-with-Files
This is the container of my Project "StudyBot". You will get everything about the project here. For details please read readme.md

# Run The Frontend Server
python -m http.server 5500

# Run The Backend Server
uvicorn app.main:app --reload

# Run The Test Scripts
python -m Test.filename ( From Backend Folder `ex -> [python -m Test.test_jwt]`)

# StudyBot — V1 Status

**Date:** August 2026
**Status:** ✅ V1 complete — backend, frontend, and full frontend-backend integration all built, tested, and verified working end-to-end in a real browser.

---

## ✅ COMPLETED

### Phase 0: Environment Setup
- Neon PostgreSQL project created (development branch, kept separate for safe iteration)
- Supabase project created; private Storage bucket `studybot-documents` created
- Backend scaffolded in `backend/` folder: FastAPI, async SQLAlchemy, Alembic, venv
- `.env` + `.gitignore` set up correctly from the start — no secrets in git
- Confirmed Neon connection working (fixed the `channel_binding` param issue specific to asyncpg + Neon)

### Phase 1: Core Database Schema
All three tables built via Alembic migrations, verified against the real DB (not just assumed from clean migration logs):

- **`users`** — UUID PK, `email` with DB-level `UNIQUE` index (proven with a real duplicate-insert test, not just trusted), bcrypt `hashed_password`, `full_name`, `created_at`
- **`documents`** — UUID PK, `owner_id` FK → `users.id` (`ON DELETE CASCADE`), `filename`, `file_type`, `storage_path`, `status` (Postgres ENUM: `processing` / `active` / `failed` / `deleted`), `uploaded_at`, `deleted_at` (nullable, drives 7-day recycle bin)
- **`chunks`** — UUID PK, `document_id` FK → `documents.id` (`ON DELETE CASCADE`), `content` (Text), `embedding` (`Vector(384)`, pgvector), `chunk_index`, `created_at`, HNSW index using `vector_cosine_ops`

**Known Alembic quirks hit and fixed:**
- `pgvector.sqlalchemy` import must be added manually to migration files — autogenerate omits it, causes `NameError` if unfixed
- Enum `DROP TYPE` must be added manually to `downgrade()` — autogenerate skips it, would cause a re-run failure later
- Postgres enum additions (e.g. adding `failed` status) aren't autogenerate-friendly — needs a manual migration

### Phase 2: Authentication
- Password hashing via `bcrypt` directly (no wrapper library — chosen over `passlib` due to `passlib`'s stalled maintenance)
- JWT via `PyJWT` (chosen over `python-jose` for cleaner CVE history)
- Access tokens (30 min expiry) + refresh tokens (7 day expiry), both carrying a `type` field (`access`/`refresh`) that's explicitly enforced everywhere — prevents refresh tokens from being used as access tokens and vice versa
- Refresh token **rotation** implemented (new refresh token issued on every `/refresh` call, not reused)
- Endpoints built and tested end-to-end: `POST /auth/signup`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`, `PATCH /auth/me`, `POST /auth/change-password`, `DELETE /auth/me`
- Signup relies on the DB `UNIQUE` constraint (catches `IntegrityError`), not a pre-check query — avoids race conditions on duplicate signups
- Login error messages deliberately vague (no email-enumeration leakage)
- `get_current_user` dependency built — protects routes, validates token type, verifies user still exists in DB (not just that the token is validly signed)
- Account deletion requires password re-verification and cleans up Supabase storage files before deleting the DB row (avoids orphaned files)

### Phase 3: File Handling
- Supabase Storage SDK connected using the `service_role` key (server-side only, never exposed to frontend)
- Storage helper functions: `build_storage_path()` (namespaced by `owner_id`, randomized filename prefix to prevent collisions), `upload_file()`, `get_signed_url()` (private bucket — no permanent public URLs, time-limited signed access only), `delete_file()`
- Central `app/config.py` — all limits environment-driven, not hardcoded: `ALLOWED_MIME_TYPES`, `ALLOWED_ORIGINS`, `MAX_ACTIVE_DOCUMENTS`, `MAX_FILE_SIZE`, `RECYCLE_BIN_RETENTION_DAYS`, `CHUNK_SIZE_TOKENS`, `CHUNK_OVERLAP_TOKENS`
- **Upload endpoint** (`POST /documents/upload`): validates MIME type, file size, and active document count (counting `processing` + `active` together) before uploading to Supabase and creating the `Document` row
- **Document parsing** (`app/parsing.py`) — MIME-type registry pattern (`PARSERS` dict) for easy extension. `PyMuPDF` for PDF, `python-docx` for DOCX, `python-pptx` for PPTX, direct decode for TXT
- **Chunking** (`app/chunking.py`) — custom recursive splitter (paragraph → sentence fallback), no LangChain dependency. Uses the real `bge-small` tokenizer for exact token counts. 400 tokens per chunk, 50 token overlap
- **Embeddings** (`app/embeddings.py`) — `BAAI/bge-small-en-v1.5` loaded once at import time, batched encoding, `normalize_embeddings=True`
- **Processing pipeline** (`app/processing.py`) — parsing → chunking → embedding → `Chunk` rows → `Document.status` update, in one function with its own DB session. Any failure sets `status = failed` rather than leaving it stuck at `processing`
- **Background processing** via FastAPI's `BackgroundTasks` — upload returns instantly with `status: processing`

**Known limitation, accepted for now:** `BackgroundTasks` has no persistence or retry — if the server restarts mid-task, that task is lost silently. Acceptable at solo-project scale; would need a real task queue (Celery/arq + Redis) for production robustness.

### Phase 4: RAG Chat
- Retrieval (`app/retrieval.py`) — embeds the user's question (bge's query instruction prefix applied), retrieves top-K chunks via pgvector cosine distance, strictly scoped to `owner_id` + `status = active` (optionally further scoped to specific `document_ids`, still re-checked against ownership)
- LLM generation (`app/llm.py`) via Groq (`llama-3.1-8b-instant`) — grounded-only prompting by default (v1): answers only from retrieved chunks, explicitly says when the answer isn't found rather than guessing
- `HYBRID_MODE_ENABLED` flag wired end-to-end (env default + per-request override + settings-page toggle) but off by default — when enabled, the LLM may fall back to general knowledge but must clearly flag that portion of the answer as not sourced from the user's documents
- `POST /chat/ask` returns the answer, sources (filename + chunk preview), and which mode was actually used

### Phase 5: Frontend Integration — ✅ COMPLETE
- `api.js` fully rewired — every call (auth, documents, chat, profile, settings) hits the real FastAPI backend over HTTP; all `localStorage`-mock internals removed
- **CORS configured** — `CORSMiddleware` added to `main.py`, allowed origins driven by `ALLOWED_ORIGINS` env var (same pattern as `ALLOWED_MIME_TYPES`)
- Upload polling replaces the old fake `setTimeout` — frontend polls real document status until processing completes
- Full manual end-to-end browser testing completed and passed:
  - Happy path: signup → login → upload → chat → documents → profile → settings → logout
  - Failure paths: wrong password, duplicate signup email, bin auto-eviction at 5-item cap
- **Upload-limit overflow bug found and fixed:** the original flow auto-deleted the oldest active document and immediately uploaded the new one in one chained action. This caused a race where the new document's chunking/embedding pipeline silently failed. Fixed by removing the auto-delete-and-upload chain entirely — hitting the document limit now shows a blocking notice ("delete a document first, then upload"), no automatic eviction of active documents. (Bin auto-eviction at its own 5-item cap is unaffected — that's a delete-only action, no chaining involved.)

---

## ⏸️ DEFERRED / SKIPPED (intentionally, for V2 or later)

- **Mid-upload failure edge case**: file uploads to Supabase successfully but the Neon DB commit fails afterward → orphaned file with no DB record. Needs a saga pattern or scheduled cleanup job.
- **`chunk_text()` hard fallback**: no forced token-count split when a single sentence exceeds `CHUNK_SIZE_TOKENS` (e.g. unpunctuated PDF table dumps). Needs a last-resort split.
- **MIME type hardening**: currently trusts client-supplied `content_type` header (spoofable); harden with actual file content sniffing later.
- **True refresh token invalidation** — tokens are rotated on each refresh, but old tokens aren't actively invalidated server-side (no blocklist yet). Fully stateless for now.
- **Chat history / multi-turn conversation storage** — not yet designed. Current chat is single-turn, no persistence.
- **Admin panel** — deferred; would need a `role` field added to `users`.
- **Google OAuth login** — deferred.
- **Fine-tuning** — deferred.
- **OCR support** — deferred.
- **Legacy `.doc`/`.ppt` parsing** — deferred (registry pattern makes adding this later a small change).
- **Full UI/UX accessibility audit** — deferred.
- **requirements.txt hygiene** — was previously saved as UTF-16 (Windows `pip freeze` artifact), converted to UTF-8 — watch for this recurring if regenerated on Windows again.

---

## 🧠 Key Architectural Principles Established
(These should hold for all future work on this project.)

- DB-level constraint enforcement over application-level checks where correctness matters (e.g. email uniqueness)
- Always manually review Alembic migration files before running — autogenerate has known blind spots
- All limits/config driven by `.env` → `app/config.py`, never hardcoded magic numbers
- Cascade deletes used deliberately (`users` → `documents` → `chunks`) to avoid orphaned rows
- Soft-delete pattern for documents (`status` + `deleted_at`) rather than a separate recycle-bin table — one source of truth
- Private storage bucket + signed URLs only — no permanent public file URLs
- FastAPI route registration order matters: static/literal paths (`/documents/bin`) must be declared before dynamic-segment paths (`/documents/{id}`) that could shadow them
- **Avoid chaining destructive + creative actions in one user-triggered flow** (e.g. auto-delete + auto-upload) — split into separate, independently-verifiable actions instead. Compound actions hide race conditions and partial-failure states.
- Step-by-step build with verification gates — nothing is assumed working until actually tested, in a real browser, not just via API-level test scripts

---

## 📍 Where We Pick Up Next
**V1 is functionally complete and closed.** Next: tag this commit as `v1.0`, then move to **V2 planning** on the `development` branch.