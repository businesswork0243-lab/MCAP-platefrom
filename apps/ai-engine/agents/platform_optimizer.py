"""Agent 2 — Platform Optimizer: adapts canonical draft to channel-specific format."""
from services.llm import complete

SYSTEM = """You are an expert content strategist specializing in platform-specific content optimization.
You understand the unique formatting, pacing, and stylistic conventions of each publishing channel.
Transform content to fit the platform perfectly while preserving the core strategic message."""

PLATFORM_SPECS = {
    "linkedin_post": {
        "name": "LinkedIn Post",
        "length": "150-300 words",
        "rules": [
            "Start with a bold, attention-grabbing single line (the hook — visible before 'see more')",
            "Use short paragraphs of 1-2 sentences maximum",
            "Add white space between paragraphs for readability",
            "Professional but conversational tone",
            "End with a discussion question or clear CTA",
            "Max 3 relevant hashtags at the end",
            "No bullet-point overuse — use sparingly",
        ],
    },
    "linkedin_article": {
        "name": "LinkedIn Article",
        "length": "800-1200 words",
        "rules": [
            "Formal headline that signals clear value",
            "Structured with H2/H3 subheadings",
            "Professional thought leadership tone",
            "Data and examples encouraged",
            "End with key takeaways section",
        ],
    },
    "x_post": {
        "name": "X (Twitter) Post",
        "length": "240-280 characters",
        "rules": [
            "Single punchy insight or provocative statement",
            "Conversational and direct",
            "No hashtag spam — 0-1 hashtag only",
            "Optional: link to longer content",
        ],
    },
    "x_thread": {
        "name": "X Thread",
        "length": "8-12 tweets, each under 280 characters",
        "rules": [
            "Tweet 1: Bold hook — the most provocative or surprising point",
            "Tweets 2-10: One idea per tweet, numbered (2/10, 3/10...)",
            "Each tweet must stand alone as valuable",
            "Last tweet: Summary + CTA",
            "Format: separate each tweet with '---'",
        ],
    },
    "blog_post": {
        "name": "Blog Post",
        "length": "800-1500 words",
        "rules": [
            "SEO-friendly headline with primary keyword",
            "Introduction that addresses a pain point",
            "Clear H2/H3 subheading structure",
            "Practical, actionable content",
            "Meta description suggestion at the end (1-2 sentences)",
        ],
    },
    "newsletter": {
        "name": "Newsletter",
        "length": "400-700 words",
        "rules": [
            "Warm, personal opening (as if writing to a friend)",
            "Subject line suggestion at the top",
            "Short paragraphs and clear sections",
            "One main insight or story",
            "Clear next step or CTA at the end",
        ],
    },
    "landing_page": {
        "name": "Landing Page Copy",
        "length": "300-600 words",
        "rules": [
            "Headline: Clear value proposition in one line",
            "Subheadline: Expand on the promise",
            "3 benefit bullets (not feature bullets)",
            "Social proof placeholder [TESTIMONIAL]",
            "Single, clear CTA button text",
            "Urgency or scarcity element if relevant",
        ],
    },
    "executive_brief": {
        "name": "Executive Brief",
        "length": "300-500 words",
        "rules": [
            "TL;DR summary at the top (2-3 sentences)",
            "Formal, direct tone — executives are busy",
            "Key findings or recommendations as bullets",
            "Business impact focus (ROI, risk, opportunity)",
            "Action items at the end",
        ],
    },
}

USER_TEMPLATE = """Transform this canonical article into optimized {platform_name} content.

ORIGINAL ARTICLE:
{canonical_draft}

PLATFORM SPECIFICATIONS:
- Target format: {platform_name}
- Target length: {length}
- Platform rules:
{rules}

OUTPUT: Write only the final optimized {platform_name} content. No meta-commentary."""


async def run(canonical_draft: str, target_platform: str) -> dict:
    spec = PLATFORM_SPECS.get(
        target_platform,
        PLATFORM_SPECS["linkedin_post"]
    )

    rules_text = "\n".join(f"  • {r}" for r in spec["rules"])

    user_prompt = USER_TEMPLATE.format(
        platform_name=spec["name"],
        canonical_draft=canonical_draft,
        length=spec["length"],
        rules=rules_text,
    )

    content, tokens = await complete(SYSTEM, user_prompt, temperature=0.7, max_tokens=2000)
    return {"content": content, "tokensUsed": tokens, "agent": "platform_optimizer", "platform": target_platform}
