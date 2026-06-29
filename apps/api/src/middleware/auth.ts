import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { queryOne } from '../db/connection'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    organizationId: string
    email: string
    role: string
  }
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' })
    return
  }

  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
    const user = await queryOne<{ id: string; organization_id: string; email: string; role: string }>(
      'SELECT id, organization_id, email, role FROM users WHERE id = $1',
      [decoded.userId]
    )
    if (!user) {
      res.status(401).json({ error: 'User not found' })
      return
    }
    req.user = { id: user.id, organizationId: user.organization_id, email: user.email, role: user.role }
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' })
      return
    }
    next()
  }
}
