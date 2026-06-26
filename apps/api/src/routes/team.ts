import { Router, Request, Response } from 'express';
import { pool } from '../db/connection';
import { authenticate as authMiddleware } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

router.use(authMiddleware);

// GET /api/team/members
router.get('/members', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.organizationId;

    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.created_at,
        COUNT(cr.id) AS content_count
      FROM users u
      LEFT JOIN content_requests cr ON cr.created_by = u.id
      WHERE u.organization_id = $1
      GROUP BY u.id
      ORDER BY u.created_at ASC`,
      [orgId]
    );

    res.json({ members: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// POST /api/team/invite
router.post('/invite', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.organizationId;
    const invitedBy = (req as any).user.id;
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: 'email and role are required' });
    }

    const validRoles = ['admin', 'editor', 'writer', 'reviewer', 'analyst', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if user is already a member
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND organization_id = $2',
      [email, orgId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'User is already a member' });
    }

    // Check for pending invite
    const pendingInvite = await pool.query(
      `SELECT id FROM team_invitations
       WHERE organization_id = $1 AND email = $2 AND status = 'pending'`,
      [orgId, email]
    );
    if (pendingInvite.rows.length > 0) {
      return res.status(409).json({ error: 'Invitation already sent' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = await pool.query(
      `INSERT INTO team_invitations (organization_id, email, role, token, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, role, expires_at`,
      [orgId, email, role, token, invitedBy, expiresAt]
    );

    // TODO: send invite email with token

    res.status(201).json({ invitation: invite.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// GET /api/team/invitations
router.get('/invitations', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.organizationId;

    const result = await pool.query(
      `SELECT ti.id, ti.email, ti.role, ti.status, ti.expires_at, ti.created_at,
        u.name AS invited_by_name
       FROM team_invitations ti
       LEFT JOIN users u ON u.id = ti.invited_by
       WHERE ti.organization_id = $1
       ORDER BY ti.created_at DESC`,
      [orgId]
    );

    res.json({ invitations: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// POST /api/team/invitations/:token/accept
router.post('/invitations/:token/accept', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const invite = await pool.query(
      `SELECT * FROM team_invitations
       WHERE token = $1 AND status = 'pending' AND expires_at > NOW()`,
      [token]
    );

    if (invite.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }

    const inv = invite.rows[0];

    await pool.query('BEGIN');
    try {
      await pool.query(
        `UPDATE team_invitations SET status = 'accepted' WHERE id = $1`,
        [inv.id]
      );

      // If user exists, update their org; otherwise they'll register with this invite
      await pool.query(
        `UPDATE users SET organization_id = $1, role = $2 WHERE email = $3`,
        [inv.organization_id, inv.role, inv.email]
      );

      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }

    res.json({ message: 'Invitation accepted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// PATCH /api/team/members/:id/role
router.patch('/members/:id/role', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.organizationId;
    const requestingRole = (req as any).user.role;
    const { id } = req.params;
    const { role } = req.body;

    if (!['owner', 'admin'].includes(requestingRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const validRoles = ['admin', 'editor', 'writer', 'reviewer', 'analyst', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const result = await pool.query(
      `UPDATE users SET role = $1
       WHERE id = $2 AND organization_id = $3
       RETURNING id, name, email, role`,
      [role, id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json({ member: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// DELETE /api/team/members/:id
router.delete('/members/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.organizationId;
    const requestingRole = (req as any).user.role;
    const { id } = req.params;

    if (!['owner', 'admin'].includes(requestingRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const result = await pool.query(
      `DELETE FROM users WHERE id = $1 AND organization_id = $2 AND role != 'owner'
       RETURNING id`,
      [id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found or cannot be removed' });
    }

    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;

