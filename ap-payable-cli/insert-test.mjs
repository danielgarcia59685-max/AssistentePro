import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const userId = process.env.USER_ID;

if (!url) {
  console.error("FALTA SUPABASE_URL");
  process.exit(1);
}

if (!anonKey) {
  console.error("FALTA SUPABASE_ANON_KEY");
  process.exit(1);
}

if (!userId) {
  console.error("FALTA USER_ID");
  process.exit(1);
}

const supabase = createClient(url, anonKey);

async function main() {
  const payload = {
    user_id: userId,
    supplier_name: "Fornecedor Teste",
    amount: 123.45,
    due_date: new Date().toISOString().slice(0, 10),
  };

  const { data, error } = await supabase
    .from("accounts_payable")
    .insert(payload)
    .select("id, user_id, supplier_name, amount, due_date")
    .single();

  if (error) {
    console.error("Erro ao inserir:", JSON.stringify(error, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log("Inserido:", data);
}

main();
