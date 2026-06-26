"""Agent 5 — Editorial QA: validates quality, brand adherence, and content standards.

Scoring weights per spec (Section 17 — Content Scoring Framework):
  Readability:           15%
  Brand adherence:       20%
  Structure:             10%
  Platform optimization: 15%
  Humanization:          10%
  Consistency:           10%
  Clarity:               10%
  Engagement potential:   5%
  CTA alignment:          5%
"""
import json
from services.llm import complete

SYSTEM = """You are a senior editorial QA specialist. Analyze content and return a structured JSON assessment.
Be precise, objective, and consistent. Flag real issues only — not stylistic preferences."""

USER_TEMPLATE = """Perform a comprehensive editorial QA review of the following content.

CONTENT:
{content}

BRAND PROFILE:
Brand: {brand_name}
Banned phrases: {banned_phrases}
Key messages: {key_messages}

EVALUATE EACH DIMENSION (score 0-100):

1. readabilityScore     — sentence variety, flow, clarity, paragraph structure, accessibility
2. brandScore           — brand voice alignment, terminology consistency, banned phrase compliance
3. structureScore       — logical flow, argument coherence, section completeness, editorial integrity
4. platformScore        — appropriate length, formatting conventions, audience fit for the platform
5. humanizationScore    — naturalness, absence of AI clichés, authentic voice, organic transitions
6. consistencyScore     — consistent tone, tense, perspective, terminology throughout
7. clarityScore         — precise language, unambiguous statements, no vague filler
8. engagementScore      — hook quality, reader retention, compelling narrative
9. ctaScore             — CTA relevance, placement, and persuasiveness (score 50 if no CTA)

IDENTIFY FLAGS (concrete issues to fix):
- Banned phrases still present
- Repeated words/phrases (same significant word 4+ times)
- Sentences over 35 words
- Vague unsupported claims
- Structural gaps in the chosen writing flow
- Formatting issues

RESPOND ONLY WITH THIS JSON (no other text):
{{
  "readabilityScore": <0-100>,
  "brandScore": <0-100>,
  "structureScore": <0-100>,
  "platformScore": <0-100>,
  "humanizationScore": <0-100>,
  "consistencyScore": <0-100>,
  "clarityScore": <0-100>,
  "engagementScore": <0-100>,
  "ctaScore": <0-100>,
  "flags": ["flag1", "flag2"],
  "suggestions": ["suggestion1", "suggestion2"],
  "summary": "One sentence overall assessment"
}}"""

# Spec-defined weights (Section 17)
SCORE_WEIGHTS = {
    "readabilityScore":     0.15,
    "brandScore":           0.20,
    "structureScore":       0.10,
    "platformScore":        0.15,
    "humanizationScore":    0.10,
    "consistencyScore":     0.10,
    "clarityScore":         0.10,
    "engagementScore":      0.05,
    "ctaScore":             0.05,
}

PASS_THRESHOLD = 70


def _compute_weighted_score(scores: dict) -> int:
    total = sum(
        scores.get(key, 70) * weight
        for key, weight in SCORE_WEIGHTS.items()
    )
    return round(total)


def _local_flags(content: str, banned_phrases: list[str]) -> list[str]:
    flags = []

    for phrase in banned_phrases:
        if phrase.lower() in content.lower():
            flags.append(f'banned_phrase: "{phrase}"')

    from collections import Counter
    words = content.lower().split()
    word_counts = Counter(w.strip(".,!?;:\"'") for w in words if len(w) > 5)
    for word, count in word_counts.items():
        if count >= 5:
            flags.append(f'overused_word: "{word}" ({count}×)')

    sentences = [s.strip() for s in content.replace("!", ".").replace("?", ".").split(".") if s.strip()]
    long_count = sum(1 for s in sentences if len(s.split()) > 35)
    if long_count >= 2:
        flags.append(f"sentences_too_long ({long_count} sentences over 35 words)")

    if len(content.split()) < 50:
        flags.append("content_too_short")

    return flags


async def run(content: str, brand_profile: dict | None = None) -> dict:
    brand_name = brand_profile.get("name", "Not specified") if brand_profile else "Not specified"
    banned_phrases = brand_profile.get("banned_phrases", []) if brand_profile else []
    key_messages = brand_profile.get("key_messages", []) if brand_profile else []

    user_prompt = USER_TEMPLATE.format(
        content=content,
        brand_name=brand_name,
        banned_phrases=", ".join(banned_phrases) if banned_phrases else "None",
        key_messages="\n".join(f"• {m}" for m in key_messages) if key_messages else "None",
    )

    raw, tokens = await complete(SYSTEM, user_prompt, temperature=0.3, max_tokens=900)

    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        scores = json.loads(raw[start:end])
    except Exception:
        scores = {k: 70 for k in SCORE_WEIGHTS}
        scores["flags"] = []
        scores["suggestions"] = []
        scores["summary"] = "QA parsing failed — using defaults"

    local_flags = _local_flags(content, banned_phrases)
    all_flags = list(dict.fromkeys(scores.get("flags", []) + local_flags))

    overall = _compute_weighted_score(scores)

    return {
        # Weighted breakdown
        "readabilityScore":     scores.get("readabilityScore", 70),
        "brandScore":           scores.get("brandScore", 70),
        "structureScore":       scores.get("structureScore", 70),
        "platformScore":        scores.get("platformScore", 70),
        "humanizationScore":    scores.get("humanizationScore", 70),
        "consistencyScore":     scores.get("consistencyScore", 70),
        "clarityScore":         scores.get("clarityScore", 70),
        "engagementScore":      scores.get("engagementScore", 70),
        "ctaScore":             scores.get("ctaScore", 50),
        # Composite
        "overallScore":  overall,
        "flags":         all_flags,
        "suggestions":   scores.get("suggestions", []),
        "summary":       scores.get("summary", ""),
        "passed":        overall >= PASS_THRESHOLD and len(all_flags) == 0,
        "tokensUsed":    tokens,
        "agent":         "qa",
        "weights":       SCORE_WEIGHTS,
    }
