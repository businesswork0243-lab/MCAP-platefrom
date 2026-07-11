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

        // Recent requests
        console.log('📋 Recent Content Requests:');
        const requests = await client.query(`
      SELECT id, topic, status, error_message, created_at, updated_at
      FROM content_requests
      ORDER BY created_at DESC
      LIMIT 5;
    `);
        console.table(requests.rows);

        // Latest request ke artifacts
        if (requests.rows.length > 0) {
            const latestId = requests.rows[0].id;
            console.log(`\n📦 Artifacts for latest request (${latestId}):`);
            const artifacts = await client.query(`
        SELECT id, platform, content_type, status, 
               LENGTH(body) as body_length,
               created_at
        FROM artifacts
        WHERE request_id = $1
        ORDER BY created_at;
      `, [latestId]);
            console.table(artifacts.rows);

            // Agent executions
            console.log(`\n🤖 Agent Executions:`);
            const agents = await client.query(`
        SELECT agent_name, status, tokens_used, duration_ms, 
               error_message, created_at
        FROM agent_executions
        WHERE COALESCE(request_id, content_request_id) = $1
        ORDER BY created_at;
      `, [latestId]);
            console.table(agents.rows);
        }

        // Projects table check
        console.log('\n📊 Projects table columns:');
        const cols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'projects'
      ORDER BY ordinal_position;
    `);
        console.table(cols.rows);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

main();