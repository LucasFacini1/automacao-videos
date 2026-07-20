/**
 * Cria uma conta + persona para um usuário existente, com a persona correta
 * (no closet). Valida o mesmo caminho de escrita do wizard (criarConta) e deixa
 * as telas com dados reais pra revisar.
 *
 *   npm run semear:conta -- seu@email.com
 *
 * Idempotente por handle: se a conta já existe pro usuário, não duplica.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { BUCKET } from "../src/lib/storage";

const email = process.argv[2];
if (!email) {
  console.error("uso: npm run semear:conta -- seu@email.com");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

const HANDLE = "gabi.modafacil";

async function main() {
  const { data: lista } = await db.auth.admin.listUsers();
  const user = lista?.users.find((u) => u.email === email);
  if (!user) throw new Error(`Usuário ${email} não existe. Rode criar:usuario antes.`);

  const { data: jaTem } = await db
    .from("conta")
    .select("id")
    .eq("user_id", user.id)
    .eq("handle", HANDLE)
    .maybeSingle();
  if (jaTem) {
    console.log(`conta @${HANDLE} já existe pra ${email} — nada a fazer.`);
    return;
  }

  const { data: conta, error: eC } = await db
    .from("conta")
    .insert({ user_id: user.id, handle: HANDLE, nome: "Moda Fácil" })
    .select("id")
    .single();
  if (eC) throw new Error(`conta: ${eC.message}`);

  const refPath = `contas/${conta.id}/persona/referencia.png`;
  const { error: eUp } = await db.storage
    .from(BUCKET)
    .upload(refPath, readFileSync("img/persona.png"), { contentType: "image/png", upsert: true });
  if (eUp) throw new Error(`upload: ${eUp.message}`);

  const { error: eP } = await db.from("persona").insert({
    conta_id: conta.id,
    ref_image_url: refPath,
    cenario: "modern walk-in closet",
    cabelo: "Liso, castanho claro, comprido",
    make: "Natural, leve",
    unhas: "Rosa",
  });
  if (eP) throw new Error(`persona: ${eP.message}`);

  console.log(`conta @${HANDLE} criada pra ${email} (conta ${conta.id})`);
}

main().catch((e) => {
  console.error(`\nfalhou: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
