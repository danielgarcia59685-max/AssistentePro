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
  const id = process.argv[2];

  if (!id) {
    console.log("Uso: node get-by-id.mjs <id>");
    process.exitCode = 1;
    return;
  }

  const { data, error } = await supabase
    .from("accounts_payable")
    .select("id, amount")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Erro:", error.message);
    process.exitCode = 1;
    return;
  }

  if (!data) {
    console.log("Nada encontrado para id", id);
    return;
  }

  console.log("Registro:", data);
}

main();
