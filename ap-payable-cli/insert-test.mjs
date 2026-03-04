import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function main() {
  const payload = {
    user_id: process.env.USER_ID,
    supplier_name: "Fornecedor Teste",
    amount: 123.45,
    due_date: new Date().toISOString().slice(0,10) // YYYY-MM-DD
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
