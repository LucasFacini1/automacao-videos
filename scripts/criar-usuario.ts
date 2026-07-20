/**
 * Cria (ou reseta a senha de) um usuário no Supabase, pra poder logar já.
 *
 *   npm run criar:usuario -- seu@email.com suaSenha123
 *
 * Usa service_role (admin), marca o email como confirmado — então dá pra logar
 * na hora, sem depender do provedor de email estar configurado.
 *
 * A senha é só pra desenvolvimento/uso imediato. Em produção, a tia entra por
 * link mágico (sem senha). Não guardo a senha em lugar nenhum.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
const senha = process.argv[3];

if (!email || !senha) {
  console.error("uso: npm run criar:usuario -- seu@email.com suaSenha123");
  console.error("(senha com no mínimo 6 caracteres)");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltam as chaves do Supabase no .env.local.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  // já existe? então reseta a senha em vez de duplicar
  const { data: lista } = await db.auth.admin.listUsers();
  const existente = lista?.users.find((u) => u.email === email);

  if (existente) {
    const { error } = await db.auth.admin.updateUserById(existente.id, {
      password: senha,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    console.log(`usuário já existia — senha atualizada.`);
    console.log(`  ${email}`);
    console.log(`\nagora é só entrar em /login com esse email e senha.`);
    return;
  }

  const { data, error } = await db.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (error) throw new Error(error.message);

  console.log(`usuário criado: ${email} (${data.user.id})`);
  console.log(`\nagora é só entrar em /login com esse email e senha.`);
}

main().catch((e) => {
  console.error(`\nfalhou: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
