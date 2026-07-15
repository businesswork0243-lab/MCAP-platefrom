require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');

async function runMigration() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🔌 Connecting...');
        await client.connect();
        console.log('✅ Connected\n');

        const sql = fs.readFileSync('./migrations/005_fix_missing_columns.sql', 'utf8');

        console.log('🚀 Running migration 005...');
        await client.query(sql);
        console.log('✅ Migration 005 complete!\n');

        // Verify changes
        console.log('📋 Verifying artifacts columns:');
        const cols = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'artifacts' 
      AND column_name IN ('content_request_id', 'agent_type', 'content', 'metadata')
      ORDER BY column_name
    `);
        cols.rows.forEach(r => console.log(`  ✓ ${r.column_name}`));

        console.log('\n📋 Verifying content_requests columns:');
        const cols2 = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'content_requests' 
      AND column_name IN ('total_tokens_used', 'completed_at', 'processing_started_at')
      ORDER BY column_name
    `);
        cols2.rows.forEach(r => console.log(`  ✓ ${r.column_name}`));

        console.log('\n🎉 Database ready!');

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

runMigration();