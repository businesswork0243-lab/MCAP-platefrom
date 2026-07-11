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

        // Artifacts columns
        console.log('📊 artifacts table columns:');
        const cols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'artifacts'
      ORDER BY ordinal_position;
    `);
        console.table(cols.rows);

        // Sample data
        console.log('\n📋 Sample artifacts:');
        const sample = await client.query(`
      SELECT * FROM artifacts LIMIT 2;
    `);
        console.log(JSON.stringify(sample.rows, null, 2));

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

main();