const { Client } = require('pg');

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  throw new Error('Missing SUPABASE_DB_URL. Defina no ambiente antes de rodar este script.');
}

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false },
});

async function addDateColumn() {
  try {
    await client.connect();
    console.log('✓ Conectado ao banco de dados');

    // Adicionar coluna 'date' se não existir
    const addColumnSQL = `
      ALTER TABLE public.transactions
      ADD COLUMN IF NOT EXISTS date text;
    `;
    
    await client.query(addColumnSQL);
    console.log('✓ Coluna date adicionada com sucesso!');
    
    // Adicionar coluna 'type' se não existir
    const addTypeSQL = `
      ALTER TABLE public.transactions
      ADD COLUMN IF NOT EXISTS type text DEFAULT 'expense';
    `;
    
    await client.query(addTypeSQL);
    console.log('✓ Coluna type adicionada com sucesso!');

    // Adicionar coluna 'payment_method' se não existir
    const addPaymentMethodSQL = `
      ALTER TABLE public.transactions
      ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'cash';
    `;
    
    await client.query(addPaymentMethodSQL);
    console.log('✓ Coluna payment_method adicionada com sucesso!');

    process.exit(0);
  } catch (err) {
    console.error('✗ Erro:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

addDateColumn();
