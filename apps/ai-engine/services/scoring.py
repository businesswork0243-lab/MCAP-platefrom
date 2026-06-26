"""Standalone scoring endpoint — wraps QA agent for direct scoring requests."""
from agents import qa_agent


async def score(content: str, brand_profile: dict | None = None) -> dict:
    return await qa_agent.run(content, brand_profile)
