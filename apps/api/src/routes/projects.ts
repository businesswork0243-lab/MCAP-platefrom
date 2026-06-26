import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { query, queryOne } from '../db/connection'
import { AuthenticatedRequest, authenticate } from '../middleware/auth'

export const projectRouter = Router()
projectRouter.use(authenticate)
export default projectRouter

const projectSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
})

projectRouter.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const projects = await query(
    `SELECT p.*, u.name as owner_name,
       COUNT(cr.id)::int as total_requests,
       COUNT(CASE WHEN cr.status = 'published' THEN 1 END)::int as published_count
     FROM projects p
     JOIN users u ON u.id = p.owner_id
     LEFT JOIN content_requests cr ON cr.project_id = p.id
     WHERE p.organization_id = $1 AND p.status != 'archived'
     GROUP BY p.id, u.name
     ORDER BY p.updated_at DESC`,
    [req.user!.organizationId]
  )
  res.json(projects)
})

projectRouter.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parsed = projectSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors }); return }
  const id = uuidv4()
  await query(
    'INSERT INTO projects (id, organization_id, owner_id, title, description) VALUES ($1,$2,$3,$4,$5)',
    [id, req.user!.organizationId, req.user!.id, parsed.data.title, parsed.data.description]
  )
  const project = await queryOne('SELECT * FROM projects WHERE id = $1', [id])
  res.status(201).json(project)
})

projectRouter.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const project = await queryOne(
    'SELECT * FROM projects WHERE id = $1 AND organization_id = $2',
    [req.params.id, req.user!.organizationId]
  )
  if (!project) { res.status(404).json({ error: 'Not found' }); return }

  const requests = await query(
    `SELECT cr.id, cr.topic, cr.platforms, cr.status, cr.created_at,
       (SELECT AVG((qa->>'overall')::float) FROM artifacts a WHERE a.request_id = cr.id AND a.quality_score IS NOT NULL)::numeric(5,1) as avg_score
     FROM content_requests cr WHERE cr.project_id = $1 ORDER BY cr.created_at DESC`,
    [req.params.id]
  )
  res.json({ ...project, requests })
})

projectRouter.put('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parsed = projectSchema.partial().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors }); return }
  await query(
    'UPDATE projects SET title = COALESCE($1, title), description = COALESCE($2, description), updated_at = NOW() WHERE id = $3 AND organization_id = $4',
    [parsed.data.title, parsed.data.description, req.params.id, req.user!.organizationId]
  )
  res.json({ message: 'Updated' })
})



