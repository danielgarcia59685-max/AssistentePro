import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE;
const userId = process.env.USER_ID;

if (!service) { console.error("FALTA SUPABASE_SERVICE_ROLE"); process.exit(1); }
if (!userId) { console.error("FALTA USER_ID"); process.exit(1); }

const admin = createClient(url, service, { auth: { persistSession: false } });

const email = `daniel+${userId.slice(0,8)}@example.local`;

// 1) Upsert no users SEM 'active'
const up = await admin
  .from("users")
  .upsert({ id: userId, name: "Daniel", email }, { onConflict: "id" })
  .select("id, name, email")
  .single();

if (up.error) { console.error("ERRO_UPSERT_USERS:", JSON.stringify(up.error, null, 2)); process.exit(1); }
console.log("USER OK:", up.data);

// 2) Insere em accounts_payable usando SERVICE ROLE (evita RLS neste teste)
const payload = {
  user_id: userId,
  supplier_name: "Fornecedor Teste",
  amount: 123.45,
  due_date: new Date().toISOString().slice(0,10) // YYYY-MM-DD
};

const ins = await admin
  .from("accounts_payable")
  .insert(payload)
  .select("id, user_id, supplier_name, amount, due_date")
  .single();

if (ins.error) { console.error("ERRO_INSERIR_AP:", JSON.stringify(ins.error, null, 2)); process.exit(1); }
console.log("INSERIDO:", ins.data);
