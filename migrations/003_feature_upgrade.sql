-- migrations/003_feature_upgrade.sql
-- =============================================
-- MCAP PLATFORM — FEATURE UPGRADE MIGRATION
-- Migration 003: Brand Extensions + ICP + Repurpose
-- =============================================

-- ─────────────────────────────────────────────
-- 1. BRAND PROFILES — New Columns
-- ─────────────────────────────────────────────

ALTER TABLE brand_profiles
  -- Basic identity fields
  ADD COLUMN IF NOT EXISTS website          VARCHAR(500),
  ADD COLUMN IF NOT EXISTS industry         VARCHAR(100),
  ADD COLUMN IF NOT EXISTS description      TEXT,

  -- Extended tone (new dimensions)
  ADD COLUMN IF NOT EXISTS tone_enthusiasm  INTEGER DEFAULT 5 
    CHECK (tone_enthusiasm BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS tone_empathy     INTEGER DEFAULT 5 
    CHECK (tone_empathy BETWEEN 1 AND 10),

  -- Values & Beliefs (new fields)
  ADD COLUMN IF NOT EXISTS likes            JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS hates            JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS dislikes         JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS stands_for       JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS stands_against   JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS core_motivations JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS core_values      JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS life_purpose     TEXT;

-- ─────────────────────────────────────────────
-- 2. BRAND DOCUMENTS — New Table
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brand_documents (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_profile_id  UUID NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uploaded_by       UUID REFERENCES users(id),

  -- File info
  name              VARCHAR(500)  NOT NULL,
  file_url          TEXT          NOT NULL,
  file_size         INTEGER,
  mime_type         VARCHAR(100),

  -- Parsed content (for AI context)
  parsed_content    TEXT,
  parsing_status    VARCHAR(50)   DEFAULT 'pending',
  -- pending | processing | done | failed

  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_documents_brand
  ON brand_documents(brand_profile_id);

CREATE INDEX IF NOT EXISTS idx_brand_documents_org
  ON brand_documents(organization_id);

-- ─────────────────────────────────────────────
-- 3. ICP PROFILES — New Table (SIRF Framework)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS icp_profiles (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brand_profile_id  UUID REFERENCES brand_profiles(id) ON DELETE SET NULL,
  created_by        UUID REFERENCES users(id),

  name              VARCHAR(255) NOT NULL,

  -- Layer 1: Buyer Profile (Basic Characteristics)
  basic_characteristics JSONB DEFAULT '{}',
  /*
    {
      ageGroup: "30-45",
      education: "Graduate",
      role: "VP Marketing",
      industry: "SaaS",
      orgType: "Startup",
      seniority: "Director",
      geography: "North America",
      revenueRange: "$1M-$10M",
      teamSize: "10-50",
      purchasingAuthority: "sole_decision_maker"
    }
  */

  -- Layer 1: Interests & Ecosystem
  interests             JSONB DEFAULT '[]',
  information_sources   JSONB DEFAULT '[]',
  lifestyle_hobbies     TEXT,

  -- Layer 1: Challenges & Goals
  current_challenges    JSONB DEFAULT '[]',
  previous_solutions    JSONB DEFAULT '[]',
  goals                 JSONB DEFAULT '[]',
  emotional_motivations JSONB DEFAULT '[]',
  frustrations          JSONB DEFAULT '[]',

  -- Layer 2: Personality/Behavioral Mapping (1-10 scales)
  personality_scores    JSONB DEFAULT '{}',
  /*
    {
      introversion_extroversion: 7,
      creativity_analytical: 4,
      emotional_rational: 6,
      conservative_experimental: 5,
      short_long_term: 8,
      detail_big_picture: 5,
      individualistic_collaborative: 6,
      process_intuition: 4
    }
  */

  -- Layer 3: Business Expectations
  need_hierarchy        JSONB DEFAULT '{}',
  /*
    {
      dealBreakers: [],
      acceptableStandards: [],
      idealOutcomes: []
    }
  */
  time_expectations     JSONB DEFAULT '{}',
  success_criteria      JSONB DEFAULT '[]',

  -- Layer 4: Strategic
  positioning_strategy  VARCHAR(255),
  roi_expectations      JSONB DEFAULT '{}',
  risk_perception       TEXT,
  non_ideal_notes       TEXT,

  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_icp_profiles_org
  ON icp_profiles(organization_id);

CREATE INDEX IF NOT EXISTS idx_icp_profiles_brand
  ON icp_profiles(brand_profile_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_icp_profiles_updated_at ON icp_profiles;
CREATE TRIGGER trg_icp_profiles_updated_at
  BEFORE UPDATE ON icp_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────
-- 4. CUSTOM WRITING STRUCTURES — New Table
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS writing_structures (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES users(id),

  name            VARCHAR(255) NOT NULL,
  description     TEXT,

  -- Array of steps/sections
  structure_flow  JSONB NOT NULL DEFAULT '[]',
  /*
    [
      "Open with a controversial question",
      "Share a personal failure story",
      "The lesson that changed everything",
      "3 actionable steps",
      "Soft CTA"
    ]
  */

  is_system       BOOLEAN DEFAULT false,
  use_count       INTEGER DEFAULT 0,

  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_writing_structures_org
  ON writing_structures(organization_id);

DROP TRIGGER IF EXISTS trg_writing_structures_updated_at ON writing_structures;
CREATE TRIGGER trg_writing_structures_updated_at
  BEFORE UPDATE ON writing_structures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────
-- 5. CONTENT REQUESTS — New Columns
-- ─────────────────────────────────────────────

ALTER TABLE content_requests
  -- ICP Selection
  ADD COLUMN IF NOT EXISTS icp_profile_id         UUID
    REFERENCES icp_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS error_message          TEXT,

  -- Custom Writing Structure
  ADD COLUMN IF NOT EXISTS custom_structure_id    UUID
    REFERENCES writing_structures(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custom_structure_flow  TEXT,
  -- Raw text if user types custom structure without saving

  -- CTA (extended)
  ADD COLUMN IF NOT EXISTS custom_cta             TEXT,
  -- Used when cta_type = 'custom'

  -- Tonality Spectrum (per-piece, not brand voice)
  ADD COLUMN IF NOT EXISTS tonality_spectrum      JSONB DEFAULT '{}',
  /*
    {
      angry: 0,
      frustrated: 0,
      excited: 5,
      confident: 6,
      curious: 4,
      empathetic: 5,
      playful: 3,
      serious: 5
    }
  */

  -- Blog/Long-form word count
  ADD COLUMN IF NOT EXISTS word_count             INTEGER,

  -- SEO Settings
  ADD COLUMN IF NOT EXISTS seo_enabled            BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS seo_settings           JSONB DEFAULT '{}',
  /*
    {
      primaryKeyword: "content marketing for startups",
      secondaryKeywords: ["b2b content", "founder content"],
      metaDescription: "...",
      targetWordCount: 1500
    }
  */

  -- Missing from original (target_platform already exists, add plural ref)
  ADD COLUMN IF NOT EXISTS target_platform        VARCHAR(100);
  -- Note: Already may exist — use IF NOT EXISTS handles it

-- Update index for icp lookups
CREATE INDEX IF NOT EXISTS idx_content_requests_icp
  ON content_requests(icp_profile_id);

-- ─────────────────────────────────────────────
-- 6. CONTENT REPURPOSES — New Table
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS content_repurposes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_request_id   UUID NOT NULL REFERENCES content_requests(id) ON DELETE CASCADE,
  source_artifact_id  UUID REFERENCES artifacts(id) ON DELETE SET NULL,
  created_by          UUID REFERENCES users(id),

  -- Target
  target_platform     VARCHAR(100) NOT NULL,

  -- Output
  repurposed_content  TEXT,
  status              VARCHAR(50) DEFAULT 'pending',
  -- pending | generating | done | failed

  tokens_used         INTEGER DEFAULT 0,
  error_message       TEXT,

  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repurposes_source
  ON content_repurposes(source_request_id);

CREATE INDEX IF NOT EXISTS idx_repurposes_org
  ON content_repurposes(organization_id);

DROP TRIGGER IF EXISTS trg_content_repurposes_updated_at ON content_repurposes;
CREATE TRIGGER trg_content_repurposes_updated_at
  BEFORE UPDATE ON content_repurposes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────
-- 7. ARTIFACTS — Add repurpose tracking column
-- ─────────────────────────────────────────────

ALTER TABLE artifacts
  ADD COLUMN IF NOT EXISTS repurpose_id UUID
    REFERENCES content_repurposes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_repurposed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS seo_meta      JSONB DEFAULT '{}';
  /*
    {
      title: "...",
      metaDescription: "...",
      slug: "...",
      focusKeyword: "..."
    }
  */

-- ─────────────────────────────────────────────
-- 8. CLIENT / WORKSPACE SUPPORT
-- (Multi-client ke liye — separate from organization)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clients (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES users(id),

  name            VARCHAR(255) NOT NULL,
  industry        VARCHAR(100),
  website         VARCHAR(500),
  logo_url        TEXT,
  description     TEXT,
  status          VARCHAR(50) DEFAULT 'active',  -- active | inactive | archived

  -- Each client can have their own brand profile
  brand_profile_id UUID REFERENCES brand_profiles(id) ON DELETE SET NULL,

  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_org
  ON clients(organization_id);

DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Link content requests to clients
ALTER TABLE content_requests
  ADD COLUMN IF NOT EXISTS client_id UUID
    REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_content_requests_client
  ON content_requests(client_id);

-- Link brand profiles to clients
ALTER TABLE brand_profiles
  ADD COLUMN IF NOT EXISTS client_id UUID
    REFERENCES clients(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────
-- 9. SEED SYSTEM WRITING STRUCTURES
-- ─────────────────────────────────────────────

-- We need a system org for system-level records
-- Insert system structures with NULL org (system-wide)
-- Use a DO block to avoid errors on re-run

DO $$
DECLARE
  sys_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Create system org if not exists
  INSERT INTO organizations (id, name, plan)
  VALUES (sys_id, 'SYSTEM', 'enterprise')
  ON CONFLICT (id) DO NOTHING;

  -- System writing structures
  INSERT INTO writing_structures 
    (organization_id, name, description, structure_flow, is_system)
  VALUES
    (sys_id, 'Thesis',
     'Strong argument → Evidence → Conclusion',
     '["Hook", "Thesis Statement", "Supporting Arguments", "Evidence", "Conclusion"]',
     true),

    (sys_id, 'Storytelling',
     'Setup → Conflict → Resolution',
     '["Scene Setting", "Challenge/Conflict", "Journey", "Resolution", "Takeaway"]',
     true),

    (sys_id, 'Listicle',
     'Key points in structured list format',
     '["Hook", "Point 1", "Point 2", "Point 3+", "Summary CTA"]',
     true),

    (sys_id, 'Problem → Solution',
     'Identify pain → Present fix',
     '["Problem Statement", "Why it Matters", "Common Mistakes", "The Solution", "Next Steps"]',
     true),

    (sys_id, 'Before → After → Bridge',
     'BAB framework',
     '["Before State", "After State", "Bridge (How to get there)", "CTA"]',
     true),

    (sys_id, 'AIDA',
     'Attention → Interest → Desire → Action',
     '["Attention Hook", "Interest Builder", "Desire Creation", "Action CTA"]',
     true),

    (sys_id, 'Hot Take / Opinion',
     'Controversial stance with backing',
     '["Bold Claim", "Why Most People Disagree", "My Evidence", "Nuanced Conclusion"]',
     true),

    (sys_id, 'Case Study',
     'Real example with results',
     '["Context", "Challenge", "Approach", "Results", "Key Lessons"]',
     true)

  ON CONFLICT DO NOTHING;

END $$;