"""LLM abstraction — prefers Claude if OPENAI_API_KEY is absent, else GPT-4o primary."""
import os
import logging
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

import anthropic
import openai

log = logging.getLogger("ai-engine")

ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_KEY    = os.getenv("OPENAI_API_KEY", "")

CLAUDE_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
GPT_MODEL    = os.getenv("OPENAI_MODEL",    "gpt-4o")

OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL") or None  # empty string → None

_DEFAULT_PREFER = "openai" if OPENAI_KEY else "claude"

_anthropic_client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_KEY) if ANTHROPIC_KEY else None
_openai_client    = openai.AsyncOpenAI(api_key=OPENAI_KEY, base_url=OPENAI_BASE_URL) if OPENAI_KEY else None

# Startup diagnostics — visible in Render logs
log.info("LLM config: primary=%s | anthropic=%s | openai=%s | openai_base=%s",
         _DEFAULT_PREFER,
         "SET" if ANTHROPIC_KEY else "NOT SET",
         "SET" if OPENAI_KEY else "NOT SET",
         OPENAI_BASE_URL or "default (api.openai.com)")


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((
        anthropic.RateLimitError,
        anthropic.APITimeoutError,
        anthropic.APIConnectionError,
    )),
)
async def complete_claude(
    system: str, user: str, temperature: float = 0.7, max_tokens: int = 4096
) -> tuple[str, int]:
    if not _anthropic_client:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    resp = await _anthropic_client.messages.create(
        model=CLAUDE_MODEL,
        system=system,
        messages=[{"role": "user", "content": user}],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    text   = resp.content[0].text if resp.content else ""
    tokens = (resp.usage.input_tokens + resp.usage.output_tokens) if resp.usage else 0
    return text, tokens


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((
        openai.RateLimitError,
        openai.APITimeoutError,
        openai.APIConnectionError,  # was missing — connection errors now retry
    )),
)
async def complete_openai(
    system: str, user: str, temperature: float = 0.7, max_tokens: int = 4096
) -> tuple[str, int]:
    if not _openai_client:
        raise RuntimeError("OPENAI_API_KEY not set")
    resp = await _openai_client.chat.completions.create(
        model=GPT_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    text   = resp.choices[0].message.content or ""
    tokens = resp.usage.total_tokens if resp.usage else 0
    return text, tokens


async def complete(
    system: str,
    user: str,
    temperature: float = 0.7,
    max_tokens: int = 4096,
    prefer: str | None = None,
) -> tuple[str, int]:
    """Call primary provider; fall back to secondary on failure."""
    primary = prefer or _DEFAULT_PREFER

    async def _call(provider: str) -> tuple[str, int]:
        if provider == "claude":
            return await complete_claude(system, user, temperature, max_tokens)
        return await complete_openai(system, user, temperature, max_tokens)

    secondary = "openai" if primary == "claude" else "claude"

    try:
        return await _call(primary)
    except Exception as primary_err:
        log.warning("Primary LLM (%s) failed: %s", primary, primary_err)
        has_secondary = (secondary == "claude" and ANTHROPIC_KEY) or (secondary == "openai" and OPENAI_KEY)
        if has_secondary:
            try:
                log.info("Falling back to %s", secondary)
                return await _call(secondary)
            except Exception as fallback_err:
                raise RuntimeError(f"Both providers failed — {primary}: {primary_err} | {secondary}: {fallback_err}")
        raise RuntimeError(f"LLM call failed ({primary}): {primary_err}")
