"""Agent 3 — Brand Optimizer: injects organizational identity into content."""
from services.llm import complete

SYSTEM = """You are a brand strategist and editorial specialist.
Your task is to align content with a specific brand's voice, tone, and guidelines.
Preserve all factual information and strategic meaning. Only modify how things are expressed — not what is said.
Never add unverified claims or fabricated statistics."""

USER_TEMPLATE = """Apply the following brand guidelines to this content.

CONTENT TO BRAND-ALIGN:
{content}

BRAND PROFILE:
- Brand Name: {brand_name}
- Mission: {mission}
- Preferred Tone: {tone_description}
- Formality Level: {formality}/10
- Technical Depth: {technical_depth}/10
- Confidence Level: {confidence}/10
- Emotional Intensity: {emotional_intensity}/10

TERMINOLOGY RULES:
Preferred terms to use: {preferred_terms}
Banned phrases to avoid and replace: {banned_phrases}

KEY MESSAGES to reinforce (weave in naturally where relevant):
{key_messages}

BRAND ALIGNMENT RULES:
1. Replace ALL banned phrases with natural, brand-appropriate alternatives
2. Use preferred terminology consistently throughout
3. Adjust sentence structure to match the formality and confidence levels
4. Reinforce key messages without making them sound forced
5. Keep all facts and data points exactly as they are
6. Do NOT add any information that wasn't in the original

OUTPUT: Write only the brand-aligned content. No commentary."""


def _tone_description(profile: dict) -> str:
    formality = profile.get("formality", 5)
    confidence = profile.get("confidence", 5)
    emotional = profile.get("emotionalIntensity", 5)
    technical = profile.get("technicalDepth", 5)

    parts = []
    if formality >= 7:
        parts.append("formal and professional")
    elif formality <= 4:
        parts.append("conversational and approachable")
    else:
        parts.append("semi-formal")

    if confidence >= 7:
        parts.append("authoritative and assertive")
    elif confidence <= 4:
        parts.append("measured and considerate")

    if emotional <= 3:
        parts.append("analytical with minimal emotion")
    elif emotional >= 7:
        parts.append("warm and emotionally engaging")

    if technical >= 7:
        parts.append("technically deep")
    elif technical <= 3:
        parts.append("accessible and jargon-free")

    return ", ".join(parts) if parts else "professional"


async def run(content: str, brand_profile: dict | None) -> dict:
    if not brand_profile:
        return {"content": content, "tokensUsed": 0, "agent": "brand_optimizer"}

    tone_settings = brand_profile.get("tone_settings") or brand_profile.get("tone") or {}
    preferred_terms = brand_profile.get("preferred_terms") or []
    banned_phrases = brand_profile.get("banned_phrases") or []
    key_messages = brand_profile.get("key_messages") or []

    user_prompt = USER_TEMPLATE.format(
        content=content,
        brand_name=brand_profile.get("name", ""),
        mission=brand_profile.get("mission_statement") or brand_profile.get("missionStatement") or "Not specified",
        tone_description=_tone_description(tone_settings),
        formality=tone_settings.get("formality", 5),
        technical_depth=tone_settings.get("technicalDepth", 5),
        confidence=tone_settings.get("confidence", 5),
        emotional_intensity=tone_settings.get("emotionalIntensity", 5),
        preferred_terms=", ".join(preferred_terms) if preferred_terms else "None specified",
        banned_phrases=", ".join(banned_phrases) if banned_phrases else "None specified",
        key_messages="\n".join(f"• {m}" for m in key_messages) if key_messages else "None specified",
    )

    result, tokens = await complete(SYSTEM, user_prompt, temperature=0.5, max_tokens=2000)
    return {"content": result, "tokensUsed": tokens, "agent": "brand_optimizer"}
