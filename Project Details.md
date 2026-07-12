# StudyBot: Chat with Files

## Overview
StudyBot solves a common problem for college students: important information scattered across multiple documents (notes, PDFs, presentations, files) makes revision and information retrieval difficult and time-consuming.

The solution is a document-aware AI chatbot powered by **Retrieval-Augmented Generation (RAG)**. Users upload study materials and ask natural language questions to receive accurate, context-aware answers directly from their own documents.

## Target Users

**Primary Users:**
- College students needing quick exam revision
- Users seeking fast answers from notes and presentations
- Students wanting efficient learning and quick recaps of large syllabi

**Secondary Users:**
- Professionals, developers, and researchers needing AI-assisted document understanding
- Designed with student-first UX while remaining accessible to general audiences

## Core Features

### User Management
- Simple authentication with username and password
- Isolated document storage and chat context per user

### Document Upload & Management
- **Supported formats:** PDF, PPT, DOCX, TXT
- **OCR support** for extracting text from images
- **File limit:** 3–5 documents per user
- **Deletion options:** Auto-delete oldest or manually select documents

### Document Understanding Pipeline
- Text extraction with OCR for image-based content
- Intelligent chunking optimized for student notes
- Embedding generation and semantic search via vector database

### AI Chatbot (RAG-Based)
- Natural language questions with document-grounded answers
- **Scope control:** Search all documents or specific ones
- **Two operating modes:**
    - **Strict Mode (Default):** Answers only from uploaded documents
    - **Hybrid Mode (Optional):** Falls back to general AI if confidence is low

### Fine-Tuned Language Model
- Instruction/LoRA-based fine-tuning
- Optimized for student-friendly, concise explanations
- Reduces hallucinations with strict context adherence
- User documents not used in training (privacy-first)

## System Philosophy

A student-focused, document-grounded AI assistant with optional general intelligence fallback—balancing accuracy, usability, transparency, and user control.

## Technical Stack

- Python backend
- RAG architecture with vector database
- OCR for image processing
- Cloud-ready, modular design

## Future Roadmap

- Advanced fine-tuning strategies
- Expanded document limits
- Role-based access (teachers, teams)
- Shared documents
- Voice-based interaction
- Analytics and usage insights
