import { Router, Request, Response } from 'express';
import { pool } from '../db/connection';
import { authenticate as authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// GET /api/analytics/overview
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.organizationId;

    const [contentStats, agentStats] = await Promise.all([
      pool.query(
        `SELECT
          COUNT(*) AS total_requests,
          COUNT(*) FILTER (WHERE status = 'approved') AS approved,
          COUNT(*) FILTER (WHERE status = 'published') AS published,
          COUNT(*) FILTER (WHERE status = 'failed') AS failed,
          ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)))) AS avg_completion_seconds
        FROM content_requests
        WHERE organization_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`,
        [orgId]
      ),
      pool.query(
        `SELECT
          COUNT(*) AS total_executions,
          COUNT(*) FILTER (WHERE ae.status = 'completed') AS completed,
          COUNT(*) FILTER (WHERE ae.status = 'failed') AS failed,
          ROUND(AVG(ae.tokens_used)) AS avg_tokens,
          SUM(ae.tokens_used) AS total_tokens
        FROM agent_executions ae
        JOIN content_requests cr ON ae.content_request_id = cr.id
        WHERE cr.organization_id = $1 AND ae.created_at >= NOW() - INTERVAL '30 days'`,
        [orgId]
      ),
    ]);

    res.json({
      period: '30d',
      content: contentStats.rows[0],
      agents: agentStats.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch analytics overview' });
  }
});

// GET /api/analytics/productivity
router.get('/productivity', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.organizationId;
    const days = parseInt((req.query.days as string) || '30', 10);

    const result = await pool.query(
      `SELECT
        DATE_TRUNC('day', created_at) AS day,
        COUNT(*) AS requests_created,
        COUNT(*) FILTER (WHERE status IN ('approved', 'published')) AS completed
      FROM content_requests
      WHERE organization_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY day
      ORDER BY day ASC`,
      [orgId]
    );

    res.json({ days, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch productivity metrics' });
  }
});

// GET /api/analytics/quality
router.get('/quality', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.organizationId;

    const result = await pool.query(
      `SELECT
        ROUND(AVG((metadata->>'qualityScore')::numeric), 2) AS avg_quality_score,
        ROUND(AVG((metadata->>'brandScore')::numeric), 2) AS avg_brand_score,
        ROUND(AVG((metadata->>'readabilityScore')::numeric), 2) AS avg_readability_score,
        COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
        COUNT(*) AS total_count
      FROM content_requests
      WHERE organization_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`,
      [orgId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quality metrics' });
  }
});

// GET /api/analytics/platforms
router.get('/platforms', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.organizationId;

    const result = await pool.query(
      `SELECT
        target_platform,
        COUNT(*) AS count,
        COUNT(*) FILTER (WHERE status = 'published') AS published
      FROM content_requests
      WHERE organization_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY target_platform
      ORDER BY count DESC`,
      [orgId]
    );

    res.json({ platforms: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch platform metrics' });
  }
});

// GET /api/analytics/team-activity
router.get('/team-activity', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.organizationId;

    const result = await pool.query(
      `SELECT
        u.id,
        u.name,
        u.email,
        COUNT(cr.id) AS requests_created,
        COUNT(cr.id) FILTER (WHERE cr.status = 'approved') AS approved
      FROM users u
      LEFT JOIN content_requests cr ON cr.created_by = u.id
        AND cr.created_at >= NOW() - INTERVAL '30 days'
      WHERE u.organization_id = $1
      GROUP BY u.id, u.name, u.email
      ORDER BY requests_created DESC`,
      [orgId]
    );

    res.json({ team: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch team activity' });
  }
});

export default router;

