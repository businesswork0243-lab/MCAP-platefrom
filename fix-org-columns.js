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

        // ─── Show current columns ────────────────────────────────
        console.log('📊 Current organizations columns:');
        const before = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'organizations'
      ORDER BY ordinal_position;
    `);
        console.table(before.rows);

        // ─── Add ALL missing columns ─────────────────────────────
        console.log('\n🔧 Adding missing columns to organizations...');
        await client.query(`
      ALTER TABLE organizations
        ADD COLUMN IF NOT EXISTS plan             VARCHAR(50) DEFAULT 'free',
        ADD COLUMN IF NOT EXISTS industry         VARCHAR(100),
        ADD COLUMN IF NOT EXISTS team_size        VARCHAR(50),
        ADD COLUMN IF NOT EXISTS logo_url         TEXT,
        ADD COLUMN IF NOT EXISTS default_language VARCHAR(10) DEFAULT 'en',
        ADD COLUMN IF NOT EXISTS timezone         VARCHAR(100) DEFAULT 'UTC',
        ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW();
    `);
        console.log('  ✅ organizations columns added\n');

        // ─── Also fix users table (just to be safe) ──────────────
        console.log('🔧 Verifying users columns...');
        await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS password_hash             TEXT,
        ADD COLUMN IF NOT EXISTS refresh_token             TEXT,
        ADD COLUMN IF NOT EXISTS refresh_token_expires_at  TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS last_login_at             TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS password_reset_token      VARCHAR(255),
        ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS status                    VARCHAR(50) DEFAULT 'active';
    `);
        console.log('  ✅ users columns verified\n');

        // ─── Show final columns ──────────────────────────────────
        console.log('📊 Final organizations columns:');
        const after = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'organizations'
      ORDER BY ordinal_position;
    `);
        console.table(after.rows);

        // ─── Test insert ────────────────────────────────────────
        console.log('\n🧪 Testing registration insert...');
        await client.query('BEGIN');
        try {
            const testId = '00000000-0000-0000-0000-' + Date.now().toString().padStart(12, '0');

            await client.query(
                `INSERT INTO organizations (id, name, plan) VALUES ($1, $2, 'free')`,
                [testId, 'Test Registration Org']
            );

            console.log('  ✅ INSERT with "plan" column WORKS!');
            await client.query('ROLLBACK');
            console.log('  ✅ Test cleaned up (rolled back)');
        } catch (testErr) {
            await client.query('ROLLBACK');
            console.error('  ❌ Test still failing:', testErr.message);
            throw testErr;
        }

        console.log('\n' + '='.repeat(60));
        console.log('🎉 FIXED! Registration will work now.');
        console.log('='.repeat(60));
        console.log('\n👉 Try registering again from frontend');

    } catch (err) {
        console.error('\n❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

main();