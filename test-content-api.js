require('dotenv').config();
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

async function test() {
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected\n');

        // Check content_requests table structure
        console.log('📋 content_requests columns:');
        const crCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'content_requests' 
      ORDER BY ordinal_position
    `);
        crCols.rows.forEach(r => console.log(`  ✓ ${r.column_name} (${r.data_type})`));

        console.log('\n📋 artifacts columns:');
        const artCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'artifacts' 
      ORDER BY ordinal_position
    `);
        artCols.rows.forEach(r => console.log(`  ✓ ${r.column_name} (${r.data_type})`));

        console.log('\n📋 agent_executions columns:');
        const aeCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'agent_executions' 
      ORDER BY ordinal_position
    `);
        aeCols.rows.forEach(r => console.log(`  ✓ ${r.column_name} (${r.data_type})`));

        // Count records
        console.log('\n📊 Data counts:');
        const users = await client.query('SELECT COUNT(*) FROM users');
        const orgs = await client.query('SELECT COUNT(*) FROM organizations');
        const requests = await client.query('SELECT COUNT(*) FROM content_requests');
        const artifacts = await client.query('SELECT COUNT(*) FROM artifacts');

        console.log(`  Users: ${users.rows[0].count}`);
        console.log(`  Orgs: ${orgs.rows[0].count}`);
        console.log(`  Content Requests: ${requests.rows[0].count}`);
        console.log(`  Artifacts: ${artifacts.rows[0].count}`);

        // Sample data
        if (requests.rows[0].count > 0) {
            console.log('\n📄 Latest content request:');
            const latest = await client.query(`
        SELECT id, topic, status, organization_id, created_at 
        FROM content_requests 
        ORDER BY created_at DESC 
        LIMIT 1
      `);
            console.log(latest.rows[0]);
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

test();