"""MCAP AI Engine — FastAPI orchestrator with PDL Prompt Compiler."""
import os
import asyncio
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

from agents import canonical_writer, platform_optimizer, brand_optimizer, humanizer, qa_agent
from services.scoring import score as score_content
from services.prompt_compiler import PDLRequest, compile as compile_prompt

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger("ai-engine")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("MCAP AI Engine started on port %s", os.getenv("PORT", "8000"))
    yield


app = FastAPI(title="MCAP AI Engine", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ── Shared model ──────────────────────────────────────────────────────────────

class BrandProfile(BaseModel):
    name: str = ""
    mission_statement: str = ""
    missionStatement: str = ""
    tone_settings: dict = Field(default_factory=dict)
    tone: dict = Field(default_factory=dict)
    preferred_terms: list[str] = Field(default_factory=list)
    banned_phrases: list[str] = Field(default_factory=list)
    key_messages: list[str] = Field(default_factory=list)
    compliance_notes: str = ""

    def as_dict(self) -> dict:
        d = self.model_dump()
        d["tone_settings"] = self.tone_settings or self.tone
        return d


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


# ── Individual agent endpoints ────────────────────────────────────────────────

class CanonicalRequest(BaseModel):
    topic: str
    objective: str = "Build thought leadership"
    context: str = ""
    audience: str = "General Business"
    icp_description: str = ""
    perspective: str = "Founder"
    structure: str = "thesis"
    cta: str = ""
    brandProfile: BrandProfile | None = None

@app.post("/agents/canonical-writer")
async def run_canonical_writer(req: CanonicalRequest):
    try:
        result = await canonical_writer.run(
            topic=req.topic,
            objective=req.objective,
            context=req.context,
            audience=req.audience,
            perspective=req.perspective,
            structure=req.structure,
            cta=req.cta,
        )
        return result
    except Exception as e:
        log.error("canonical_writer failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


class PlatformRequest(BaseModel):
    canonicalDraft: str
    targetPlatform: str
    audienceNote: str = ""

@app.post("/agents/platform-optimizer")
async def run_platform_optimizer(req: PlatformRequest):
    try:
        return await platform_optimizer.run(req.canonicalDraft, req.targetPlatform)
    except Exception as e:
        log.error("platform_optimizer failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


class BrandRequest(BaseModel):
    content: str
    brandProfile: BrandProfile | None = None

@app.post("/agents/brand-optimizer")
async def run_brand_optimizer(req: BrandRequest):
    try:
        return await brand_optimizer.run(req.content, req.brandProfile.as_dict() if req.brandProfile else None)
    except Exception as e:
        log.error("brand_optimizer failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


class HumanizeRequest(BaseModel):
    content: str
    intensity: str = "medium"

@app.post("/agents/humanizer")
async def run_humanizer(req: HumanizeRequest):
    try:
        return await humanizer.run(req.content, req.intensity)
    except Exception as e:
        log.error("humanizer failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


class QARequest(BaseModel):
    content: str
    brandProfile: BrandProfile | None = None

@app.post("/agents/qa")
async def run_qa(req: QARequest):
    try:
        return await qa_agent.run(req.content, req.brandProfile.as_dict() if req.brandProfile else None)
    except Exception as e:
        log.error("qa_agent failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


class ScoreRequest(BaseModel):
    content: str
    brandProfile: BrandProfile | None = None

@app.post("/score")
async def run_score(req: ScoreRequest):
    try:
        return await score_content(req.content, req.brandProfile.as_dict() if req.brandProfile else None)
    except Exception as e:
        log.error("scoring failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── PDL Compile endpoint (for frontend preview) ───────────────────────────────

class PDLCompileRequest(BaseModel):
    topic: str
    objective: str = "Build thought leadership"
    audience: str = "General Business"
    icp_description: str = ""
    perspective: str = "Founder"
    writing_structure: str = "thesis"
    platforms: list[str] = Field(default_factory=lambda: ["linkedin_post"])
    context: str = ""
    cta: str = ""
    language: str = "English"
    keywords: list[str] = Field(default_factory=list)
    special_instructions: str = ""
    enable_humanization: bool = True
    humanization_intensity: str = "medium"
    enable_qa: bool = True
    brandProfile: BrandProfile | None = None

@app.post("/compile")
async def compile_pdl(req: PDLCompileRequest):
    """Compile a PDL request and return the structured instruction package (dry run)."""
    pdl = PDLRequest(
        topic=req.topic,
        objective=req.objective,
        audience=req.audience,
        icp_description=req.icp_description,
        perspective=req.perspective,
        writing_structure=req.writing_structure,
        platforms=req.platforms,
        context=req.context,
        cta=req.cta,
        language=req.language,
        keywords=req.keywords,
        special_instructions=req.special_instructions,
        enable_humanization=req.enable_humanization,
        humanization_intensity=req.humanization_intensity,
        enable_qa=req.enable_qa,
        brand_profile=req.brandProfile.as_dict() if req.brandProfile else None,
    )
    package = compile_prompt(pdl)
    return {
        "canonical_instructions": package.canonical_instructions,
        "platform_instructions": package.platform_instructions,
        "brand_instructions": package.brand_instructions,
        "humanization_instructions": package.humanization_instructions,
        "qa_instructions": package.qa_instructions,
        "metadata": package.metadata,
    }


# ── Full Pipeline — uses PDL compiler ────────────────────────────────────────

class FullPipelineRequest(BaseModel):
    topic: str
    objective: str = "Build thought leadership"
    context: str = ""
    audience: str = "General Business"
    icp_description: str = ""
    perspective: str = "Founder"
    writing_structure: str = "thesis"
    cta: str = ""
    targetPlatforms: list[str] = Field(default_factory=lambda: ["linkedin_post"])
    brandProfile: BrandProfile | None = None
    enableHumanization: bool = True
    humanizationIntensity: str = "medium"
    enableQA: bool = True
    language: str = "English"
    keywords: list[str] = Field(default_factory=list)
    specialInstructions: str = ""

@app.post("/pipeline/run")
async def run_full_pipeline(req: FullPipelineRequest):
    """
    Full 5-agent pipeline — driven by the PDL Prompt Compiler.
    Runs platform optimization in parallel for all target platforms.
    """
    # ── Step 0: Compile via PDL ──────────────────────────────────────────────
    pdl = PDLRequest(
        topic=req.topic,
        objective=req.objective,
        audience=req.audience,
        icp_description=req.icp_description,
        perspective=req.perspective,
        writing_structure=req.writing_structure,
        platforms=req.targetPlatforms,
        context=req.context,
        cta=req.cta,
        language=req.language,
        keywords=req.keywords,
        special_instructions=req.specialInstructions,
        enable_humanization=req.enableHumanization,
        humanization_intensity=req.humanizationIntensity,
        enable_qa=req.enableQA,
        brand_profile=req.brandProfile.as_dict() if req.brandProfile else None,
    )
    pkg = compile_prompt(pdl)
    log.info("PDL compiled: structure=%s, platforms=%s", req.writing_structure, req.targetPlatforms)

    profile_dict = req.brandProfile.as_dict() if req.brandProfile else None
    total_tokens = 0

    try:
        # ── Agent 1: Canonical Writer ────────────────────────────────────────
        ci = pkg.canonical_instructions
        a1 = await canonical_writer.run(
            topic=ci["topic"],
            objective=ci["objective"],
            context=ci["context"],
            audience=ci["audience"],
            perspective=ci["perspective"],
            structure=ci["structure"],
            cta=ci["cta"],
        )
        total_tokens += a1["tokensUsed"]
        canonical_draft = a1["content"]
        log.info("Agent 1 done (%d tokens)", a1["tokensUsed"])

        # ── Agent 2: Platform Optimizer (parallel) ───────────────────────────
        platform_tasks = [
            platform_optimizer.run(canonical_draft=canonical_draft, target_platform=p)
            for p in req.targetPlatforms
        ]
        platform_results = await asyncio.gather(*platform_tasks)
        for r in platform_results:
            total_tokens += r["tokensUsed"]
        log.info("Agent 2 done (%d platforms)", len(platform_results))

        # ── Agent 3: Brand Optimizer (parallel) ──────────────────────────────
        brand_tasks = [
            brand_optimizer.run(content=r["content"], brand_profile=profile_dict)
            for r in platform_results
        ]
        brand_results = await asyncio.gather(*brand_tasks)
        for r in brand_results:
            total_tokens += r["tokensUsed"]
        log.info("Agent 3 done")

        # ── Agent 4: Humanizer (parallel, if enabled) ────────────────────────
        if pkg.humanization_instructions["enabled"]:
            intensity = pkg.humanization_instructions["intensity"]
            humanize_tasks = [
                humanizer.run(content=r["content"], intensity=intensity)
                for r in brand_results
            ]
            final_contents = await asyncio.gather(*humanize_tasks)
            for r in final_contents:
                total_tokens += r["tokensUsed"]
            log.info("Agent 4 done (intensity=%s)", intensity)
        else:
            final_contents = [{"content": r["content"], "tokensUsed": 0} for r in brand_results]

        # ── Agent 5: QA (parallel, if enabled) ──────────────────────────────
        qa_results = []
        if pkg.qa_instructions["enabled"]:
            qa_tasks = [
                qa_agent.run(content=r["content"], brand_profile=profile_dict)
                for r in final_contents
            ]
            qa_results = await asyncio.gather(*qa_tasks)
            for r in qa_results:
                total_tokens += r["tokensUsed"]
            log.info("Agent 5 done")

        # ── Build output ─────────────────────────────────────────────────────
        artifacts = []
        for i, platform in enumerate(req.targetPlatforms):
            qa = qa_results[i] if qa_results else {}
            artifacts.append({
                "platform": platform,
                "finalContent": final_contents[i]["content"],
                "canonicalDraft": canonical_draft,
                "platformVariant": platform_results[i]["content"],
                "brandAligned": brand_results[i]["content"],
                "humanized": final_contents[i]["content"],
                "qa": qa,
                "overallScore": qa.get("overallScore", 0),
                "passed": qa.get("passed", False),
            })

        return {
            "artifacts": artifacts,
            "canonicalDraft": canonical_draft,
            "totalTokensUsed": total_tokens,
            "compiledMetadata": pkg.metadata,
            "structureUsed": a1.get("structure"),
            "structureFlow": a1.get("structureFlow"),
        }

    except Exception as e:
        log.error("Pipeline failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=True)
