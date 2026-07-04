import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { query, queryOne } from '../db/connection'
import { AuthenticatedRequest, authenticate, requireMinRole } from '../middleware/auth'
import { logger } from '../lib/logger'

export const projectRouter = Router()
projectRouter.use(authenticate)
export default projectRouter

// ─── Schemas ──────────────────────────────────────────────────────────────────

const projectSchema = z.object({
  title:       z.string().min(1).max(255).trim(),
  description: z.string().max(2000).optional(),
  clientId:    z.string().uuid().optional(),
})

const statusSchema = z.object({
  status: z.enum(['active', 'completed', 'archived']),
})

// ─── GET /api/projects ────────────────────────────────────────────────────────

projectRouter.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status = 'active', clientId } = req.query

    const params: unknown[] = [req.user!.organizationId]
    let filters = ''

    // Status filter
    if (status === 'all') {
      // No filter
    } else if (typeof status === 'string') {
      filters += ` AND p.status = $${params.push(status)}`
    } else {
      filters += ` AND p.status != 'archived'`
    }

    // Client filter
    if (clientId) {
      filters += ` AND p.client_id = $${params.push(clientId)}`
    }

    const projects = await query(
      `SELECT
        p.*,
        u.name                                                  AS owner_name,
        c.name                                                  AS client_name,
        COUNT(DISTINCT cr.id)::int                              AS total_requests,
        COUNT(DISTINCT cr.id) FILTER (
          WHERE cr.status IN ('approved', 'published')
        )::int                                                  AS completed_count,
        MAX(cr.created_at)                                      AS last_activity_at
       FROM projects p
       JOIN users u ON u.id = p.owner_id
       LEFT JOIN clients c ON c.id = p.client_id
       LEFT JOIN content_requests cr ON cr.project_id = p.id
       WHERE p.organization_id = $1 ${filters}
       GROUP BY p.id, u.name, c.name
       ORDER BY p.updated_at DESC`,
      params
    )

    res.json({ projects })
  } catch (err) {
    logger.error('GET /projects error:', { error: err })
    res.status(500).json({ error: 'Failed to fetch projects' })
  }
})

// ─── POST /api/projects ───────────────────────────────────────────────────────

projectRouter.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = projectSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors })
      return
    }

    const { title, description, clientId } = parsed.data
    const id = uuidv4()

    await query(
      `INSERT INTO projects
        (id, organization_id, owner_id, title, description, client_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
      [
        id,
        req.user!.organizationId,
        req.user!.id,
        title,
        description ?? null,
        clientId ?? null,
      ]
    )

    const project = await queryOne(
      `SELECT p.*, u.name as owner_name
       FROM projects p
       JOIN users u ON u.id = p.owner_id
       WHERE p.id = $1`,
      [id]
    )

    logger.info('Project created', { projectId: id, userId: req.user!.id })
    res.status(201).json(project)

  } catch (err) {
    logger.error('POST /projects error:', { error: err })
    res.status(500).json({ error: 'Failed to create project' })
  }
})

// ─── GET /api/projects/:id ────────────────────────────────────────────────────

projectRouter.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const project = await queryOne(
      `SELECT p.*, u.name as owner_name, c.name as client_name
       FROM projects p
       JOIN users u ON u.id = p.owner_id
       LEFT JOIN clients c ON c.id = p.client_id
       WHERE p.id = $1 AND p.organization_id = $2`,
      [req.params.id, req.user!.organizationId]
    )

    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    // Fetch content requests with scores
    const requests = await query(
      `SELECT
        cr.id,
        cr.topic,
        cr.platforms,
        cr.status,
        cr.created_at,
        cr.target_platform,
        u.name                                                          AS created_by_name,
        ROUND(
          AVG((a.quality_score->>'overall')::numeric)
        )::int                                                          AS avg_score,
        COUNT(DISTINCT a.id)::int                                       AS artifact_count
       FROM content_requests cr
       LEFT JOIN users u ON u.id = cr.created_by
       LEFT JOIN artifacts a
         ON a.request_id = cr.id
        AND a.quality_score IS NOT NULL
       WHERE cr.project_id = $1
       GROUP BY cr.id, u.name
       ORDER BY cr.created_at DESC
       LIMIT 50`,
      [req.params.id]
    )

    // Project stats
    const stats = await queryOne<{
      total: string;
      completed: string;
      total_tokens: string;
    }>(
      `SELECT
        COUNT(cr.id)::text                                              AS total,
        COUNT(cr.id) FILTER (
          WHERE cr.status IN ('approved', 'published')
        )::text                                                         AS completed,
        COALESCE(SUM(ae.tokens_used), 0)::text                         AS total_tokens
       FROM content_requests cr
       LEFT JOIN agent_executions ae ON ae.request_id = cr.id
       WHERE cr.project_id = $1`,
      [req.params.id]
    )

    res.json({ ...project, requests, stats })

  } catch (err) {
    logger.error('GET /projects/:id error:', { error: err })
    res.status(500).json({ error: 'Failed to fetch project' })
  }
})

// ─── PUT /api/projects/:id ────────────────────────────────────────────────────

projectRouter.put('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = projectSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors })
      return
    }

    // Verify ownership
    const existing = await queryOne(
      'SELECT id, owner_id FROM projects WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.user!.organizationId]
    )
    if (!existing) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    const d = parsed.data
    const sets: string[] = ['updated_at = NOW()']
    const vals: unknown[] = []
    let idx = 1

    if (d.title !== undefined)       { sets.push(`title = $${idx++}`);       vals.push(d.title) }
    if (d.description !== undefined) { sets.push(`description = $${idx++}`); vals.push(d.description) }
    if (d.clientId !== undefined)    { sets.push(`client_id = $${idx++}`);   vals.push(d.clientId) }

    vals.push(req.params.id)
    vals.push(req.user!.organizationId)

    await query(
      `UPDATE projects SET ${sets.join(', ')}
       WHERE id = $${idx++} AND organization_id = $${idx}`,
      vals
    )

    const updated = await queryOne(
      `SELECT p.*, u.name as owner_name
       FROM projects p JOIN users u ON u.id = p.owner_id
       WHERE p.id = $1`,
      [req.params.id]
    )

    res.json(updated)

  } catch (err) {
    logger.error('PUT /projects/:id error:', { error: err })
    res.status(500).json({ error: 'Failed to update project' })
  }
})

// ─── PATCH /api/projects/:id/status ──────────────────────────────────────────

projectRouter.patch(
  '/:id/status',
  requireMinRole('editor'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const parsed = statusSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid status' })
        return
      }

      const result = await query(
        `UPDATE projects SET status = $1, updated_at = NOW()
         WHERE id = $2 AND organization_id = $3
         RETURNING id, status`,
        [parsed.data.status, req.params.id, req.user!.organizationId]
      )

      if (!result.length) {
        res.status(404).json({ error: 'Not found' })
        return
      }

      logger.info('Project status updated', {
        projectId: req.params.id,
        status:    parsed.data.status,
        userId:    req.user!.id,
      })

      res.json({ message: 'Status updated', status: parsed.data.status })

    } catch (err) {
      logger.error('PATCH /projects/:id/status error:', { error: err })
      res.status(500).json({ error: 'Failed to update status' })
    }
  }
)

// ─── DELETE /api/projects/:id ─────────────────────────────────────────────────

projectRouter.delete(
  '/:id',
  requireMinRole('admin'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Soft delete — archive instead of hard delete
      // (content_requests have FK to projects)
      const result = await query(
        `UPDATE projects SET status = 'archived', updated_at = NOW()
         WHERE id = $1 AND organization_id = $2
         RETURNING id`,
        [req.params.id, req.user!.organizationId]
      )

      if (!result.length) {
        res.status(404).json({ error: 'Not found' })
        return
      }

      logger.info('Project archived', {
        projectId: req.params.id,
        userId:    req.user!.id,
      })

      res.json({ message: 'Project archived' })

    } catch (err) {
      logger.error('DELETE /projects/:id error:', { error: err })
      res.status(500).json({ error: 'Failed to archive project' })
    }
  }
)
