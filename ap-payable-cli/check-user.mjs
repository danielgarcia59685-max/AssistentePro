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

const { data, error } = await supabase
  .from("users")
  .select("id")
  .eq("id", userId)
  .maybeSingle();

if (error) {
  console.error("ERRO AO VERIFICAR USERS:", JSON.stringify(error, null, 2));
  process.exit(1);
}

console.log(data ? "USER_ID_ENCONTRADO:" : "USER_ID_NAO_ENCONTRADO:", userId);
