from groq import Groq

from app.config import GROQ_API_KEY, HYBRID_MODE_ENABLED, GROQ_MODEL_NAME

client = Groq(api_key=GROQ_API_KEY)

def _build_system_prompt(hybrid: bool) -> str:
    if hybrid:
        return (
            "You are StudyBot, an assistant that answers questions using the "
            "student's uploaded study documents. Prioritize the provided context "
            "below. If the context fully answers the question, answer using ONLY "
            "that context and cite the source filename(s). If the context is "
            "insufficient or missing, you MAY answer from your own general "
            "knowledge — but you MUST clearly prefix that portion of your answer "
            "with: '⚠️ This part is not from your uploaded documents:-\n' so the "
            "student knows exactly which information is grounded and which isn't."
        )
    return (
        "You are StudyBot, an assistant that answers questions using ONLY the "
        "student's uploaded study documents provided as context below. Do not "
        "use any outside knowledge. If the answer is not contained in the "
        "provided context, say clearly: 'I couldn't find this in your uploaded "
        "documents.' Do not guess or make up information. When you do answer, "
        "cite which source document(s) you drew from."
    )




def _build_context_block(chunks_with_sources: list[tuple[str, str]]) -> str:
    """chunks_with_sources: list of (chunk_content, filename) tuples."""
    if not chunks_with_sources:
        return "(No relevant document content was found for this question.)"

    parts = []
    for i, (content, filename) in enumerate(chunks_with_sources, start=1):
        parts.append(f"[Source {i} — {filename}]\n{content}")
    return "\n\n".join(parts)


def generate_answer(question: str, chunks_with_sources: list[tuple[str, str]], hybrid: bool) -> str:
    system_prompt = _build_system_prompt(hybrid)
    context_block = _build_context_block(chunks_with_sources)

    user_message = (
        f"Context from the student's documents:\n\n{context_block}\n\n"
        f"Question: {question}"
    )

    response = client.chat.completions.create(
        model=GROQ_MODEL_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        temperature=0.3,
    )

    return response.choices[0].message.content