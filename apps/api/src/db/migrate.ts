import { Pool } from 'pg'

const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS organizations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  email           TEXT        UNIQUE NOT NULL,
  name            TEXT        NOT NULL,
  role            TEXT        NOT NULL DEFAULT 'viewer',
  password_hash   TEXT        NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brand_profiles (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  name                 TEXT        NOT NULL,
  mission              TEXT,
  vision               TEXT,
  positioning          TEXT,
  tone_formality       INTEGER     DEFAULT 5,
  tone_technical       INTEGER     DEFAULT 5,
  tone_confidence      INTEGER     DEFAULT 5,
  tone_emotion         INTEGER     DEFAULT 5,
  tone_humor           INTEGER     DEFAULT 2,
  tone_storytelling    INTEGER     DEFAULT 5,
  tone_persuasiveness  INTEGER     DEFAULT 5,
  tone_assertiveness   INTEGER     DEFAULT 5,
  preferred_terms      JSONB       DEFAULT '[]',
  banned_phrases       JSONB       DEFAULT '[]',
  industry_vocabulary  JSONB       DEFAULT '[]',
  key_messages         JSONB       DEFAULT '[]',
  value_propositions   JSONB       DEFAULT '[]',
  compliance_notes     TEXT,
  is_default           BOOLEAN     DEFAULT false,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id        UUID        REFERENCES users(id),
  title           TEXT        NOT NULL,
  description     TEXT,
  status          TEXT        DEFAULT 'active',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS departments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  description     TEXT,
  head_user_id    UUID        REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS department_members (
  department_id UUID        REFERENCES departments(id) ON DELETE CASCADE,
  user_id       UUID        REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT        DEFAULT 'member',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (department_id, user_id)
);

CREATE TABLE IF NOT EXISTS campaigns (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID        REFERENCES projects(id) ON DELETE SET NULL,
  department_id   UUID        REFERENCES departments(id) ON DELETE SET NULL,
  name            TEXT        NOT NULL,
  description     TEXT,
  objective       TEXT,
  status          TEXT        DEFAULT 'draft',
  start_date      DATE,
  end_date        DATE,
  created_by      UUID        REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_requests (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           UUID        REFERENCES projects(id) ON DELETE SET NULL,
  campaign_id          UUID        REFERENCES campaigns(id) ON DELETE SET NULL,
  organization_id      UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  created_by           UUID        REFERENCES users(id),
  topic                TEXT        NOT NULL,
  objective            TEXT,
  context              TEXT,
  audience             TEXT,
  audience_description TEXT,
  platforms            JSONB,
  target_platform      TEXT,
  writing_structure    TEXT,
  narrative_perspective TEXT,
  cta_type             TEXT,
  brand_profile_id     UUID        REFERENCES brand_profiles(id),
  tone_overrides       JSONB,
  humanization_enabled  BOOLEAN    DEFAULT true,
  humanization_level   TEXT        DEFAULT 'medium',
  qa_enabled           BOOLEAN     DEFAULT true,
  requires_approval    BOOLEAN     DEFAULT false,
  reading_level        TEXT,
  language             TEXT        DEFAULT 'en',
  special_instructions TEXT,
  reference_urls       JSONB       DEFAULT '[]',
  keywords             JSONB       DEFAULT '[]',
  status               TEXT        DEFAULT 'queued',
  metadata             JSONB       DEFAULT '{}',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_executions (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_request_id UUID        REFERENCES content_requests(id) ON DELETE CASCADE,
  agent_type         TEXT        NOT NULL,
  status             TEXT        NOT NULL,
  tokens_used        INTEGER     DEFAULT 0,
  duration_ms        INTEGER,
  input_hash         TEXT,
  output_hash        TEXT,
  error_message      TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artifacts (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_request_id UUID        REFERENCES content_requests(id) ON DELETE CASCADE,
  agent_type         TEXT        NOT NULL,
  content            TEXT,
  version            INTEGER     DEFAULT 1,
  status             TEXT        DEFAULT 'draft',
  quality_score      JSONB,
  approved_by        UUID        REFERENCES users(id),
  approved_at        TIMESTAMPTZ,
  rejection_note     TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_invitations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  email           TEXT        NOT NULL,
  role            TEXT        NOT NULL,
  token           TEXT        UNIQUE NOT NULL,
  invited_by      UUID        REFERENCES users(id),
  expires_at      TIMESTAMPTZ,
  status          TEXT        DEFAULT 'pending',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS icp_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  brand_profile_id UUID REFERENCES brand_profiles(id),
  name VARCHAR(255) NOT NULL,
  
  -- Layer 1: Buyer Profile
  basic_characteristics JSONB DEFAULT '{}',
  interests_ecosystem JSONB DEFAULT '{}',
  personal_characteristics JSONB DEFAULT '{}',
  lifestyle_hobbies TEXT,
  current_challenges JSONB DEFAULT '[]',
  previous_solutions JSONB DEFAULT '[]',
  goals_outcomes JSONB DEFAULT '{}',
  emotional_motivations JSONB DEFAULT '[]',
  frustrations JSONB DEFAULT '[]',
  information_sources JSONB DEFAULT '[]',
  
  -- Layer 2: Behavioral Mapping
  personality_scores JSONB DEFAULT '{}',
  
  -- Layer 3: Business Expectations
  need_hierarchy JSONB DEFAULT '{}',
  time_expectations JSONB DEFAULT '{}',
  success_criteria JSONB DEFAULT '[]',
  
  -- Layer 4: Strategic
  positioning_strategy TEXT,
  roi_expectations JSONB DEFAULT '{}',
  risk_perception TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS writing_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  structure_flow JSONB NOT NULL, -- Steps/sections array
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brand_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_profile_id UUID REFERENCES brand_profiles(id),
  name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(100),
  file_size INTEGER,
  parsed_content TEXT, -- Extracted text for AI
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_repurposes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_content_id UUID REFERENCES artifacts(id),
  target_platform VARCHAR(100) NOT NULL,
  repurposed_content TEXT,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`

export async function runMigrations(pool: Pool): Promise<void> {
  await pool.query(SCHEMA_SQL)
  console.log('Database migrations applied')
}
