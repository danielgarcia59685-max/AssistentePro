import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const id = process.env.USER_ID;
if (!id) { console.error("USER_ID ausente no .env"); process.exit(1); }

// 1) Garante que existe uma linha em public.users com esse id
const up = await s.from("users").upsert({ id }).select("id").single();
if (up.error) { console.error("ERRO_UPSERT_USERS:", JSON.stringify(up.error, null, 2)); process.exit(1); }
console.log("USER OK:", up.data.id);

// 2) Insere em accounts_payable
const payload = {
  user_id: id,
  supplier_name: "Fornecedor Teste",
  amount: 123.45,
  due_date: new Date().toISOString().slice(0,10) // YYYY-MM-DD
};

const ins = await s
  .from("accounts_payable")
  .insert(payload)
  .select("id, user_id, supplier_name, amount, due_date")
  .single();

if (ins.error) { console.error("ERRO_INSERIR_AP:", JSON.stringify(ins.error, null, 2)); process.exit(1); }
console.log("INSERIDO:", ins.data);
