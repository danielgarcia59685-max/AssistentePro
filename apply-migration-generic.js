const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  throw new Error('Missing SUPABASE_DB_URL. Defina no ambiente antes de rodar este script.');
}

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false },
});

async function applyMigration(migrationFile) {
  try {
    await client.connect();
    console.log(`✓ Conectado ao banco de dados`);

    const sqlFilePath = path.join(__dirname, migrationFile);
    const sql = fs.readFileSync(sqlFilePath, 'utf-8');
    
    await client.query(sql);
    console.log(`✓ Migration ${migrationFile} aplicada com sucesso!`);
    process.exit(0);
  } catch (err) {
    console.error(`✗ Erro:`, err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

const migrationFile = process.argv[2] || 'supabase/migrations/002_create_financial_schema.sql';
applyMigration(migrationFile);
