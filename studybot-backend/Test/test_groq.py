"""
Tests Groq API connectivity and a basic chat completion call.
Run from the `backend/` folder: python Test/test_groq.py
"""

from groq import Groq
from app.config import GROQ_API_KEY, GROQ_MODEL_NAME


def main():
    client = Groq(api_key=GROQ_API_KEY)

    print("Sending test request to Groq...")

    response = client.chat.completions.create(
        model=GROQ_MODEL_NAME,
        messages=[
            {"role": "user", "content": "Say 'StudyBot backend connected successfully' and nothing else."}
        ],
        temperature=0.3,
    )

    answer = response.choices[0].message.content
    print(f"\n✅ Response received:\n{answer}")

    # Quick visibility into usage — useful for keeping an eye on free-tier limits
    if hasattr(response, "usage"):
        print(f"\nToken usage — prompt: {response.usage.prompt_tokens}, "
              f"completion: {response.usage.completion_tokens}, "
              f"total: {response.usage.total_tokens}")

    print("\n✅ PASSED: Groq API connectivity confirmed.")


if __name__ == "__main__":
    main()