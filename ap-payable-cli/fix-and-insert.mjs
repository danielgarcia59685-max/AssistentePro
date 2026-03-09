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

const up = await supabase.from("users").upsert({ id: userId }).select("id").single();

if (up.error) {
  console.error("ERRO_UPSERT_USERS:", JSON.stringify(up.error, null, 2));
  process.exit(1);
}

console.log("USER OK:", up.data.id);

const payload = {
  user_id: userId,
  supplier_name: "Fornecedor Teste",
  amount: 123.45,
  due_date: new Date().toISOString().slice(0, 10),
};

const ins = await supabase
  .from("accounts_payable")
  .insert(payload)
  .select("id, user_id, supplier_name, amount, due_date")
  .single();

if (ins.error) {
  console.error("ERRO_INSERIR_AP:", JSON.stringify(ins.error, null, 2));
  process.exit(1);
}

console.log("INSERIDO:", ins.data);
