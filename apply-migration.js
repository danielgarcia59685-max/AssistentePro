const { Client } = require('pg');
const fs = require('fs');

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  throw new Error('Missing SUPABASE_DB_URL. Defina no ambiente antes de rodar este script.');
}
const sqlFile = 'supabase/migrations/001_create_transactions.sql';

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }, // Required for Supabase
});

async function applyMigration() {
  try {
    await client.connect();
    console.log('✓ Conectado ao banco de dados');

    const sql = fs.readFileSync(sqlFile, 'utf-8');
    await client.query(sql);
    console.log('✓ Migration aplicada com sucesso!');
  } catch (err) {
    console.error('✗ Erro ao aplicar migration:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
