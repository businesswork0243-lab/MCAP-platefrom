-- migrations/004_auth_fixes.sql
-- ─────────────────────────────────────────────
-- Users table mein password_hash column add karo
-- (001_initial_schema.sql mein missing tha)
-- ─────────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS status        VARCHAR(50) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_login_at  TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS refresh_token  VARCHAR(500),
  ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMP WITH TIME ZONE;

-- Organizations mein name index
CREATE INDEX IF NOT EXISTS idx_organizations_name
  ON organizations(name);

-- Users mein status index
CREATE INDEX IF NOT EXISTS idx_users_status
  ON users(status);
