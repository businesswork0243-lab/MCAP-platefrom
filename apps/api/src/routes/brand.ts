import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { query, queryOne } from '../db/connection'
import { AuthenticatedRequest, authenticate } from '../middleware/auth'

export const brandRouter = Router()
brandRouter.use(authenticate)
export default brandRouter

const brandSchema = z.object({
  name: z.string().min(1),
  mission: z.string().optional(),
  vision: z.string().optional(),
  positioning: z.string().optional(),
  tone: z.object({
    formality: z.number().min(1).max(10).default(5),
    technical: z.number().min(1).max(10).default(5),
    confidence: z.number().min(1).max(10).default(5),
    emotion: z.number().min(1).max(10).default(5),
    humor: z.number().min(1).max(10).default(2),
    storytelling: z.number().min(1).max(10).default(5),
    persuasiveness: z.number().min(1).max(10).default(5),
    assertiveness: z.number().min(1).max(10).default(5),
  }).optional(),
  preferredTerms: z.array(z.string()).default([]),
  bannedPhrases: z.array(z.string()).default([]),
  industryVocabulary: z.array(z.string()).default([]),
  keyMessages: z.array(z.string()).default([]),
  valuePropositions: z.array(z.string()).default([]),
  complianceNotes: z.string().optional(),
  isDefault: z.boolean().default(false),
})

// GET /api/brand
brandRouter.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const profiles = await query(
      'SELECT * FROM brand_profiles WHERE organization_id = $1 ORDER BY is_default DESC, name',
      [req.user!.organizationId]
    )
    res.json({ profiles })
  } catch (err) {
    console.error('GET /brand error:', err)
    res.status(500).json({ error: 'Failed to fetch brand profiles' })
  }
})

// POST /api/brand
brandRouter.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = brandSchema.safeParse(req.body)
    if (!parsed.success) {
      console.error('POST /brand validation error:', parsed.error.errors)
      res.status(400).json({ error: parsed.error.errors })
      return
    }
    const d = parsed.data
    const tone = d.tone ?? { formality: 5, technical: 5, confidence: 5, emotion: 5, humor: 2, storytelling: 5, persuasiveness: 5, assertiveness: 5 }

    if (d.isDefault) {
      await query('UPDATE brand_profiles SET is_default = false WHERE organization_id = $1', [req.user!.organizationId])
    }

    const id = uuidv4()
    await query(
      `INSERT INTO brand_profiles
       (id, organization_id, name, mission, vision, positioning,
        tone_formality, tone_technical, tone_confidence, tone_emotion,
        tone_humor, tone_storytelling, tone_persuasiveness, tone_assertiveness,
        preferred_terms, banned_phrases, industry_vocabulary,
        key_messages, value_propositions, compliance_notes, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [
        id, req.user!.organizationId, d.name, d.mission, d.vision, d.positioning,
        tone.formality, tone.technical, tone.confidence, tone.emotion,
        tone.humor, tone.storytelling, tone.persuasiveness, tone.assertiveness,
        JSON.stringify(d.preferredTerms), JSON.stringify(d.bannedPhrases),
        JSON.stringify(d.industryVocabulary), JSON.stringify(d.keyMessages),
        JSON.stringify(d.valuePropositions), d.complianceNotes, d.isDefault,
      ]
    )
    const profile = await queryOne('SELECT * FROM brand_profiles WHERE id = $1', [id])
    res.status(201).json(profile)
  } catch (err) {
    console.error('POST /brand error:', err)
    res.status(500).json({ error: 'Failed to create brand profile' })
  }
})

// PUT /api/brand/:id
brandRouter.put('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = brandSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors })
      return
    }
    const d = parsed.data

    const existing = await queryOne('SELECT id FROM brand_profiles WHERE id = $1 AND organization_id = $2', [req.params.id, req.user!.organizationId])
    if (!existing) { res.status(404).json({ error: 'Not found' }); return }

    if (d.isDefault) {
      await query('UPDATE brand_profiles SET is_default = false WHERE organization_id = $1', [req.user!.organizationId])
    }

    const tone = d.tone
    await query(
      `UPDATE brand_profiles SET
        name = COALESCE($1, name),
        mission = COALESCE($2, mission),
        vision = COALESCE($3, vision),
        positioning = COALESCE($4, positioning),
        is_default = COALESCE($5, is_default),
        tone_formality = COALESCE($6, tone_formality),
        tone_technical = COALESCE($7, tone_technical),
        tone_confidence = COALESCE($8, tone_confidence),
        tone_emotion = COALESCE($9, tone_emotion),
        tone_humor = COALESCE($10, tone_humor),
        tone_storytelling = COALESCE($11, tone_storytelling),
        tone_persuasiveness = COALESCE($12, tone_persuasiveness),
        tone_assertiveness = COALESCE($13, tone_assertiveness),
        preferred_terms = COALESCE($14, preferred_terms),
        banned_phrases = COALESCE($15, banned_phrases),
        updated_at = NOW()
       WHERE id = $16`,
      [
        d.name, d.mission, d.vision, d.positioning, d.isDefault,
        tone?.formality, tone?.technical, tone?.confidence, tone?.emotion,
        tone?.humor, tone?.storytelling, tone?.persuasiveness, tone?.assertiveness,
        d.preferredTerms ? JSON.stringify(d.preferredTerms) : null,
        d.bannedPhrases ? JSON.stringify(d.bannedPhrases) : null,
        req.params.id,
      ]
    )
    const profile = await queryOne('SELECT * FROM brand_profiles WHERE id = $1', [req.params.id])
    res.json(profile)
  } catch (err) {
    console.error('PUT /brand error:', err)
    res.status(500).json({ error: 'Failed to update brand profile' })
  }
})

// DELETE /api/brand/:id
brandRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await query('DELETE FROM brand_profiles WHERE id = $1 AND organization_id = $2', [req.params.id, req.user!.organizationId])
    res.json({ message: 'Deleted' })
  } catch (err) {
    console.error('DELETE /brand error:', err)
    res.status(500).json({ error: 'Failed to delete brand profile' })
  }
})



