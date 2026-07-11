const { Client } = require('pg');

const DATABASE_URL = 'postgresql://mcap:zavGuEh3UKdeAhBxqrRfEUyJfRvWMmt1@dpg-d915h5flk1mc739ojgmg-a.oregon-postgres.render.com/mcap_db';

async function main() {
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected\n');

        console.log('🔧 Fixing projects table...');
        await client.query(`
      ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS department_id UUID,
        ADD COLUMN IF NOT EXISTS campaign_id UUID,
        ADD COLUMN IF NOT EXISTS budget NUMERIC,
        ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
    `);
        console.log('  ✅ projects fixed\n');

        console.log('🔧 Fixing campaigns table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'active',
        start_date TIMESTAMPTZ,
        end_date TIMESTAMPTZ,
        budget NUMERIC,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
        console.log('  ✅ campaigns ready\n');

        console.log('🔧 Fixing departments table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        head_user_id UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
        console.log('  ✅ departments ready\n');

        console.log('🎉 All fixes applied!');

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

main();