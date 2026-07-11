"""
Text Cleaner — Deterministic AI pattern detection & post-processing.
Runs AFTER LLM humanization as a safety net.
"""
import re
import logging
from typing import Any

log = logging.getLogger("ai-engine.cleaner")

# ─── False Negative Patterns (CRITICAL) ──────────────────────────────────────
# These are the AI writing "tells" — rhetorical denials.
# Example: "It's not just X, it's Y" ← This is the pattern to kill.

FALSE_NEGATIVE_PATTERNS = [
    # "X isn't/is not just..." patterns
    (r"(?i)\b(it'?s|this is|that'?s)\s+not\s+just\b",                     "not just"),
    (r"(?i)\b(it|this|that)\s+isn'?t\s+just\b",                           "isn't just"),
    (r"(?i)\b(it'?s|this is|that'?s)\s+not\s+merely\b",                   "not merely"),
    (r"(?i)\b(it|this|that)\s+isn'?t\s+merely\b",                         "isn't merely"),
    (r"(?i)\b(it'?s|this is|that'?s)\s+not\s+only\b",                     "not only"),
    (r"(?i)\bnot\s+only\s+[^,.]{2,60}\s*,\s*but\s+(also)?\b",             "not only...but"),
    
    # "More than just" pattern
    (r"(?i)\bmore\s+than\s+just\b",                                       "more than just"),
    (r"(?i)\bmore\s+than\s+a\s+(mere|simple)\b",                          "more than a mere"),
    
    # "Not about X, about Y" pattern
    (r"(?i)\b(it'?s|this is)\s+not\s+about\s+[^,.]{2,60}\s*,\s*it'?s\s+about\b", "not about X, about Y"),
    (r"(?i)\bless\s+about\s+[^,.]{2,60}\s+and\s+more\s+about\b",          "less about X, more about"),
    
    # "Far from being" / "Rather than being"
    (r"(?i)\bfar\s+from\s+being\b",                                       "far from being"),
    (r"(?i)\brather\s+than\s+being\b",                                    "rather than being"),
    
    # "Isn't your typical/average/ordinary"
    (r"(?i)\b(it|this|that)\s+isn'?t\s+your\s+(typical|average|ordinary|usual)\b", "isn't your typical"),
    
    # "Not X but Y" contrastive
    (r"(?i)\bnot\s+(a|an|the)\s+[^,.]{2,40}\s*,?\s*but\s+(a|an|the)\b",   "not a X, but a Y"),
]

# ─── AI Opening Cliches ──────────────────────────────────────────────────────

AI_OPENING_PATTERNS = [
    r"^In today'?s\s+(fast-paced|rapidly evolving|digital|modern|complex|dynamic|ever-changing)\s+(world|landscape|era|age|environment),?\s*",
    r"^In the\s+(ever-changing|dynamic|evolving|modern)\s+(world|landscape|realm)\s+of\s+[^,.]{2,60},?\s*",
    r"^In an era\s+where\s+[^,.]{2,80},?\s*",
    r"^In the realm\s+of\s+[^,.]{2,60},?\s*",
    r"^When it comes to\s+[^,.]{2,60},?\s*",
    r"^At\s+(its|the)\s+(core|heart)\s+of\s+[^,.]{2,60},?\s*",
    r"^It goes without saying\s+that\s+",
    r"^Needless to say,?\s*",
]

# ─── Formulaic Transitions ───────────────────────────────────────────────────

TRANSITION_REPLACEMENTS = [
    (r"(?<=[.!?])\s+Moreover,?\s+",              " Also, "),
    (r"(?<=[.!?])\s+Furthermore,?\s+",           " And "),
    (r"(?<=[.!?])\s+Additionally,?\s+",          " Plus, "),
    (r"(?<=[.!?])\s+Consequently,?\s+",          " So "),
    (r"(?<=[.!?])\s+In conclusion,?\s+",         " "),
    (r"(?<=[.!?])\s+To put it simply,?\s+",      " "),
    (r"(?<=[.!?])\s+That being said,?\s+",       " Still, "),
    (r"(?<=[.!?])\s+With that in mind,?\s+",     " "),
    (r"(?<=[.!?])\s+In summary,?\s+",            " "),
    (r"(?<=[.!?])\s+To summarize,?\s+",          " "),
]

# ─── Hedging Removals ────────────────────────────────────────────────────────

HEDGING_REMOVALS = [
    r"(?i)\bIt'?s worth (noting|mentioning|considering) that\s+",
    r"(?i)\bIt'?s important to (note|remember|understand|recognize) that\s+",
    r"(?i)\bOne could argue that\s+",
    r"(?i)\bIt could be said that\s+",
    r"(?i)\bIt is important to note that\s+",
]

# ─── Buzzword Replacements ───────────────────────────────────────────────────

BUZZWORD_REPLACEMENTS = [
    (r"(?i)\butilize(s|d|ing)?\b",     lambda m: "use" + (m.group(1) or "")),
    (r"(?i)\bleverage(s|d|ing)?\b",    lambda m: "use" + (m.group(1) or "")),
    (r"(?i)\bfacilitate(s|d|ing)?\b",  lambda m: "enable" + (m.group(1) or "")),
    (r"(?i)\bcommence(s|d|ing)?\b",    lambda m: "start" + (m.group(1) or "")),
    (r"(?i)\bendeavor(s|ed|ing)?\b",   lambda m: "try" + (m.group(1) or "")),
    (r"(?i)\boperationalize(s|d|ing)?\b", lambda m: "run" + (m.group(1) or "")),
]

# ─── Detection ────────────────────────────────────────────────────────────────

def detect_false_negatives(text: str) -> list[dict]:
    """
    Find all false negative patterns in text.
    Returns list of matches with position and pattern name.
    """
    findings = []
    for pattern, name in FALSE_NEGATIVE_PATTERNS:
        for match in re.finditer(pattern, text):
            findings.append({
                "pattern": name,
                "match":   match.group(0)[:80],
                "start":   match.start(),
                "end":     match.end(),
            })
    return findings


def detect_all_patterns(text: str) -> dict[str, Any]:
    """
    Full AI pattern detection.
    Returns dict with all categories and counts.
    """
    false_negs = detect_false_negatives(text)
    
    ai_openings = sum(
        1 for p in AI_OPENING_PATTERNS
        if re.search(p, text, re.MULTILINE | re.IGNORECASE)
    )
    
    hedging = sum(
        len(re.findall(p, text))
        for p in HEDGING_REMOVALS
    )
    
    buzzwords = sum(
        len(re.findall(p, text))
        for p, _ in BUZZWORD_REPLACEMENTS
    )
    
    transitions = sum(
        len(re.findall(p, text))
        for p, _ in TRANSITION_REPLACEMENTS
    )
    
    return {
        "false_negatives":     false_negs,
        "false_negative_count": len(false_negs),
        "ai_openings":         ai_openings,
        "hedging":             hedging,
        "buzzwords":           buzzwords,
        "transitions":         transitions,
        "total_issues":        len(false_negs) + ai_openings + hedging + buzzwords + transitions,
    }


# ─── Cleanup Functions ────────────────────────────────────────────────────────

def remove_ai_openings(text: str) -> tuple[str, int]:
    """Remove common AI opening phrases from paragraph starts."""
    count = 0
    for pattern in AI_OPENING_PATTERNS:
        new_text = re.sub(pattern, "", text, flags=re.MULTILINE | re.IGNORECASE)
        if new_text != text:
            count += 1
            text = new_text
    return text.strip(), count


def replace_transitions(text: str) -> tuple[str, int]:
    """Replace formulaic AI transitions with natural alternatives."""
    count = 0
    for pattern, replacement in TRANSITION_REPLACEMENTS:
        matches = re.findall(pattern, text)
        if matches:
            count += len(matches)
            text = re.sub(pattern, replacement, text)
    return text, count


def remove_hedging(text: str) -> tuple[str, int]:
    """Remove weak hedging phrases."""
    count = 0
    for pattern in HEDGING_REMOVALS:
        matches = re.findall(pattern, text)
        if matches:
            count += len(matches)
            # Capitalize next word after removal
            text = re.sub(
                pattern,
                lambda m: "",
                text
            )
    return text, count


def replace_buzzwords(text: str) -> tuple[str, int]:
    """Replace corporate buzzwords with simpler alternatives."""
    count = 0
    for pattern, replacement in BUZZWORD_REPLACEMENTS:
        matches = re.findall(pattern, text)
        if matches:
            count += len(matches)
            text = re.sub(pattern, replacement, text)
    return text, count


def normalize_whitespace(text: str) -> str:
    """Clean up double spaces, empty lines, orphan punctuation."""
    # Multiple spaces → single
    text = re.sub(r' {2,}', ' ', text)
    # Multiple newlines → double newline max
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Orphan punctuation from removals: ", ." → "."
    text = re.sub(r',\s*([.!?])', r'\1', text)
    # Sentence-start capitalization after removals
    text = re.sub(
        r'(^|[.!?]\s+)([a-z])',
        lambda m: m.group(1) + m.group(2).upper(),
        text
    )
    return text.strip()


# ─── Main Cleanup Pipeline ────────────────────────────────────────────────────

def clean_ai_patterns(
    text: str,
    intensity: str = "medium",
) -> dict[str, Any]:
    """
    Full deterministic cleanup pipeline.
    
    Args:
        text:      Content to clean
        intensity: light | medium | aggressive (controls how much to strip)
    
    Returns:
        {
          "content":     cleaned text,
          "stats":       cleanup counts,
          "detections":  pre/post pattern counts,
        }
    """
    if not text or not text.strip():
        return {"content": text, "stats": {}, "detections": {}}
    
    original = text
    pre_detections = detect_all_patterns(text)
    
    stats = {
        "original_length":       len(text),
        "openings_removed":      0,
        "transitions_replaced":  0,
        "hedging_removed":       0,
        "buzzwords_replaced":    0,
    }
    
    # Step 1: Remove AI openings (always)
    text, stats["openings_removed"] = remove_ai_openings(text)
    
    # Step 2: Replace transitions (medium+)
    if intensity in ("medium", "aggressive"):
        text, stats["transitions_replaced"] = replace_transitions(text)
    
    # Step 3: Remove hedging (aggressive only — surgical)
    if intensity == "aggressive":
        text, stats["hedging_removed"] = remove_hedging(text)
        text, stats["buzzwords_replaced"] = replace_buzzwords(text)
    
    # Step 4: Whitespace normalize
    text = normalize_whitespace(text)
    
    stats["final_length"] = len(text)
    post_detections = detect_all_patterns(text)
    
    # Improvement metrics
    total_removed = sum([
        stats["openings_removed"],
        stats["transitions_replaced"],
        stats["hedging_removed"],
        stats["buzzwords_replaced"],
    ])
    
    log.info(
        "Cleaner | intensity=%s | pre_issues=%d | post_issues=%d | "
        "false_negs_pre=%d | false_negs_post=%d | changes=%d",
        intensity,
        pre_detections["total_issues"],
        post_detections["total_issues"],
        pre_detections["false_negative_count"],
        post_detections["false_negative_count"],
        total_removed,
    )
    
    return {
        "content": text,
        "stats":   stats,
        "detections": {
            "before": {
                "false_negatives": pre_detections["false_negative_count"],
                "ai_openings":     pre_detections["ai_openings"],
                "hedging":         pre_detections["hedging"],
                "buzzwords":       pre_detections["buzzwords"],
                "transitions":     pre_detections["transitions"],
                "total":           pre_detections["total_issues"],
            },
            "after": {
                "false_negatives": post_detections["false_negative_count"],
                "ai_openings":     post_detections["ai_openings"],
                "hedging":         post_detections["hedging"],
                "buzzwords":       post_detections["buzzwords"],
                "transitions":     post_detections["transitions"],
                "total":           post_detections["total_issues"],
            },
        },
    }
