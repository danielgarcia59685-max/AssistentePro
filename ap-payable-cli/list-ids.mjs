import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url) {
  console.error("FALTA SUPABASE_URL");
  process.exit(1);
}

if (!anonKey) {
  console.error("FALTA SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, anonKey);

async function main() {
  const { data, error } = await supabase
    .from("accounts_payable")
    .select("id, amount")
    .limit(5);

  if (error) {
    console.error("Erro:", error.message);
    process.exitCode = 1;
    return;
  }

  if (!data?.length) {
    console.log("Tabela vazia.");
    return;
  }

  console.table(data);
}

main();

