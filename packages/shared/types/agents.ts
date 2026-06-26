export type AgentName =
  | 'canonical_writer'
  | 'platform_optimizer'
  | 'brand_intelligence'
  | 'humanization'
  | 'editorial_qa'

export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface AgentExecution {
  id: string
  requestId: string
  agentName: AgentName
  agentVersion: string
  status: AgentStatus
  inputData?: Record<string, unknown>
  outputData?: Record<string, unknown>
  tokensUsed: number
  durationMs?: number
  errorMessage?: string
  createdAt: string
  updatedAt: string
}

export interface PipelineProgress {
  requestId: string
  currentAgent: AgentName | null
  completedAgents: AgentName[]
  failedAgent?: AgentName
  percentage: number
  status: 'running' | 'completed' | 'failed'
  estimatedSecondsRemaining?: number
}

export interface CanonicalWriterInput {
  topic: string
  objective: string
  context?: string
  audience?: string
  writingStructure?: string
  narrativePerspective?: string
  language: string
  specialInstructions?: string
}

export interface PlatformOptimizerInput {
  canonicalDraft: string
  platform: string
  audience?: string
  ctaType?: string
  toneOverrides?: Record<string, number>
}

export interface BrandIntelligenceInput {
  content: string
  platform: string
  brandProfile: {
    name: string
    tone: Record<string, number>
    preferredTerms: string[]
    bannedPhrases: string[]
    keyMessages: string[]
    positioning?: string
  }
}

export interface HumanizationInput {
  content: string
  platform: string
  level: 'light' | 'medium' | 'aggressive'
  preserveTechnicalTerms: boolean
}

export interface EditorialQAInput {
  content: string
  platform: string
  originalRequest: {
    topic: string
    objective?: string
    audience?: string
  }
  brandProfile?: {
    bannedPhrases: string[]
    keyMessages: string[]
  }
}
