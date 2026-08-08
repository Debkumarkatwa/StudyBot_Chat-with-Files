# StudyBot_Chat-with-Files
This is the container of my Project "StudyBot". You will get everything about the project here. For details please read readme.md

# Run The Server
uvicorn app.main:app --reload


# StudyBot Backend — Development Checkpoint

**Date:** August 2026
**Status:** Phase 3 in progress (File handling)

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
- **`documents`** — UUID PK, `owner_id` FK → `users.id` (`ON DELETE CASCADE`), `filename`, `file_type`, `storage_path`, `status` (Postgres ENUM: `processing` / `active` / `deleted`), `uploaded_at`, `deleted_at` (nullable, drives 7-day recycle bin)
- **`chunks`** — UUID PK, `document_id` FK → `documents.id` (`ON DELETE CASCADE`), `content` (Text), `embedding` (`Vector(384)`, pgvector), `chunk_index`, `created_at`, HNSW index using `vector_cosine_ops`

**Known Alembic quirks hit and fixed:**
- `pgvector.sqlalchemy` import must be added manually to migration files — autogenerate omits it, causes `NameError` if unfixed
- Enum `DROP TYPE` must be added manually to `downgrade()` — autogenerate skips it, would cause a re-run failure later

### Phase 2: Authentication
- Password hashing via `bcrypt` directly (no wrapper library — chosen over `passlib` due to `passlib`'s stalled maintenance)
- JWT via `PyJWT` (chosen over `python-jose` for cleaner CVE history)
- Access tokens (30 min expiry) + refresh tokens (7 day expiry), both carrying a `type` field (`access`/`refresh`) that's explicitly enforced everywhere — prevents refresh tokens from being used as access tokens and vice versa
- Refresh token **rotation** implemented (new refresh token issued on every `/refresh` call, not reused)
- Endpoints built and tested end-to-end: `POST /auth/signup`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`
- Signup relies on the DB `UNIQUE` constraint (catches `IntegrityError`), not a pre-check query — avoids race conditions on duplicate signups
- Login error messages deliberately vague (no email-enumeration leakage)
- `get_current_user` dependency built — protects routes, validates token type, verifies user still exists in DB (not just that the token is validly signed)

### Phase 3: File Handling — ✅ COMPLETE
- Supabase Storage SDK connected using the `service_role` key (server-side only, never exposed to frontend)
- Storage helper functions: `build_storage_path()` (namespaced by `owner_id`, randomized filename prefix to prevent collisions), `upload_file()`, `get_signed_url()` (private bucket — no permanent public URLs, time-limited signed access only), `delete_file()`
- Central `app/config.py` created — all limits environment-driven, not hardcoded: `ALLOWED_MIME_TYPES`, `MAX_ACTIVE_DOCUMENTS`, `MAX_FILE_SIZE_MB` / `MAX_FILE_SIZE` (bytes), `RECYCLE_BIN_RETENTION_DAYS`, `CHUNK_SIZE_TOKENS`, `CHUNK_OVERLAP_TOKENS`
- **Upload endpoint** (`POST /documents/upload`): validates MIME type, file size, and active document count (counting `processing` + `active` together) before uploading to Supabase and creating the `Document` row
- **Document parsing** (`app/parsing.py`) — MIME-type registry pattern (`PARSERS` dict) for easy extension. `PyMuPDF` for PDF, `python-docx` for DOCX, `python-pptx` for PPTX, direct decode for TXT. Legacy `.doc`/`.ppt` support deliberately dropped from `ALLOWED_MIME_TYPES` but the registry pattern makes re-adding it later a two-line change, no restructuring
- **Chunking** (`app/chunking.py`) — custom lightweight recursive splitter (paragraph → sentence fallback), no LangChain dependency. Uses the real `bge-small` tokenizer for exact token counts (not character estimates). 400 tokens per chunk, 50 token overlap, safely under the model's 512-token limit
- **Embeddings** (`app/embeddings.py`) — `BAAI/bge-small-en-v1.5` loaded once at import time, batched encoding, `normalize_embeddings=True` (required for correct cosine-similarity search against the HNSW index)
- **Processing pipeline** (`app/processing.py`) — ties parsing → chunking → embedding → `Chunk` row creation → `Document.status` update into one function. Opens its own DB session (required since it can run outside request scope). Wrapped in try/except: any failure sets `status = failed` rather than leaving the document silently stuck at `processing`
- **`DocumentStatus` enum extended** with a `failed` value (manual Alembic migration — Postgres enum additions aren't autogenerate-friendly) specifically for this error-visibility purpose
- **Background processing wired into the upload endpoint** via FastAPI's `BackgroundTasks` — upload returns instantly with `status: processing`; pipeline runs after the response is sent. A commented-out synchronous alternative (`await process_document_pipeline(...)`) is left in place in `routes/documents.py` for easy one-line switching if needed (e.g. easier debugging, or moving to a real task queue later)
- **Verified two ways:** (1) a standalone `test_pipeline.py` script that runs parsing → chunking → embedding in isolation with step-by-step pass/fail output, completely separate from the DB/API layer; (2) full end-to-end test through the real `/documents/upload` endpoint, confirmed via terminal logs showing the document successfully processed and chunks created in Neon

**Known limitation, accepted for now:** `BackgroundTasks` has no persistence or retry — if the server restarts mid-task, that task is lost silently (though the document would still show `processing` rather than `failed` in that specific case, since the failure isn't caught by our try/except — it's a process death, not an exception). Acceptable at solo-project scale; would need a real task queue (Celery/arq + Redis) for production robustness.

---

## 🔄 REMAINING

**Phase 3 is fully complete.** Nothing remaining in this phase.

## ⏭️ NOT STARTED (Phase 4 & 5)

**Phase 4: RAG Chat**
- Vector similarity search endpoint (embed user question, query pgvector via HNSW/cosine)
- LLM call to generate grounded answers from retrieved chunks
- Chat history storage — not yet decided if/how conversations persist

**Phase 5: Frontend Integration**
- Replace all `localStorage` calls in `api.js` with real HTTP calls to the backend
- CORS setup
- Full end-to-end testing of every frontend page against the real backend

---

## ⏸️ DEFERRED / SKIPPED (intentionally, for V2 or later)

- **Mid-upload failure edge case**: file uploads to Supabase successfully but the Neon DB commit fails afterward → orphaned file with no DB record. Needs a saga pattern or scheduled cleanup job. *(Explicitly saved to memory.)*
- **True refresh token rotation enforcement** — tokens are rotated on each refresh, but old tokens aren't actively invalidated server-side (no blocklist/last-issued-ID tracking yet). Fully stateless for now; acceptable tradeoff at current scale.
- **Admin panel** — deferred; would need a `role` field added to `users` via a future migration. *(Explicitly saved to memory.)*
- **Google OAuth login** — deferred.
- **Fine-tuning** — deferred.
- **OCR support** — deferred.
- **Full UI/UX accessibility audit** — deferred.

---

## 🧠 Key Architectural Principles Established
(These should hold for all future work on this project.)

- DB-level constraint enforcement over application-level checks where correctness matters (e.g. email uniqueness)
- Always manually review Alembic migration files before running — autogenerate has known blind spots
- All limits/config driven by `.env` → `app/config.py`, never hardcoded magic numbers
- Cascade deletes used deliberately (`users` → `documents` → `chunks`) to avoid orphaned rows
- Soft-delete pattern for documents (`status` + `deleted_at`) rather than a separate recycle-bin table — one source of truth
- Private storage bucket + signed URLs only — no permanent public file URLs
- Step-by-step build with verification gates — nothing is assumed working until actually tested

---

## 📍 Where We Pick Up Next
**Phase 4: RAG Chat** — search/retrieval endpoint (embed query, cosine similarity search via the HNSW index), LLM integration for grounded answers (model/API choice not yet made), and chat history storage strategy (not yet decided).