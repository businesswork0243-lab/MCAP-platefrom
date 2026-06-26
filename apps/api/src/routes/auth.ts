import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { query, queryOne } from '../db/connection'

export const authRouter = Router()
export default authRouter

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(2),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

async function handleSignup(req: Request, res: Response): Promise<void> {
  const parsed = signupSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors })
    return
  }
  const { name, email, password, companyName } = parsed.data

  const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email])
  if (existing) {
    res.status(409).json({ error: 'Email already registered' })
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const orgId = uuidv4()
  const userId = uuidv4()

  await query('INSERT INTO organizations (id, name) VALUES ($1, $2)', [orgId, companyName])
  await query(
    'INSERT INTO users (id, organization_id, email, name, role, password_hash) VALUES ($1, $2, $3, $4, $5, $6)',
    [userId, orgId, email, name, 'owner', passwordHash]
  )

  const token = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '7d' })
  res.status(201).json({ token, user: { id: userId, name, email, role: 'owner', organizationId: orgId } })
}

authRouter.post('/signup', handleSignup)
authRouter.post('/register', handleSignup)

authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors })
    return
  }
  const { email, password } = parsed.data

  const user = await queryOne<{
    id: string; name: string; email: string; role: string;
    organization_id: string; password_hash: string
  }>('SELECT id, name, email, role, organization_id, password_hash FROM users WHERE email = $1', [email])

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organization_id } })
})

authRouter.get('/me', async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) { res.status(401).json({ error: 'Unauthorized' }); return }
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET!) as { userId: string }
    const user = await queryOne<{ id: string; name: string; email: string; role: string; organization_id: string }>(
      'SELECT id, name, email, role, organization_id FROM users WHERE id = $1', [decoded.userId]
    )
    if (!user) { res.status(404).json({ error: 'User not found' }); return }
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organization_id })
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
})

