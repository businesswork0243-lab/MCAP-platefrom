export type Platform =
  | 'canonical'
  | 'linkedin_post'
  | 'linkedin_article'
  | 'x_post'
  | 'x_thread'
  | 'blog'
  | 'newsletter'
  | 'landing_page'
  | 'executive_brief'

export type WritingStructure =
  | 'debate'
  | 'data_driven'
  | 'story'
  | 'thesis'
  | 'incentive_diagnosis'

export type NarrativePerspective =
  | 'founder'
  | 'ceo'
  | 'cmo'
  | 'cto'
  | 'researcher'
  | 'analyst'
  | 'consultant'
  | 'journalist'
  | 'educator'
  | 'institution'

export type CtaType =
  | 'invite_discussion'
  | 'newsletter_subscribe'
  | 'book_consultation'
  | 'download_resource'
  | 'register_event'
  | 'product_trial'
  | 'none'

export type ContentRequestStatus =
  | 'draft'
  | 'queued'
  | 'running'
  | 'awaiting_qa'
  | 'awaiting_review'
  | 'approved'
  | 'published'
  | 'validation_failed'
  | 'generation_failed'
  | 'timeout'
  | 'cancelled'
  | 'archived'

export type HumanizationLevel = 'light' | 'medium' | 'aggressive'

export interface ContentRequest {
  id: string
  projectId?: string
  organizationId: string
  createdBy: string
  topic: string
  objective?: string
  context?: string
  audience?: string
  audienceDescription?: string
  platforms: Platform[]
  writingStructure?: WritingStructure
  narrativePerspective?: NarrativePerspective
  ctaType?: CtaType
  brandProfileId?: string
  toneOverrides?: Partial<Record<string, number>>
  humanizationEnabled: boolean
  humanizationLevel: HumanizationLevel
  qaEnabled: boolean
  requiresApproval: boolean
  readingLevel?: string
  language: string
  specialInstructions?: string
  uploadedFiles: string[]
  referenceUrls: string[]
  keywords: string[]
  status: ContentRequestStatus
  createdAt: string
  updatedAt: string
}

export interface QualityScore {
  overall: number
  readability: number
  brandAdherence: number
  platformFit: number
  humanization: number
  clarity: number
  engagementPotential: number
  ctaAlignment: number
}

export interface QAFinding {
  type: 'warning' | 'error' | 'info' | 'success'
  message: string
  suggestion?: string
}

export type ArtifactStatus = 'generated' | 'approved' | 'rejected' | 'published'

export interface Artifact {
  id: string
  requestId: string
  executionId?: string
  platform: Platform
  contentType: string
  body: string
  version: number
  qualityScore?: QualityScore
  qaFindings: QAFinding[]
  status: ArtifactStatus
  approvedBy?: string
  approvedAt?: string
  rejectionNote?: string
  createdAt: string
  updatedAt: string
}

export type CreateContentRequestInput = Pick<
  ContentRequest,
  | 'topic'
  | 'objective'
  | 'context'
  | 'audience'
  | 'audienceDescription'
  | 'platforms'
  | 'writingStructure'
  | 'narrativePerspective'
  | 'ctaType'
  | 'brandProfileId'
  | 'toneOverrides'
  | 'humanizationEnabled'
  | 'humanizationLevel'
  | 'qaEnabled'
  | 'requiresApproval'
  | 'readingLevel'
  | 'language'
  | 'specialInstructions'
  | 'referenceUrls'
  | 'keywords'
> & {
  projectId?: string
}
