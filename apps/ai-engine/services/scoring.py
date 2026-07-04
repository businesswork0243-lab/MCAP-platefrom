"""
Standalone scoring endpoint — wraps QA agent for direct scoring requests.
Used by /score endpoint in main.py.
"""
import hashlib
import logging
from agents import qa_agent

log = logging.getLogger("ai-engine.scoring")

# ─── Simple in-memory cache ───────────────────────────────────────────────────
# Prevents re-scoring identical content (common during UI refreshes)

_score_cache: dict[str, dict] = {}
_CACHE_MAX = 100  # Max entries before cleanup

def _cache_key(content: str, brand_profile: dict | None) -> str:
    """Generate deterministic cache key."""
    brand_str = str(sorted(brand_profile.items())) if brand_profile else "none"
    raw = f"{content[:500]}|{brand_str[:200]}"
    return hashlib.md5(raw.encode()).hexdigest()


def _get_cached(key: str) -> dict | None:
    return _score_cache.get(key)


def _set_cached(key: str, result: dict) -> None:
    # Simple LRU — just evict oldest if at capacity
    if len(_score_cache) >= _CACHE_MAX:
        oldest = next(iter(_score_cache))
        del _score_cache[oldest]
    _score_cache[key] = result


# ─── Score Entry Point ────────────────────────────────────────────────────────

async def score(
    content:      str,
    brand_profile: dict | None = None,
    seo_enabled:  bool         = False,
    seo_settings: dict         = None,
    use_cache:    bool         = True,
) -> dict:
    """
    Score content quality.

    Args:
        content:       Content to score
        brand_profile: Brand profile for brand alignment scoring
        seo_enabled:   Whether to check SEO requirements
        seo_settings:  SEO settings (primaryKeyword, etc.)
        use_cache:     Use cached result if available (default True)

    Returns:
        Full QA result dict
    """
    if not content or not content.strip():
        return {
            "overallScore": 0,
            "passed":       False,
            "flags":        ["content_empty"],
            "suggestions":  ["No content to score"],
            "summary":      "No content provided",
            "tokensUsed":   0,
            "agent":        "scoring",
        }

    # ── Cache check ───────────────────────────────────────────────────────────
    if use_cache:
        cache_key = _cache_key(content, brand_profile)
        if cached := _get_cached(cache_key):
            log.debug("Score cache hit")
            return {**cached, "cached": True}

    # ── Run QA ────────────────────────────────────────────────────────────────
    log.info("Scoring content | length=%d chars", len(content))

    result = await qa_agent.run(
        content=content,
        brand_profile=brand_profile,
        seo_enabled=seo_enabled,
        seo_settings=seo_settings,
    )

    # ── Cache result ──────────────────────────────────────────────────────────
    if use_cache:
        _set_cached(cache_key, result)

    return result
