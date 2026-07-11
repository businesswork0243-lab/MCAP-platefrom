// apps/api/src/routes/content.ts
import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import axios from 'axios'
import { query, queryOne, withTransaction } from '../db/connection'
import { AuthenticatedRequest, authenticate } from '../middleware/auth'
import { addContentJob } from '../jobs/queue'
import { logger } from '../lib/logger'

export const contentRouter = Router()
contentRouter.use(authenticate)
export default contentRouter

// ─── Schemas ──────────────────────────────────────────────────────────────────

const tonalitySchema = z.object({
  angry:      z.number().min(0).max(10).default(0),
  frustrated: z.number().min(0).max(10).default(0),
  excited:    z.number().min(0).max(10).default(5),
  confident:  z.number().min(0).max(10).default(6),
  curious:    z.number().min(0).max(10).default(4),
  empathetic: z.number().min(0).max(10).default(5),
  playful:    z.number().min(0).max(10).default(3),
  serious:    z.number().min(0).max(10).default(5),
}).default({})

const seoSettingsSchema = z.object({
  primaryKeyword:     z.string().optional(),
  secondaryKeywords:  z.array(z.string()).default([]),
  metaDescription:    z.string().max(160).optional(),
  targetWordCount:    z.number().optional(),
}).default({})

const createRequestSchema = z.object({
  // Core — REQUIRED
  topic:     z.string().min(3).max(500),

  // Optional with defaults
  objective:           z.string().optional().default('Build thought leadership'),
  context:             z.string().optional().default(''),

  // Audience
  audience:            z.string().optional().default('General Business'),
  audienceDescription: z.string().optional(),
  icpProfileId:        z.string().uuid().optional(),

  // Platforms — REQUIRED, min 1
  platforms: z.array(z.string().min(1)).min(1, 'Select at least one platform'),

  // Blog word count
  wordCount: z.number().min(100).max(5000).optional(),

  // Structure
  writingStructure:     z.string().optional().default('thesis'),
  customStructureId:    z.string().uuid().optional(),
  customStructureFlow:  z.string().optional(),

  // Style
  narrativePerspective: z.string().optional().default('Founder'),
  language:             z.string().optional().default('English'),
  keywords:             z.array(z.string()).optional().default([]),

  // CTA
  ctaType:   z.string().optional(),
  customCta: z.string().optional(),

  // Brand & Tone
  brandProfileId:   z.string().uuid().optional(),
  toneOverrides:    z.record(z.number()).optional(),
  tonalitySpectrum: z.record(z.number()).optional().default({}),

  // AI Settings
  humanizationEnabled:  z.boolean().optional().default(true),
  humanizationLevel:    z.enum(['light', 'medium', 'aggressive']).optional().default('medium'),
  qaEnabled:            z.boolean().optional().default(true),
  requiresApproval:     z.boolean().optional().default(false),

  // SEO
  seoEnabled:  z.boolean().optional().default(false),
  seoSettings: z.record(z.unknown()).optional().default({}),

  // Special instructions
  specialInstructions: z.string().optional(),

  // References
  referenceUrls: z.array(z.string()).optional().default([]),
  readingLevel:  z.string().optional(),

  // Org
  projectId: z.string().uuid().optional(),
  clientId:  z.string().uuid().optional(),
})

const repurposeSchema = z.object({
  targetPlatform:   z.string().min(1),
  sourceArtifactId: z.string().uuid().optional(),
})

// ─── Helper: Build AI Engine Payload ─────────────────────────────────────────

async function buildAIPayload(
  data: z.infer<typeof createRequestSchema>,
  orgId: string
): Promise<Record<string, unknown>> {
  // Fetch ICP data if selected
  let icpData: Record<string, unknown> | null = null
  if (data.icpProfileId) {
    const icp = await queryOne(
      'SELECT * FROM icp_profiles WHERE id = $1 AND organization_id = $2',
      [data.icpProfileId, orgId]
    )
    if (icp) icpData = icp as Record<string, unknown>
  }

  // Fetch brand profile if selected
  let brandData: Record<string, unknown> | null = null
  if (data.brandProfileId) {
    const brand = await queryOne(
      `SELECT bp.*,
        (SELECT parsed_content FROM brand_documents 
         WHERE brand_profile_id = bp.id AND parsing_status = 'done'
         LIMIT 3) as doc_context
       FROM brand_profiles bp
       WHERE bp.id = $1 AND bp.organization_id = $2`,
      [data.brandProfileId, orgId]
    )
    if (brand) brandData = brand as Record<string, unknown>
  }

  // Fetch custom writing structure
  let structureFlow: string[] | null = null
  if (data.customStructureId) {
    const structure = await queryOne<{ structure_flow: string[] }>(
      'SELECT structure_flow FROM writing_structures WHERE id = $1',
      [data.customStructureId]
    )
    if (structure) structureFlow = structure.structure_flow
  }

  // Build audience string from ICP or manual
  const audienceStr = icpData
    ? `${(icpData.basic_characteristics as Record<string, string>)?.role || ''} in ${(icpData.basic_characteristics as Record<string, string>)?.industry || ''}`
    : data.audience || 'General Business'

  const icpDescription = icpData
    ? `Challenges: ${JSON.stringify(icpData.current_challenges)}. Goals: ${JSON.stringify(icpData.goals)}. Frustrations: ${JSON.stringify(icpData.frustrations)}.`
    : data.audienceDescription || ''

  return {
    topic:               data.topic,
    objective:           data.objective || 'Build thought leadership',
    context:             data.context || '',
    audience:            audienceStr,
    icp_description:     icpDescription,
    perspective:         data.narrativePerspective || 'Founder',
    writing_structure:   data.writingStructure || 'thesis',
    custom_structure_flow: structureFlow || 
      (data.customStructureFlow ? data.customStructureFlow.split('\n').filter(Boolean) : null),
    cta:                 data.ctaType === 'custom' ? data.customCta : data.ctaType || '',
    targetPlatforms:     data.platforms,
    language:            data.language,
    keywords:            data.keywords,
    specialInstructions: buildSpecialInstructions(data),
    enableHumanization:  data.humanizationEnabled,
    humanizationIntensity: data.humanizationLevel,
    enableQA:            data.qaEnabled,
    brandProfile:        brandData,
    tonalitySpectrum:    data.tonalitySpectrum,
    wordCount:           data.wordCount,
    seoEnabled:          data.seoEnabled,
    seoSettings:         data.seoSettings,
  }
}

function buildSpecialInstructions(data: z.infer<typeof createRequestSchema>): string {
  const parts: string[] = []

  // Add tonality instructions
  const highTones = Object.entries(data.tonalitySpectrum || {})
    .filter(([, v]) => v >= 6)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => `${k} (${v}/10)`)

  if (highTones.length > 0) {
    parts.push(`Tonality for this piece: ${highTones.join(', ')}.`)
  }

  // Add word count instruction
  if (data.wordCount) {
    parts.push(`Target word count: approximately ${data.wordCount} words.`)
  }

  // Add SEO instructions
  if (data.seoEnabled && data.seoSettings.primaryKeyword) {
    parts.push(
      `SEO optimize for "${data.seoSettings.primaryKeyword}". ` +
      `Include H2/H3 headings, meta-friendly structure.`
    )
  }

  // User's own instructions
  if (data.specialInstructions) {
    parts.push(data.specialInstructions)
  }

  return parts.join(' ')
}

// ─── CONTENT ROUTES ───────────────────────────────────────────────────────────

// GET /api/content
contentRouter.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', status, clientId } = req.query
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string)
    const params: unknown[] = [req.user!.organizationId, parseInt(limit as string), offset]

    let filters = ''
    if (status) filters += ` AND cr.status = $${params.push(status)}`
    if (clientId) filters += ` AND cr.client_id = $${params.push(clientId)}`

    const requests = await query(
      `SELECT cr.*,
        u.name as created_by_name,
        c.name as client_name,
        bp.name as brand_profile_name
       FROM content_requests cr
       JOIN users u ON u.id = cr.created_by
       LEFT JOIN clients c ON c.id = cr.client_id
       LEFT JOIN brand_profiles bp ON bp.id = cr.brand_profile_id
       WHERE cr.organization_id = $1 ${filters}
       ORDER BY cr.created_at DESC
       LIMIT $2 OFFSET $3`,
      params
    )

    // Total count
    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM content_requests WHERE organization_id = $1`,
      [req.user!.organizationId]
    )

    res.json({
      requests,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: parseInt(countResult?.count || '0'),
      }
    })
  } catch (err) {
    logger.error('GET /content error:', { error: err })
    res.status(500).json({ error: 'Failed to fetch content' })
  }
})

// POST /api/content/generate
contentRouter.post('/generate', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = createRequestSchema.safeParse(req.body)

    if (!parsed.success) {
      // Readable error format
      const errors = parsed.error.errors.map(e => ({
        field:   e.path.join('.'),
        message: e.message,
        received: e.code === 'too_small' ? `Got ${(e as unknown as {received: number}).received}` : undefined,
      }));

      logger.warn('Content generate validation failed', {
        errors,
        body: {
          topic:     req.body.topic,
          platforms: req.body.platforms,
        },
      });

      res.status(400).json({
        error:   'Validation failed',
        details: errors,
        hint:    'Check platforms (array required) and topic (min 3 chars)',
      });
      return;
    }

    const data = parsed.data
    const id = uuidv4()

    // Build AI payload (resolves ICP, brand, structure)
    const aiPayload = await buildAIPayload(data, req.user!.organizationId)

    // Save request to DB
    await query(
      `INSERT INTO content_requests (
        id, project_id, organization_id, created_by, client_id,
        topic, objective, context, audience, audience_description,
        platforms, target_platform,
        writing_structure, custom_structure_id, custom_structure_flow,
        narrative_perspective, cta_type, custom_cta,
        brand_profile_id, icp_profile_id,
        tone_overrides, tonality_spectrum,
        humanization_enabled, humanization_level,
        qa_enabled, requires_approval,
        reading_level, language, special_instructions,
        reference_urls, keywords,
        word_count, seo_enabled, seo_settings,
        status
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10,
        $11,$12,
        $13,$14,$15,
        $16,$17,$18,
        $19,$20,
        $21,$22,
        $23,$24,
        $25,$26,
        $27,$28,$29,
        $30,$31,
        $32,$33,$34,
        'queued'
      )`,
      [
        id,
        data.projectId ?? null,
        req.user!.organizationId,
        req.user!.id,
        data.clientId ?? null,

        data.topic,
        data.objective ?? null,
        data.context ?? null,
        (aiPayload.audience as string),
        data.audienceDescription ?? null,

        JSON.stringify(data.platforms),
        data.platforms[0],

        data.writingStructure ?? null,
        data.customStructureId ?? null,
        data.customStructureFlow ?? null,

        data.narrativePerspective ?? null,
        data.ctaType ?? null,
        data.customCta ?? null,

        data.brandProfileId ?? null,
        data.icpProfileId ?? null,

        data.toneOverrides ? JSON.stringify(data.toneOverrides) : null,
        JSON.stringify(data.tonalitySpectrum),

        data.humanizationEnabled,
        data.humanizationLevel,

        data.qaEnabled,
        data.requiresApproval,

        data.readingLevel ?? null,
        data.language,
        data.specialInstructions ?? null,

        JSON.stringify(data.referenceUrls),
        JSON.stringify(data.keywords),

        data.wordCount ?? null,
        data.seoEnabled,
        JSON.stringify(data.seoSettings),
      ]
    )

    // Increment writing structure use count
    if (data.customStructureId) {
      await query(
        'UPDATE writing_structures SET use_count = use_count + 1 WHERE id = $1',
        [data.customStructureId]
      )
    }

    // Queue the AI job
    await addContentJob(id, {
      ...aiPayload,
      targetPlatform: data.platforms[0],
      brandProfileId: data.brandProfileId || '',
      organizationId: req.user!.organizationId,
      createdBy: req.user!.id,
    } as any)

    logger.info('Content generation queued', {
      requestId: id,
      topic: data.topic.slice(0, 50),
      platforms: data.platforms,
      userId: req.user!.id,
    })

    res.status(202).json({
      requestId: id,
      contentId: id,  // Alias for frontend
      status: 'queued',
      message: 'Generation started',
    })
  } catch (err) {
    logger.error('POST /content/generate error:', { error: err })
    res.status(500).json({ error: 'Failed to queue generation' })
  }
})

// GET /api/content/jobs/:id
contentRouter.get('/jobs/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const request = await queryOne(
      `SELECT cr.*, bp.name as brand_profile_name
       FROM content_requests cr
       LEFT JOIN brand_profiles bp ON bp.id = cr.brand_profile_id
       WHERE cr.id = $1 AND cr.organization_id = $2`,
      [req.params.id, req.user!.organizationId]
    )
    if (!request) { res.status(404).json({ error: 'Not found' }); return }

    const executions = await query(
      `SELECT 
     agent_name, 
     status, 
     tokens_used, 
     duration_ms, 
     error_message, 
     created_at
   FROM agent_executions
   WHERE COALESCE(request_id, content_request_id) = $1
   ORDER BY created_at ASC`,
      [req.params.id]
    )

    res.json({ request, executions })
  } catch (err) {
    logger.error('GET /content/jobs/:id error:', { error: err })
    res.status(500).json({ error: 'Failed to fetch job status' })
  }
})

// GET /api/content/:id/artifacts
contentRouter.get('/:id/artifacts', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const request = await queryOne(
      'SELECT id FROM content_requests WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.user!.organizationId]
    )
    if (!request) { res.status(404).json({ error: 'Not found' }); return }

    const artifacts = await query(
      `SELECT a.*,
        (SELECT json_agg(row_to_json(r)) 
         FROM content_repurposes r 
         WHERE r.source_artifact_id = a.id) as repurposes
       FROM artifacts a
       WHERE a.request_id = $1
       ORDER BY a.platform, a.version DESC`,
      [req.params.id]
    )

    res.json({ artifacts })
  } catch (err) {
    logger.error('GET /content/:id/artifacts error:', { error: err })
    res.status(500).json({ error: 'Failed to fetch artifacts' })
  }
})

// POST /api/content/:id/repurpose
contentRouter.post('/:id/repurpose', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = repurposeSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors })
      return
    }

    const { targetPlatform, sourceArtifactId } = parsed.data

    // Verify request belongs to org
    const request = await queryOne(
      'SELECT * FROM content_requests WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.user!.organizationId]
    )
    if (!request) { res.status(404).json({ error: 'Content not found' }); return }

    // Get source artifact content
    let sourceContent = ''
    if (sourceArtifactId) {
      const artifact = await queryOne<{ body: string }>(
        'SELECT body FROM artifacts WHERE id = $1 AND request_id = $2',
        [sourceArtifactId, req.params.id]
      )
      sourceContent = artifact?.body || ''
    } else {
      // Use the best available artifact (qa_reviewed → humanized → latest)
      const artifact = await queryOne<{ body: string }>(
        `SELECT body FROM artifacts
         WHERE request_id = $1
         ORDER BY
           CASE content_type
             WHEN 'qa_reviewed' THEN 1
             WHEN 'humanized' THEN 2
             WHEN 'brand_aligned' THEN 3
             ELSE 4
           END
         LIMIT 1`,
        [req.params.id]
      )
      sourceContent = artifact?.body || ''
    }

    if (!sourceContent) {
      res.status(400).json({ error: 'No source content found to repurpose' })
      return
    }

    // Create repurpose record
    const repurposeId = uuidv4()
    await query(
      `INSERT INTO content_repurposes
        (id, organization_id, source_request_id, source_artifact_id, created_by, target_platform, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'generating')`,
      [
        repurposeId,
        req.user!.organizationId,
        req.params.id,
        sourceArtifactId ?? null,
        req.user!.id,
        targetPlatform,
      ]
    )

    // Call AI Engine
    try {
      const aiUrl = process.env.AI_ENGINE_URL || 'http://localhost:8000'
      const aiResponse = await axios.post(
        `${aiUrl}/agents/platform-optimizer`,
        {
          canonicalDraft: sourceContent,
          targetPlatform,
        },
        { timeout: 60_000 }
      )

      const repurposedContent = aiResponse.data?.content || ''
      const tokensUsed = aiResponse.data?.tokensUsed || 0

      // Save artifact
      const artifactId = uuidv4()
      await withTransaction(async (client) => {
        // Update repurpose record
        await client.query(
          `UPDATE content_repurposes
           SET status = 'done', repurposed_content = $1, tokens_used = $2, updated_at = NOW()
           WHERE id = $3`,
          [repurposedContent, tokensUsed, repurposeId]
        )

        // Save as artifact too
        await client.query(
          `INSERT INTO artifacts
            (id, request_id, platform, content_type, body, repurpose_id, is_repurposed, status)
           VALUES ($1, $2, $3, 'platform_adapted', $4, $5, true, 'generated')`,
          [artifactId, req.params.id, targetPlatform, repurposedContent, repurposeId]
        )
      })

      logger.info('Repurpose done', {
        repurposeId,
        targetPlatform,
        tokensUsed,
      })

      res.json({
        repurposeId,
        artifactId,
        content: repurposedContent,
        targetPlatform,
        tokensUsed,
      })
    } catch (aiError) {
      // Mark repurpose as failed
      await query(
        `UPDATE content_repurposes
         SET status = 'failed', error_message = $1, updated_at = NOW()
         WHERE id = $2`,
        [
          aiError instanceof Error ? aiError.message : 'AI Engine error',
          repurposeId,
        ]
      )
      throw aiError
    }
  } catch (err) {
    logger.error('POST /content/:id/repurpose error:', { error: err })
    res.status(500).json({ error: 'Failed to repurpose content' })
  }
})

// GET /api/content/:id/repurposes
contentRouter.get('/:id/repurposes', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const repurposes = await query(
      `SELECT r.*, u.name as created_by_name
       FROM content_repurposes r
       JOIN users u ON u.id = r.created_by
       WHERE r.source_request_id = $1 AND r.organization_id = $2
       ORDER BY r.created_at DESC`,
      [req.params.id, req.user!.organizationId]
    )
    res.json({ repurposes })
  } catch (err) {
    logger.error('GET /content/:id/repurposes error:', { error: err })
    res.status(500).json({ error: 'Failed to fetch repurposes' })
  }
})

// POST /api/content/:requestId/artifacts/:artifactId/approve
contentRouter.post(
  '/:requestId/artifacts/:artifactId/approve',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      await query(
        `UPDATE artifacts
         SET status = 'approved', approved_by = $1, approved_at = NOW()
         WHERE id = $2 AND request_id = $3`,
        [req.user!.id, req.params.artifactId, req.params.requestId]
      )
      res.json({ message: 'Artifact approved' })
    } catch (err) {
      logger.error('POST approve error:', { error: err })
      res.status(500).json({ error: 'Failed to approve' })
    }
  }
)

// POST /api/content/:requestId/artifacts/:artifactId/reject
contentRouter.post(
  '/:requestId/artifacts/:artifactId/reject',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { note } = req.body
      await query(
        `UPDATE artifacts
         SET status = 'rejected', rejection_note = $1, updated_at = NOW()
         WHERE id = $2 AND request_id = $3`,
        [note ?? null, req.params.artifactId, req.params.requestId]
      )
      res.json({ message: 'Artifact rejected' })
    } catch (err) {
      logger.error('POST reject error:', { error: err })
      res.status(500).json({ error: 'Failed to reject' })
    }
  }
)