import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { query, queryOne } from '../db/connection'
import { AuthenticatedRequest, authenticate } from '../middleware/auth'
import { addContentJob } from '../jobs/queue'

export const contentRouter = Router()
contentRouter.use(authenticate)
export default contentRouter

const createRequestSchema = z.object({
  topic: z.string().min(3).max(500),
  objective: z.string().optional(),
  context: z.string().optional(),
  audience: z.string().optional(),
  audienceDescription: z.string().optional(),
  platforms: z.array(z.string()).min(1),
  writingStructure: z.string().optional(),
  narrativePerspective: z.string().optional(),
  ctaType: z.string().optional(),
  brandProfileId: z.string().uuid().optional(),
  toneOverrides: z.record(z.number()).optional(),
  humanizationEnabled: z.boolean().default(true),
  humanizationLevel: z.enum(['light', 'medium', 'aggressive']).default('medium'),
  qaEnabled: z.boolean().default(true),
  requiresApproval: z.boolean().default(false),
  readingLevel: z.string().optional(),
  language: z.string().default('en'),
  specialInstructions: z.string().optional(),
  referenceUrls: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  projectId: z.string().uuid().optional(),
})

// POST /v1/content/generate
contentRouter.post('/generate', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parsed = createRequestSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors }); return }

  const id = uuidv4()
  const data = parsed.data
  await query(
    `INSERT INTO content_requests
     (id, project_id, organization_id, created_by, topic, objective, context, audience,
      audience_description, platforms, writing_structure, narrative_perspective, cta_type,
      brand_profile_id, tone_overrides, humanization_enabled, humanization_level, qa_enabled,
      requires_approval, reading_level, language, special_instructions, reference_urls, keywords, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,'queued')`,
    [
      id, data.projectId, req.user!.organizationId, req.user!.id,
      data.topic, data.objective, data.context, data.audience, data.audienceDescription,
      JSON.stringify(data.platforms), data.writingStructure, data.narrativePerspective, data.ctaType,
      data.brandProfileId, data.toneOverrides ? JSON.stringify(data.toneOverrides) : null,
      data.humanizationEnabled, data.humanizationLevel, data.qaEnabled, data.requiresApproval,
      data.readingLevel, data.language, data.specialInstructions,
      JSON.stringify(data.referenceUrls), JSON.stringify(data.keywords),
    ]
  )

  // Queue the AI pipeline job
  await addContentJob({ requestId: id, organizationId: req.user!.organizationId })
  res.status(202).json({ requestId: id, status: 'queued', message: 'Generation started' })
})

// GET /v1/content/jobs/:id
contentRouter.get('/jobs/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const request = await queryOne(
    'SELECT * FROM content_requests WHERE id = $1 AND organization_id = $2',
    [req.params.id, req.user!.organizationId]
  )
  if (!request) { res.status(404).json({ error: 'Not found' }); return }

  const executions = await query(
    'SELECT agent_name, status, tokens_used, duration_ms, error_message FROM agent_executions WHERE request_id = $1 ORDER BY created_at',
    [req.params.id]
  )
  res.json({ request, executions })
})

// GET /v1/content/:id/artifacts
contentRouter.get('/:id/artifacts', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const request = await queryOne(
    'SELECT id FROM content_requests WHERE id = $1 AND organization_id = $2',
    [req.params.id, req.user!.organizationId]
  )
  if (!request) { res.status(404).json({ error: 'Not found' }); return }

  const artifacts = await query(
    'SELECT * FROM artifacts WHERE request_id = $1 ORDER BY platform, version DESC',
    [req.params.id]
  )
  res.json(artifacts)
})

// POST /v1/content/:requestId/artifacts/:artifactId/approve
contentRouter.post('/:requestId/artifacts/:artifactId/approve', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  await query(
    'UPDATE artifacts SET status = $1, approved_by = $2, approved_at = NOW() WHERE id = $3',
    ['approved', req.user!.id, req.params.artifactId]
  )
  res.json({ message: 'Artifact approved' })
})

// POST /v1/content/:requestId/artifacts/:artifactId/reject
contentRouter.post('/:requestId/artifacts/:artifactId/reject', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { note } = req.body
  await query(
    'UPDATE artifacts SET status = $1, rejection_note = $2 WHERE id = $3',
    ['rejected', note, req.params.artifactId]
  )
  res.json({ message: 'Artifact rejected' })
})

// GET /v1/content — list all requests for org
contentRouter.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { page = '1', limit = '20', status } = req.query
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string)
  const params: unknown[] = [req.user!.organizationId, parseInt(limit as string), offset]
  const statusFilter = status ? ` AND status = $${params.push(status)}` : ''

  const requests = await query(
    `SELECT cr.*, u.name as created_by_name
     FROM content_requests cr
     JOIN users u ON u.id = cr.created_by
     WHERE cr.organization_id = $1 ${statusFilter}
     ORDER BY cr.created_at DESC LIMIT $2 OFFSET $3`,
    params
  )
  res.json(requests)
})



