# RAG-Based Ed-Tech Project Summary

## Project Type

RAG-based "Chat with Documents" platform focused on college students.

## Project Goals

* Enable users to chat with their notes, PDFs, PPTs.
* Fast revision and contextual Q&A.
* Fully cloud-hosted and publicly accessible.
* Zero-cost / free-tier only.
* Python-only stack.
* Transparent answering (document-based vs general knowledge).

## Constraints

* No financial support (no paid APIs or infrastructure).
* Cloud-only deployment.
* Python as the only language.
* MVP first, scalable later.

## Finalized Tech Stack

### Frontend

* **Streamlit**
* Hosted on **Streamlit Community Cloud (Free)**
* Public URL sharing.
* Rapid prototyping and iteration.

### Backend

* **FastAPI (Python)**
* Hosted on **Render (Free Tier)**
* Handles file uploads, RAG orchestration, database operations, Gemini API calls, retrieval confidence logic.

### Main Database

* **NeonDB (Serverless PostgreSQL)**
* Free tier.
* Stores user data, file metadata, chunk metadata, chat history, retrieval logs, confidence scores.

### Vector Database

* **NeonDB + pgvector extension**
* Embeddings stored in PostgreSQL.
* Vector similarity search using SQL.
* Suitable for MVP-scale document volumes.

### Embedding Model

* **Sentence Transformers (local, CPU-based)**
* Example models: `all-MiniLM-L6-v2`, `bge-small-en`
* Free, fast, deterministic.

### LLM (Answer Generation)

* **Gemini API**
* Context-aware answer generation.
* General knowledge fallback (user-approved).
* Python SDK integration.

## RAG Methodology

1. User uploads documents.
2. Documents are chunked.
3. Chunks are embedded using local model.
4. Embeddings stored in NeonDB (pgvector).
5. User asks a question.
6. Query is embedded.
7. Similar chunks retrieved via vector similarity.
8. Retrieved context sent to Gemini.
9. Gemini generates final response.

## Dynamic Answering Logic

* Compute similarity score from retrieved chunks.
* If confidence < threshold:

  * Inform user answer is not from their documents.
  * User can choose to proceed with a general answer.
* Ensures transparency and trust.

## High-Level Architecture

```
Streamlit UI
   ↓
FastAPI Backend
   ↓
Chunking & Embedding (Local Model)
   ↓
NeonDB (Postgres + pgvector)
   ↓
Similarity Retrieval (SQL)
   ↓
Gemini API
   ↓
Final Answer + Confidence + Sources
```

## Development Phases

### Phase 1 – MVP

* End-to-end document chat.
* Single-user flow.
* Core RAG functionality.
* Public deployment.

### Phase 2 – Ed-Tech Enhancements

* Subject / semester filtering.
* Revision mode (short answers).
* Source highlighting.

### Phase 3 – Startup-Ready

* Fine-tuned prompts or LLM.
* Multi-user support.
* Analytics and usage insights.

## Final Outcome

* Fully cloud-based.
* Zero-cost MVP.
* Python-only implementation.
* Real-world RAG system (not a demo).
* Resume, startup, and investor ready.
