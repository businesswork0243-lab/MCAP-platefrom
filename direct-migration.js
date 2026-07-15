require('dotenv').config();
const { Client } = require('pg');

const SQL = `
ALTER TABLE content_requests
  ADD COLUMN IF NOT EXISTS total_tokens_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE artifacts
  ADD COLUMN IF NOT EXISTS content_request_id UUID,
  ADD COLUMN IF NOT EXISTS agent_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

UPDATE artifacts SET content_request_id = request_id WHERE content_request_id IS NULL;
UPDATE artifacts SET agent_type = content_type WHERE agent_type IS NULL;
UPDATE artifacts SET content = body WHERE content IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'artifacts_content_request_id_fkey') THEN
    ALTER TABLE artifacts ADD CONSTRAINT artifacts_content_request_id_fkey FOREIGN KEY (content_request_id) REFERENCES content_requests(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_artifacts_content_request ON artifacts(content_request_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_agent_type ON artifacts(agent_type);

ALTER TABLE agent_executions
  ADD COLUMN IF NOT EXISTS content_request_id UUID,
  ADD COLUMN IF NOT EXISTS agent_type VARCHAR(100);

UPDATE agent_executions SET content_request_id = request_id WHERE content_request_id IS NULL;
UPDATE agent_executions SET agent_type = agent_name WHERE agent_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_agent_executions_content_request ON agent_executions(content_request_id);

CREATE OR REPLACE FUNCTION sync_artifact_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.content_request_id IS NOT NULL AND NEW.request_id IS NULL THEN NEW.request_id := NEW.content_request_id; END IF;
  IF NEW.request_id IS NOT NULL AND NEW.content_request_id IS NULL THEN NEW.content_request_id := NEW.request_id; END IF;
  IF NEW.agent_type IS NOT NULL AND NEW.content_type IS NULL THEN NEW.content_type := NEW.agent_type; END IF;
  IF NEW.content_type IS NOT NULL AND NEW.agent_type IS NULL THEN NEW.agent_type := NEW.content_type; END IF;
  IF NEW.content IS NOT NULL AND NEW.body IS NULL THEN NEW.body := NEW.content; END IF;
  IF NEW.body IS NOT NULL AND NEW.content IS NULL THEN NEW.content := NEW.body; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_artifacts_sync ON artifacts;
CREATE TRIGGER trg_artifacts_sync BEFORE INSERT OR UPDATE ON artifacts FOR EACH ROW EXECUTE FUNCTION sync_artifact_columns();

CREATE OR REPLACE FUNCTION sync_execution_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.content_request_id IS NOT NULL AND NEW.request_id IS NULL THEN NEW.request_id := NEW.content_request_id; END IF;
  IF NEW.request_id IS NOT NULL AND NEW.content_request_id IS NULL THEN NEW.content_request_id := NEW.request_id; END IF;
  IF NEW.agent_type IS NOT NULL AND NEW.agent_name IS NULL THEN NEW.agent_name := NEW.agent_type; END IF;
  IF NEW.agent_name IS NOT NULL AND NEW.agent_type IS NULL THEN NEW.agent_type := NEW.agent_name; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_executions_sync ON agent_executions;
CREATE TRIGGER trg_agent_executions_sync BEFORE INSERT OR UPDATE ON agent_executions FOR EACH ROW EXECUTE FUNCTION sync_execution_columns();

DELETE FROM content_requests WHERE status = 'generation_failed';
`;

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to Railway PostgreSQL...');
    await client.connect();
    console.log('✅ Connected!\n');

    console.log('🚀 Running migration directly (no file needed)...');
    await client.query(SQL);
    console.log('✅ Migration complete!\n');

    // Verify artifacts columns
    console.log('📋 Verifying artifacts columns:');
    const cols = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'artifacts' 
      AND column_name IN ('content_request_id', 'agent_type', 'content', 'metadata')
      ORDER BY column_name
    `);
    if (cols.rows.length === 0) {
      console.log('  ⚠️  No new columns found');
    } else {
      cols.rows.forEach(r => console.log(`  ✓ ${r.column_name}`));
    }

    // Verify content_requests columns
    console.log('\n📋 Verifying content_requests columns:');
    const cols2 = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'content_requests' 
      AND column_name IN ('total_tokens_used', 'completed_at', 'processing_started_at')
      ORDER BY column_name
    `);
    if (cols2.rows.length === 0) {
      console.log('  ⚠️  No new columns found');
    } else {
      cols2.rows.forEach(r => console.log(`  ✓ ${r.column_name}`));
    }

    // Verify agent_executions columns
    console.log('\n📋 Verifying agent_executions columns:');
    const cols3 = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'agent_executions' 
      AND column_name IN ('content_request_id', 'agent_type')
      ORDER BY column_name
    `);
    cols3.rows.forEach(r => console.log(`  ✓ ${r.column_name}`));

    // Verify triggers
    console.log('\n🔔 Verifying sync triggers:');
    const triggers = await client.query(`
      SELECT trigger_name FROM information_schema.triggers 
      WHERE trigger_name IN ('trg_artifacts_sync', 'trg_agent_executions_sync')
      GROUP BY trigger_name
    `);
    triggers.rows.forEach(r => console.log(`  ✓ ${r.trigger_name}`));

    // Data check
    console.log('\n📊 Data status:');
    const requests = await client.query('SELECT COUNT(*) FROM content_requests');
    const artifacts = await client.query('SELECT COUNT(*) FROM artifacts');
    console.log(`  Content Requests: ${requests.rows[0].count}`);
    console.log(`  Artifacts: ${artifacts.rows[0].count}`);

    console.log('\n🎉 Database ready! Refresh Vercel dashboard now.');
    console.log('   URL: https://mcap-platefrom-web-5eqh.vercel.app\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('   Detail:', err.detail || 'N/A');
    console.error('   Position:', err.position || 'N/A');
  } finally {
    await client.end();
  }
}

run();