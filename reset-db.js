// reset-db.js
require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in .env file!');
    console.error('Please add DATABASE_URL to .env file');
    process.exit(1);
}

const migrations = [
    '001_initial_schema.sql',
    '002_workspace_hierarchy.sql',
    '003_feature_upgrade.sql',
    '004_auth_fixes.sql'
];

async function resetAndMigrate() {
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🔌 Connecting to Railway PostgreSQL...');
        await client.connect();
        console.log('✅ Connected successfully!\n');

        // STEP 1: Nuclear clean - drop everything
        console.log('🧹 Cleaning database (dropping all objects)...');
        await client.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;
    `);
        console.log('✅ Database cleaned!\n');

        // STEP 2: Enable extensions
        console.log('🔧 Enabling PostgreSQL extensions...');
        await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    `);
        console.log('✅ Extensions enabled!\n');

        // STEP 3: Run migrations in order
        let successCount = 0;
        let failCount = 0;

        for (const migration of migrations) {
            const filePath = path.join(__dirname, 'migrations', migration);

            if (!fs.existsSync(filePath)) {
                console.log(`⚠️  Skipping ${migration} (file not found)\n`);
                continue;
            }

            console.log(`🚀 Running: ${migration}`);
            const sql = fs.readFileSync(filePath, 'utf8');

            try {
                await client.query(sql);
                console.log(`✅ Success: ${migration}\n`);
                successCount++;
            } catch (err) {
                console.error(`❌ FATAL Error in ${migration}:`);
                console.error(`   ${err.message}\n`);
                console.error(`   Position: ${err.position || 'N/A'}`);
                console.error(`   Hint: ${err.hint || 'N/A'}\n`);
                failCount++;
                console.log('🛑 Stopping migrations. Fix the error and try again.\n');
                break;
            }
        }

        // STEP 4: Verify tables
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        const tables = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `);

        console.log(`\n📊 Tables Created (${tables.rows.length}):`);
        tables.rows.forEach(row => console.log(`  ✓ ${row.tablename}`));

        // Verify functions
        const functions = await client.query(`
      SELECT routine_name FROM information_schema.routines 
      WHERE routine_schema = 'public';
    `);

        console.log(`\n⚙️  Functions Created (${functions.rows.length}):`);
        functions.rows.forEach(row => console.log(`  ✓ ${row.routine_name}`));

        // Verify triggers
        const triggers = await client.query(`
      SELECT trigger_name, event_object_table 
      FROM information_schema.triggers 
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table;
    `);

        console.log(`\n🔔 Triggers Created (${triggers.rows.length}):`);
        triggers.rows.forEach(row =>
            console.log(`  ✓ ${row.trigger_name} (${row.event_object_table})`)
        );

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✅ Success: ${successCount} migrations`);
        if (failCount > 0) {
            console.log(`❌ Failed: ${failCount} migrations`);
        }
        console.log('🎉 Migration process complete!\n');

    } catch (err) {
        console.error('💥 Fatal Error:', err.message);
    } finally {
        await client.end();
    }
}

// Confirmation
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('⚠️  WARNING: This will DELETE ALL data!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('⏳ Starting in 3 seconds... Press Ctrl+C to cancel\n');

setTimeout(resetAndMigrate, 3000);