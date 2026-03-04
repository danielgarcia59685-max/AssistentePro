import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const { data, error } = await s.from("users").select("id").eq("id", process.env.USER_ID).maybeSingle();
if (error) { console.error("ERRO AO VERIFICAR USERS:", JSON.stringify(error, null, 2)); process.exit(1); }
console.log(data ? "USER_ID_ENCONTRADO:" : "USER_ID_NAO_ENCONTRADO:", process.env.USER_ID);
