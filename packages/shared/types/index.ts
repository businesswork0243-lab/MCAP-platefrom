export * from './brand'
export * from './content'
export * from './agents'

// Common types
export interface User {
  id: string
  organizationId: string
  email: string
  name?: string
  role: 'owner' | 'admin' | 'editor' | 'writer' | 'reviewer' | 'analyst' | 'viewer'
  status: 'active' | 'invited' | 'suspended'
  avatarUrl?: string
  createdAt: string
}

export interface Organization {
  id: string
  name: string
  plan: 'free' | 'pro' | 'enterprise'
  industry?: string
  logoUrl?: string
  createdAt: string
}

export interface Project {
  id: string
  organizationId: string
  ownerId: string
  title: string
  description?: string
  status: 'active' | 'completed' | 'archived'
  createdAt: string
  updatedAt: string
}

export interface ApiResponse<T> {
  data: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}
