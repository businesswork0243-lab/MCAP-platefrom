"""Agent 4 — Humanization Engine: makes content sound naturally written by a human expert."""
from services.llm import complete

SYSTEM = """You are an expert editor who transforms AI-generated content into naturally human-written prose.
Your goal is to improve readability and naturalness without compromising professionalism or factual accuracy.
The result should read as if written by a thoughtful, senior professional — not a chatbot."""

BANNED_AI_PHRASES = [
    "In today's fast-paced world",
    "It is important to note",
    "It's worth noting",
    "In conclusion",
    "To summarize",
    "Game-changing",
    "Groundbreaking",
    "Revolutionary",
    "Robust",
    "Seamless",
    "Leverage",
    "Utilize",
    "Synergy",
    "Paradigm shift",
    "Delve into",
    "It goes without saying",
    "Needless to say",
    "In the realm of",
    "In the world of",
    "At the end of the day",
    "Move the needle",
    "Low-hanging fruit",
    "Circle back",
    "Touch base",
    "Deep dive",
    "Holistic approach",
    "Best-in-class",
    "Cutting-edge",
    "State-of-the-art",
]

INTENSITY_INSTRUCTIONS = {
    "light": """
- Make minimal changes — only remove the most obvious AI phrases
- Keep sentence structure largely intact
- Preserve all formatting and section headings
- Fix only clear robotic patterns""",
    "medium": """
- Vary sentence lengths — mix short punchy sentences with longer ones
- Replace ALL banned AI phrases with natural alternatives
- Add subtle transitions that feel organic
- Adjust rhythm so paragraphs don't all feel the same length
- Keep professional tone throughout""",
    "aggressive": """
- Substantially rewrite for maximum naturalness
- Vary sentence structure, rhythm, and pacing throughout
- Add natural micro-observations where appropriate (brief, credible, not fabricated)
- Use controlled contractions where they feel natural
- Remove any remaining robotic cadence
- The result should feel like a senior professional wrote it from scratch""",
}

USER_TEMPLATE = """Humanize the following content.

CONTENT:
{content}

HUMANIZATION INTENSITY: {intensity}
{intensity_instructions}

BANNED PHRASES TO ELIMINATE (replace with natural alternatives):
{banned_phrases}

STYLE PRESERVATION:
- Keep technical terms and industry vocabulary intact
- Preserve all facts, statistics, and data exactly
- Maintain the professional register appropriate for the audience
- Do NOT add unverified claims, anecdotes, or fabricated details

OUTPUT: Write only the humanized content. No commentary."""


async def run(content: str, intensity: str = "medium") -> dict:
    if intensity not in INTENSITY_INSTRUCTIONS:
        intensity = "medium"

    banned = "\n".join(f"• {p}" for p in BANNED_AI_PHRASES)
    instructions = INTENSITY_INSTRUCTIONS[intensity]

    user_prompt = USER_TEMPLATE.format(
        content=content,
        intensity=intensity.capitalize(),
        intensity_instructions=instructions,
        banned_phrases=banned,
    )

    # Slightly lower temperature for humanization to avoid hallucinations
    result, tokens = await complete(SYSTEM, user_prompt, temperature=0.65, max_tokens=2500)
    return {"content": result, "tokensUsed": tokens, "agent": "humanizer", "intensity": intensity}
