export interface ToneDimensions {
  formality: number       // 1-10
  technical: number       // 1-10
  confidence: number      // 1-10
  emotion: number         // 1-10
  humor: number           // 1-10
  storytelling: number    // 1-10
  persuasiveness: number  // 1-10
  assertiveness: number   // 1-10
}

export interface BrandProfile {
  id: string
  organizationId: string
  name: string
  mission?: string
  vision?: string
  positioning?: string
  tone: ToneDimensions
  preferredTerms: string[]
  bannedPhrases: string[]
  industryVocabulary: string[]
  keyMessages: string[]
  valuePropositions: string[]
  complianceNotes?: string
  exampleContent: string[]
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export type CreateBrandProfileInput = Omit<BrandProfile, 'id' | 'createdAt' | 'updatedAt'>
