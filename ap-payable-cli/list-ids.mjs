import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase
    .from('accounts_payable')
    .select('id, amount')
    .limit(5);

  if (error) { console.error('Erro:', error.message); process.exitCode = 1; return; }
  if (!data?.length) { console.log('Tabela vazia.'); return; }
  console.table(data);
}
main();
