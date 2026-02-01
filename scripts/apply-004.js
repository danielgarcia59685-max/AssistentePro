const { Client } = require('pg');
const fs = require('fs');

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  throw new Error('Missing SUPABASE_DB_URL. Defina no ambiente antes de rodar este script.');
}
const sqlFile = 'supabase/migrations/004_add_recurrence_to_accounts.sql';

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

(async () => {
  try {
    await client.connect();
    console.log('✓ Conectado ao banco de dados');
    const sql = fs.readFileSync(sqlFile, 'utf-8');
    await client.query(sql);
    console.log('✓ Migration 004 aplicada com sucesso!');
  } catch (err) {
    console.error('✗ Erro ao aplicar migration 004:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
