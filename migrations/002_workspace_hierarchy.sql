-- =============================================
-- MCAP PLATFORM — Migration 002
-- Workspace Hierarchy: Departments, Campaigns
-- Spec: Organization → Departments → Teams → Projects → Campaigns → Content Requests
-- Also adds: input_hash, output_hash to agent_executions (spec section 5)
-- =============================================

-- =============================================
-- DEPARTMENTS (under Organization)
-- =============================================
CREATE TABLE IF NOT EXISTS departments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  head_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_departments_org ON departments(organization_id);

-- =============================================
-- CAMPAIGNS (under Projects, above Content Requests)
-- =============================================
CREATE TABLE IF NOT EXISTS campaigns (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  objective       TEXT,
  start_date      DATE,
  end_date        DATE,
  status          VARCHAR(50) DEFAULT 'active',  -- active | paused | completed | archived
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_org     ON campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_project ON campaigns(project_id);

-- =============================================
-- Link Content Requests → Campaigns (optional)
-- =============================================
ALTER TABLE content_requests
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_content_requests_campaign    ON content_requests(campaign_id);
CREATE INDEX IF NOT EXISTS idx_content_requests_department  ON content_requests(department_id);

-- =============================================
-- Link Users → Departments
-- =============================================
CREATE TABLE IF NOT EXISTS department_members (
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          VARCHAR(50) DEFAULT 'member',
  joined_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (department_id, user_id)
);

-- =============================================
-- agent_executions — add input_hash, output_hash (spec section 5)
-- =============================================
ALTER TABLE agent_executions
  ADD COLUMN IF NOT EXISTS input_hash  VARCHAR(64),
  ADD COLUMN IF NOT EXISTS output_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS version     INTEGER DEFAULT 1;

-- =============================================
-- Triggers for updated_at
-- =============================================
DROP TRIGGER IF EXISTS update_departments_updated_at ON departments;
CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
