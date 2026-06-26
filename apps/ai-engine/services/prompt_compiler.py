"""
Prompt Compilation Layer — PDL (Prompt Definition Language)

Spec requirement: Users should never craft complex prompts manually.
The platform compiles user intent into structured machine instructions by merging:
topic, background, deliverable, strategic objective, target audience, brand profile,
content framework, tone config, POV, platform constraints, humanization profile,
compliance rules, editorial preferences.
"""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class PDLRequest:
    """Declarative Prompt Definition Language request — mirrors spec section 4."""
    # Required
    topic: str
    objective: str = "Build thought leadership"

    # Audience & Perspective
    audience: str = "General Business"
    icp_description: str = ""           # Ideal Customer Profile detail
    perspective: str = "Founder"        # Narrative perspective

    # Content Shape
    writing_structure: str = "thesis"   # debate | data_driven | story | thesis | incentive_diagnosis
    platforms: list[str] = field(default_factory=lambda: ["linkedin_post"])
    language: str = "English"
    reading_level: str = "Professional"

    # Context & References
    context: str = ""
    special_instructions: str = ""
    keywords: list[str] = field(default_factory=list)

    # CTA
    cta: str = ""                       # invite_discussion | newsletter | book_consultation | etc.

    # Brand
    brand_profile: Optional[dict] = None

    # Pipeline settings
    enable_humanization: bool = True
    humanization_intensity: str = "medium"  # light | medium | aggressive
    enable_qa: bool = True
    require_approval: bool = False


@dataclass
class CompiledPromptPackage:
    """Output of the compiler — structured instructions for each downstream agent."""
    canonical_instructions: dict
    platform_instructions: dict        # keyed by platform id
    brand_instructions: dict
    humanization_instructions: dict
    qa_instructions: dict
    metadata: dict                     # audit trail of compilation


ICP_EMPHASIS = {
    "C-Suite / Executives": {
        "emphasis": "strategic implications, business risk, and ROI",
        "avoid": "technical implementation details",
        "tone_note": "Executive-level framing — decisions, outcomes, accountability",
    },
    "Technical (CTO, Engineers)": {
        "emphasis": "architecture, performance trade-offs, and implementation specifics",
        "avoid": "generic business fluff",
        "tone_note": "Technical depth expected — precision over simplification",
    },
    "Investors / VCs": {
        "emphasis": "market differentiation, defensibility, adoption risks, and return potential",
        "avoid": "operational minutiae",
        "tone_note": "Frame through the lens of market opportunity and risk",
    },
    "Policymakers": {
        "emphasis": "privacy implications, compliance considerations, and governance impact",
        "avoid": "commercial positioning",
        "tone_note": "Neutral, evidence-based, policy-oriented framing",
    },
    "Marketing Professionals": {
        "emphasis": "audience engagement, messaging effectiveness, and campaign applicability",
        "avoid": "deep technical specs",
        "tone_note": "Practical, creative, and results-oriented",
    },
    "General Business": {
        "emphasis": "practical takeaways and broader business implications",
        "avoid": "excessive jargon",
        "tone_note": "Accessible but substantive",
    },
}

CTA_TEMPLATES = {
    "invite_discussion": "End with an open question that invites the reader to share their perspective.",
    "newsletter": "Close with a soft invitation to subscribe for more insights like this.",
    "book_consultation": "Include a brief CTA to schedule a consultation or discovery call.",
    "download_resource": "Reference a downloadable resource (whitepaper, guide, checklist).",
    "register_event": "Mention an upcoming event and invite registration.",
    "no_cta": "No explicit CTA — let the content speak for itself.",
}

PERSPECTIVE_VOICE = {
    "Founder": "first-person founder voice — personal conviction, hard-won lessons, strategic clarity",
    "CEO": "authoritative executive voice — vision, accountability, organizational direction",
    "CMO / Marketing": "brand-savvy, audience-centric voice — positioning and market narrative",
    "CTO / Technical": "technical authority — architecture decisions, engineering trade-offs",
    "Researcher": "evidence-driven academic voice — data, methodology, measured conclusions",
    "Analyst": "objective analyst voice — trends, patterns, implications",
    "Consultant": "advisory voice — frameworks, recommendations, structured problem-solving",
    "Institution / Company": "collective institutional voice — we, our, organizational perspective",
}


def compile(req: PDLRequest) -> CompiledPromptPackage:
    """
    Merge all inputs into structured per-agent instructions.
    Returns a CompiledPromptPackage consumed by the orchestration pipeline.
    """
    icp = ICP_EMPHASIS.get(req.audience, ICP_EMPHASIS["General Business"])
    cta_instruction = CTA_TEMPLATES.get(
        req.cta.lower().replace(" ", "_"),
        req.cta if req.cta else CTA_TEMPLATES["no_cta"]
    )
    perspective_voice = PERSPECTIVE_VOICE.get(req.perspective, req.perspective)

    brand = req.brand_profile or {}
    brand_name = brand.get("name", "")
    tone_settings = brand.get("tone_settings") or brand.get("tone") or {}
    banned_phrases = brand.get("banned_phrases") or []
    preferred_terms = brand.get("preferred_terms") or []
    key_messages = brand.get("key_messages") or []

    # ── Canonical Writer instructions ────────────────────────────────────────
    canonical_instructions = {
        "topic": req.topic,
        "objective": req.objective,
        "context": _build_context_block(req, icp),
        "audience": req.audience,
        "icp_emphasis": icp["emphasis"],
        "icp_avoid": icp["avoid"],
        "perspective": req.perspective,
        "perspective_voice": perspective_voice,
        "structure": req.writing_structure,
        "cta": cta_instruction,
        "language": req.language,
        "reading_level": req.reading_level,
        "keywords": req.keywords,
        "special_instructions": req.special_instructions,
    }

    # ── Platform instructions (one per target) ───────────────────────────────
    platform_instructions = {
        platform: {
            "platform": platform,
            "audience_note": icp["tone_note"],
            "cta": cta_instruction,
        }
        for platform in req.platforms
    }

    # ── Brand instructions ───────────────────────────────────────────────────
    brand_instructions = {
        "brand_name": brand_name,
        "mission": brand.get("mission_statement") or brand.get("missionStatement") or "",
        "tone_settings": tone_settings,
        "banned_phrases": banned_phrases,
        "preferred_terms": preferred_terms,
        "key_messages": key_messages,
        "compliance_notes": brand.get("compliance_notes") or "",
    }

    # ── Humanization instructions ────────────────────────────────────────────
    humanization_instructions = {
        "enabled": req.enable_humanization,
        "intensity": req.humanization_intensity,
        "language": req.language,
        "audience_register": icp["tone_note"],
    }

    # ── QA instructions ──────────────────────────────────────────────────────
    qa_instructions = {
        "enabled": req.enable_qa,
        "brand_profile": req.brand_profile,
        "audience": req.audience,
        "platform_targets": req.platforms,
        "require_approval": req.require_approval,
    }

    # ── Compilation metadata (audit trail) ──────────────────────────────────
    metadata = {
        "topic": req.topic,
        "objective": req.objective,
        "audience": req.audience,
        "perspective": req.perspective,
        "structure": req.writing_structure,
        "platforms": req.platforms,
        "brand": brand_name,
        "humanization_intensity": req.humanization_intensity,
        "language": req.language,
        "cta": req.cta,
    }

    return CompiledPromptPackage(
        canonical_instructions=canonical_instructions,
        platform_instructions=platform_instructions,
        brand_instructions=brand_instructions,
        humanization_instructions=humanization_instructions,
        qa_instructions=qa_instructions,
        metadata=metadata,
    )


def _build_context_block(req: PDLRequest, icp: dict) -> str:
    parts = []

    if req.context:
        parts.append(f"USER-PROVIDED CONTEXT:\n{req.context}")

    if req.icp_description:
        parts.append(f"AUDIENCE DESCRIPTION:\n{req.icp_description}")

    parts.append(f"EMPHASIS FOR THIS AUDIENCE: {icp['emphasis']}")
    parts.append(f"AVOID: {icp['avoid']}")

    if req.keywords:
        parts.append(f"KEYWORDS TO WEAVE IN NATURALLY: {', '.join(req.keywords)}")

    if req.special_instructions:
        parts.append(f"SPECIAL INSTRUCTIONS:\n{req.special_instructions}")

    return "\n\n".join(parts) if parts else "No additional context. Draw from expertise."
