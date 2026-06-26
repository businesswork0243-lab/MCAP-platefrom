import { Router, Request, Response } from 'express';
import { pool } from '../db/connection';
import { authenticate as authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /api/campaigns — list org campaigns
router.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.organizationId;
    const { projectId } = req.query;

    const query = projectId
      ? `SELECT c.*, u.name AS created_by_name,
           COUNT(cr.id) AS content_count
         FROM campaigns c
         LEFT JOIN users u ON u.id = c.created_by
         LEFT JOIN content_requests cr ON cr.campaign_id = c.id
         WHERE c.organization_id = $1 AND c.project_id = $2
         GROUP BY c.id, u.name ORDER BY c.created_at DESC`
      : `SELECT c.*, u.name AS created_by_name,
           COUNT(cr.id) AS content_count
         FROM campaigns c
         LEFT JOIN users u ON u.id = c.created_by
         LEFT JOIN content_requests cr ON cr.campaign_id = c.id
         WHERE c.organization_id = $1
         GROUP BY c.id, u.name ORDER BY c.created_at DESC`;

    const result = await pool.query(query, projectId ? [orgId, projectId] : [orgId]);
    res.json({ campaigns: result.rows });
  } catch {
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// POST /api/campaigns
router.post('/', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.organizationId;
    const createdBy = (req as any).user.id;
    const { name, description, objective, projectId, departmentId, startDate, endDate } = req.body;

    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await pool.query(
      `INSERT INTO campaigns (organization_id, project_id, department_id, name, description, objective, start_date, end_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [orgId, projectId || null, departmentId || null, name, description, objective, startDate || null, endDate || null, createdBy]
    );
    res.status(201).json({ campaign: result.rows[0] });
  } catch {
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// GET /api/campaigns/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.organizationId;
    const result = await pool.query(
      `SELECT c.*, COUNT(cr.id) AS content_count
       FROM campaigns c
       LEFT JOIN content_requests cr ON cr.campaign_id = c.id
       WHERE c.id = $1 AND c.organization_id = $2
       GROUP BY c.id`,
      [req.params.id, orgId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ campaign: result.rows[0] });
  } catch {
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// PATCH /api/campaigns/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.organizationId;
    const { name, description, objective, status, startDate, endDate } = req.body;
    const result = await pool.query(
      `UPDATE campaigns SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        objective = COALESCE($3, objective),
        status = COALESCE($4, status),
        start_date = COALESCE($5, start_date),
        end_date = COALESCE($6, end_date),
        updated_at = NOW()
       WHERE id = $7 AND organization_id = $8
       RETURNING *`,
      [name, description, objective, status, startDate, endDate, req.params.id, orgId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ campaign: result.rows[0] });
  } catch {
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// DELETE /api/campaigns/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.organizationId;
    const result = await pool.query(
      'DELETE FROM campaigns WHERE id = $1 AND organization_id = $2 RETURNING id',
      [req.params.id, orgId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ message: 'Campaign deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

export default router;

