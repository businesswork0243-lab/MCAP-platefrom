-- =============================================
-- MCAP PLATFORM — INITIAL DATABASE SCHEMA
-- Migration 001: Core Tables
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ORGANIZATIONS
-- =============================================
CREATE TABLE organizations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  plan          VARCHAR(50) DEFAULT 'free',   -- free | pro | enterprise
  industry      VARCHAR(100),
  team_size     VARCHAR(50),
  logo_url      TEXT,
  timezone      VARCHAR(100) DEFAULT 'UTC',
  default_language VARCHAR(10) DEFAULT 'en',
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- USERS
-- =============================================
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email           VARCHAR(255) UNIQUE NOT NULL,
  name            VARCHAR(255),
  role            VARCHAR(50) DEFAULT 'writer',  -- owner | admin | editor | writer | reviewer | analyst | viewer
  status          VARCHAR(50) DEFAULT 'active',  -- active | invited | suspended
  avatar_url      TEXT,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- BRAND PROFILES
-- =============================================
CREATE TABLE brand_profiles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name                VARCHAR(255) NOT NULL,
  mission             TEXT,
  vision              TEXT,
  positioning         TEXT,
  -- Tone dimensions (1-10 scale)
  tone_formality      INTEGER DEFAULT 5 CHECK (tone_formality BETWEEN 1 AND 10),
  tone_technical      INTEGER DEFAULT 5 CHECK (tone_technical BETWEEN 1 AND 10),
  tone_confidence     INTEGER DEFAULT 5 CHECK (tone_confidence BETWEEN 1 AND 10),
  tone_emotion        INTEGER DEFAULT 5 CHECK (tone_emotion BETWEEN 1 AND 10),
  tone_humor          INTEGER DEFAULT 2 CHECK (tone_humor BETWEEN 1 AND 10),
  tone_storytelling   INTEGER DEFAULT 5 CHECK (tone_storytelling BETWEEN 1 AND 10),
  tone_persuasiveness INTEGER DEFAULT 5 CHECK (tone_persuasiveness BETWEEN 1 AND 10),
  tone_assertiveness  INTEGER DEFAULT 5 CHECK (tone_assertiveness BETWEEN 1 AND 10),
  -- Terminology
  preferred_terms     JSONB DEFAULT '[]',
  banned_phrases      JSONB DEFAULT '[]',
  industry_vocabulary JSONB DEFAULT '[]',
  -- Messaging
  key_messages        JSONB DEFAULT '[]',
  value_propositions  JSONB DEFAULT '[]',
  compliance_notes    TEXT,
  -- Examples
  example_content     JSONB DEFAULT '[]',
  is_default          BOOLEAN DEFAULT false,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- PROJECTS
-- =============================================
CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id        UUID REFERENCES users(id),
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  status          VARCHAR(50) DEFAULT 'active',  -- active | completed | archived
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- CONTENT REQUESTS
-- =============================================
CREATE TABLE content_requests (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id            UUID REFERENCES projects(id) ON DELETE SET NULL,
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_by            UUID REFERENCES users(id),
  -- Core inputs
  topic                 VARCHAR(500) NOT NULL,
  objective             TEXT,
  context               TEXT,
  audience              VARCHAR(255),
  audience_description  TEXT,
  -- Platform & style
  platforms             JSONB DEFAULT '[]',   -- ['linkedin_post', 'x_thread', 'blog']
  writing_structure     VARCHAR(100),         -- debate | data_driven | story | thesis | incentive_diagnosis
  narrative_perspective VARCHAR(100),         -- founder | ceo | researcher | analyst ...
  cta_type              VARCHAR(100),         -- invite_discussion | newsletter | consultation ...
  -- Brand & tone
  brand_profile_id      UUID REFERENCES brand_profiles(id),
  tone_overrides        JSONB,
  -- AI settings
  humanization_enabled  BOOLEAN DEFAULT true,
  humanization_level    VARCHAR(50) DEFAULT 'medium',  -- light | medium | aggressive
  qa_enabled            BOOLEAN DEFAULT true,
  requires_approval     BOOLEAN DEFAULT false,
  reading_level         VARCHAR(50),
  language              VARCHAR(10) DEFAULT 'en',
  special_instructions  TEXT,
  -- References
  uploaded_files        JSONB DEFAULT '[]',
  reference_urls        JSONB DEFAULT '[]',
  keywords              JSONB DEFAULT '[]',
  -- Status
  status                VARCHAR(50) DEFAULT 'draft',
  -- draft | queued | running | awaiting_qa | awaiting_review | approved | published
  -- | validation_failed | generation_failed | timeout | cancelled | archived
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- AGENT EXECUTIONS
-- =============================================
CREATE TABLE agent_executions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id      UUID REFERENCES content_requests(id) ON DELETE CASCADE,
  agent_name      VARCHAR(100) NOT NULL,   -- canonical_writer | platform_optimizer | brand_intelligence | humanization | editorial_qa
  agent_version   VARCHAR(20) DEFAULT '1.0',
  status          VARCHAR(50) DEFAULT 'pending',  -- pending | running | completed | failed
  input_data      JSONB,
  output_data     JSONB,
  input_hash      VARCHAR(64),
  output_hash     VARCHAR(64),
  tokens_used     INTEGER DEFAULT 0,
  duration_ms     INTEGER,
  error_message   TEXT,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- ARTIFACTS (Generated Content)
-- =============================================
CREATE TABLE artifacts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id      UUID REFERENCES content_requests(id) ON DELETE CASCADE,
  execution_id    UUID REFERENCES agent_executions(id),
  platform        VARCHAR(100),    -- canonical | linkedin_post | linkedin_article | x_post | x_thread | blog | newsletter | landing_page | executive_brief
  content_type    VARCHAR(100),    -- draft | platform_adapted | brand_aligned | humanized | qa_reviewed
  body            TEXT NOT NULL,
  version         INTEGER DEFAULT 1,
  quality_score   JSONB,           -- { overall: 87, readability: 90, brand: 85, platform_fit: 92, humanization: 80, clarity: 88 }
  qa_findings     JSONB DEFAULT '[]',
  status          VARCHAR(50) DEFAULT 'generated',  -- generated | approved | rejected | published
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMP WITH TIME ZONE,
  rejection_note  TEXT,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- UPLOADED FILES
-- =============================================
CREATE TABLE uploaded_files (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  uploaded_by     UUID REFERENCES users(id),
  request_id      UUID REFERENCES content_requests(id),
  filename        VARCHAR(500) NOT NULL,
  file_url        TEXT NOT NULL,
  file_size       INTEGER,
  mime_type       VARCHAR(100),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TEMPLATES
-- =============================================
CREATE TABLE templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES users(id),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  visibility      VARCHAR(50) DEFAULT 'personal',  -- personal | team | public
  config          JSONB NOT NULL,  -- full content request config stored as JSON
  platforms       JSONB DEFAULT '[]',
  writing_structure VARCHAR(100),
  industry_tags   JSONB DEFAULT '[]',
  use_count       INTEGER DEFAULT 0,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- AUDIT EVENTS
-- =============================================
CREATE TABLE audit_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id        UUID REFERENCES users(id),
  action          VARCHAR(255) NOT NULL,  -- user.login | content.generate | brand.update | artifact.approve ...
  object_type     VARCHAR(100),
  object_id       UUID,
  metadata        JSONB,
  ip_address      INET,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TEAM INVITATIONS
-- =============================================
CREATE TABLE team_invitations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  invited_by      UUID REFERENCES users(id),
  email           VARCHAR(255) NOT NULL,
  role            VARCHAR(50) DEFAULT 'writer',
  token           VARCHAR(255) UNIQUE NOT NULL,
  status          VARCHAR(50) DEFAULT 'pending',  -- pending | accepted | expired
  expires_at      TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_brand_profiles_organization ON brand_profiles(organization_id);
CREATE INDEX idx_projects_organization ON projects(organization_id);
CREATE INDEX idx_content_requests_organization ON content_requests(organization_id);
CREATE INDEX idx_content_requests_project ON content_requests(project_id);
CREATE INDEX idx_content_requests_status ON content_requests(status);
CREATE INDEX idx_agent_executions_request ON agent_executions(request_id);
CREATE INDEX idx_artifacts_request ON artifacts(request_id);
CREATE INDEX idx_artifacts_status ON artifacts(status);
CREATE INDEX idx_audit_events_organization ON audit_events(organization_id);
CREATE INDEX idx_audit_events_created_at ON audit_events(created_at DESC);

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_brand_profiles_updated_at BEFORE UPDATE ON brand_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_content_requests_updated_at BEFORE UPDATE ON content_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_agent_executions_updated_at BEFORE UPDATE ON agent_executions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_artifacts_updated_at BEFORE UPDATE ON artifacts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_templates_updated_at BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
