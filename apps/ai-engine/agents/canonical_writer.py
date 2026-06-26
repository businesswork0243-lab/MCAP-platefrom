"""Agent 1 — Canonical Writer: generates the authoritative base document.

Each writing structure has a specific cognitive flow per the spec.
The agent follows the exact flow for the chosen structure.
"""
from services.llm import complete

SYSTEM = """You are an expert content strategist and senior writer.
Your task is to produce a comprehensive, publication-ready canonical article.
Follow the specified writing structure EXACTLY — each section of the flow must be present.
Write with clarity, analytical depth, and editorial precision. Every sentence must add value.
Do NOT include meta-commentary, labels, or structural annotations in the output."""

# --- Exact structural flows from spec ---

STRUCTURE_FLOWS = {
    "debate": {
        "name": "Debate",
        "flow": [
            "1. CLAIM — State a bold, clear, defensible position",
            "2. POPULAR ASSUMPTION — Acknowledge the prevailing belief or conventional wisdom",
            "3. COUNTERARGUMENT — Challenge the assumption with evidence and reasoning",
            "4. SUPPORTING EVIDENCE — Provide data, examples, or expert insights that support your position",
            "5. PRACTICAL IMPLICATIONS — Explain what this means for the reader's context",
            "6. DISCUSSION PROMPT — End with an open question that invites dialogue",
        ],
        "ideal_for": "Contrarian posts, opinion pieces, executive commentary",
    },
    "data_driven": {
        "name": "Data-Driven",
        "flow": [
            "1. OBSERVATION — Surface a pattern or trend that is widely visible but misunderstood",
            "2. INCORRECT INTERPRETATION — Describe how most people (wrongly) interpret this observation",
            "3. ANALYSIS — Break down what is actually happening using data, research, or first principles",
            "4. FRAMEWORK — Offer a reusable mental model or decision-making tool",
            "5. PRACTICAL APPLICATION — Show exactly how to apply this framework in real scenarios",
        ],
        "ideal_for": "Research summaries, market commentary, consulting insights",
    },
    "story": {
        "name": "Story",
        "flow": [
            "1. SITUATION — Set the scene: who, what, when, where",
            "2. CONFLICT — Introduce the challenge, tension, or turning point",
            "3. LESSON — Share what was learned or how it was resolved",
            "4. FRAMEWORK — Extract the transferable principle from the story",
            "5. BROADER IMPLICATION — Connect the lesson to a wider audience or larger trend",
        ],
        "ideal_for": "Founder content, personal branding, case studies",
    },
    "thesis": {
        "name": "Thesis",
        "flow": [
            "1. STRUCTURAL CLAIM — Make a precise, defensible thesis about how a system works",
            "2. PREVAILING ASSUMPTION — Identify the dominant belief that your thesis challenges",
            "3. FAILURE MODE — Show where and why the prevailing assumption breaks down",
            "4. UNDERLYING MECHANICS — Explain the root cause or mechanism driving the failure",
            "5. SECOND-ORDER EFFECTS — Explore the downstream consequences most people overlook",
            "6. STRATEGIC IMPLICATION — Conclude with what decision-makers should do differently",
        ],
        "ideal_for": "Governance, economics, regulation, capital markets",
    },
    "incentive_diagnosis": {
        "name": "Incentive Diagnosis",
        "flow": [
            "1. OBSERVED BEHAVIOR — Describe a behavior or outcome that seems irrational or puzzling",
            "2. DECLARED INTENTIONS — State what the actors claim they are trying to achieve",
            "3. INCENTIVE MAPPING — Map the actual incentives each actor faces",
            "4. MISALIGNMENT — Show where declared intentions and actual incentives diverge",
            "5. SYSTEMIC RISK — Explain the cumulative risk this misalignment creates",
            "6. DIAGNOSTIC CONCLUSION — Offer a diagnosis and path to realignment",
        ],
        "ideal_for": "Organizational analysis, public policy, corporate governance",
    },
}

USER_TEMPLATE = """Write a comprehensive 1000-1500 word canonical article following the exact structure below.

TOPIC: {topic}

STRATEGIC OBJECTIVE: {objective}

CONTEXT & KEY POINTS:
{context}

TARGET AUDIENCE: {audience}

NARRATIVE PERSPECTIVE: {perspective}

CALL TO ACTION: {cta}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WRITING STRUCTURE: {structure_name}
Ideal for: {ideal_for}

REQUIRED FLOW (follow this exact sequence):
{flow_steps}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXECUTION RULES:
- Write a compelling headline first
- Follow the structural flow exactly — each section must be present and substantive
- Write in the specified narrative perspective ({perspective})
- Target audience is: {audience}
- Do NOT label the sections (no "Section 1:", "Claim:", etc.) — write flowing prose
- Length: 1000-1500 words
- Maintain analytical depth throughout
- Include the CTA naturally in the conclusion if applicable

Write the full article now:"""


async def run(
    topic: str,
    objective: str = "Build thought leadership",
    context: str = "",
    audience: str = "General Business",
    perspective: str = "Founder",
    structure: str = "thesis",
    cta: str = "",
) -> dict:
    structure_key = structure.lower().replace(" ", "_").replace("-", "_")
    struct = STRUCTURE_FLOWS.get(structure_key, STRUCTURE_FLOWS["thesis"])

    flow_steps = "\n".join(struct["flow"])

    user_prompt = USER_TEMPLATE.format(
        topic=topic,
        objective=objective,
        context=context or "No additional context provided. Draw from your expertise.",
        audience=audience,
        perspective=perspective,
        cta=cta or "No specific CTA required.",
        structure_name=struct["name"],
        ideal_for=struct["ideal_for"],
        flow_steps=flow_steps,
    )

    content, tokens = await complete(SYSTEM, user_prompt, temperature=0.75, max_tokens=3000)
    return {
        "content": content,
        "tokensUsed": tokens,
        "agent": "canonical_writer",
        "structure": struct["name"],
        "structureFlow": struct["flow"],
    }
