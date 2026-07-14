// run-migrations.js
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Railway se DATABASE_PUBLIC_URL copy karo aur yaha paste karo
const DATABASE_URL = "postgresql://postgres:QyYOgjXvKFxoUOwkQrOUqkwmFkdrhref@switchback.proxy.rlwy.net:49835/railway";

const migrations = [
    '001_initial_schema.sql',
    '002_workspace_hierarchy.sql',
    '003_feature_upgrade.sql',
    '004_auth_fixes.sql'
];

async function runMigrations() {
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🔌 Connecting to Railway PostgreSQL...');
        await client.connect();
        console.log('✅ Connected successfully!\n');

        for (const migration of migrations) {
            const filePath = path.join(__dirname, 'migrations', migration);

            if (!fs.existsSync(filePath)) {
                console.log(`⚠️  Skipping ${migration} (file not found)`);
                continue;
            }

            console.log(`🚀 Running: ${migration}`);
            const sql = fs.readFileSync(filePath, 'utf8');

            try {
                await client.query(sql);
                console.log(`✅ Success: ${migration}\n`);
            } catch (err) {
                console.error(`❌ Error in ${migration}:`, err.message);
                console.log('⏭️  Continuing with next migration...\n');
            }
        }

        console.log('🎉 All migrations completed!');
    } catch (err) {
        console.error('💥 Connection Error:', err.message);
    } finally {
        await client.end();
    }
}

runMigrations();