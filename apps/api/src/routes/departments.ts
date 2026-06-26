import { Router, Request, Response } from 'express';
import { pool } from '../db/connection';
import { authenticate as authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /api/departments
router.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.organizationId;
    const result = await pool.query(
      `SELECT d.*, u.name AS head_name,
         COUNT(DISTINCT dm.user_id) AS member_count
       FROM departments d
       LEFT JOIN users u ON u.id = d.head_user_id
       LEFT JOIN department_members dm ON dm.department_id = d.id
       WHERE d.organization_id = $1
       GROUP BY d.id, u.name
       ORDER BY d.name`,
      [orgId]
    );
    res.json({ departments: result.rows });
  } catch {
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// POST /api/departments
router.post('/', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.organizationId;
    const requestingRole = (req as any).user.role;
    if (!['owner', 'admin'].includes(requestingRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name, description, headUserId } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await pool.query(
      `INSERT INTO departments (organization_id, name, description, head_user_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [orgId, name, description, headUserId || null]
    );
    res.status(201).json({ department: result.rows[0] });
  } catch {
    res.status(500).json({ error: 'Failed to create department' });
  }
});

// POST /api/departments/:id/members
router.post('/:id/members', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.organizationId;
    const { userId, role } = req.body;

    const dept = await pool.query(
      'SELECT id FROM departments WHERE id = $1 AND organization_id = $2',
      [req.params.id, orgId]
    );
    if (!dept.rows.length) return res.status(404).json({ error: 'Department not found' });

    await pool.query(
      `INSERT INTO department_members (department_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (department_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [req.params.id, userId, role || 'member']
    );
    res.json({ message: 'Member added' });
  } catch {
    res.status(500).json({ error: 'Failed to add member' });
  }
});

export default router;

