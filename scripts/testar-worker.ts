/**
 * Teste de ponta a ponta do worker, até a imagem base.
 *
 *   npm run testar:worker
 *
 * Semeia conta + persona + produto no banco REAL, sobe as imagens no storage
 * REAL, e chama o handler `gerarImagem` de worker/handlers.ts — o mesmo código
 * que roda em produção. Valida o join, o storage e o Gemini de uma vez.
 *
 * NÃO usa Claude — respeita quem está sem créditos na Anthropic. Custa ~R$0,72
 * (a imagem). Limpa tudo que criou no fim (--manter pra inspecionar).
 *
 * Precisa de: Supabase (url + service_role) e GOOGLE_API_KEY.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { gerarImagem } from "../worker/handlers";
import { BUCKET } from "../src/lib/storage";

const manter = process.argv.includes("--manter");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltam as chaves do Supabase no .env.local.");
  process.exit(1);
}
if (!process.env.GOOGLE_API_KEY) {
  console.error("Falta GOOGLE_API_KEY no .env.local.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const criado: { userId?: string; contaId?: string } = {};

async function limpar() {
  if (criado.contaId) {
    // cascata do schema derruba persona/produto/imagem_base/video/analise
    await db.from("conta").delete().eq("id", criado.contaId);
    await db.storage.from(BUCKET).remove([
      `contas/${criado.contaId}/persona/referencia.png`,
      `contas/${criado.contaId}/produtos/teste.png`,
    ]);
    // remove a base gerada tambem (nome dinamico)
    const { data } = await db.storage.from(BUCKET).list(`contas/${criado.contaId}/base`);
    if (data?.length) {
      await db.storage.from(BUCKET).remove(data.map((f) => `contas/${criado.contaId}/base/${f.name}`));
    }
  }
  if (criado.userId) await db.auth.admin.deleteUser(criado.userId);
}

async function main() {
  console.log("== semeando ==");

  // 1. usuario (FK de conta -> auth.users)
  const { data: u, error: eU } = await db.auth.admin.createUser({
    email: `teste-${Date.now()}@exemplo.local`,
    email_confirm: true,
  });
  if (eU || !u.user) throw new Error(`criar user: ${eU?.message}`);
  criado.userId = u.user.id;
  console.log(`  user ${u.user.id}`);

  // 2. conta
  const { data: c, error: eC } = await db
    .from("conta")
    .insert({ user_id: u.user.id, handle: "teste.worker", nome: "Teste Worker" })
    .select("id")
    .single();
  if (eC || !c) throw new Error(`criar conta: ${eC?.message}`);
  criado.contaId = c.id;
  console.log(`  conta ${c.id}`);

  // 3. sobe a referencia da persona + a foto do produto
  const refPath = `contas/${c.id}/persona/referencia.png`;
  const prodPath = `contas/${c.id}/produtos/teste.png`;

  await db.storage.from(BUCKET).upload(refPath, readFileSync("img/persona.png"), {
    contentType: "image/png",
    upsert: true,
  });
  await db.storage.from(BUCKET).upload(prodPath, readFileSync("img/imagem produto 3.png"), {
    contentType: "image/png",
    upsert: true,
  });
  console.log("  imagens no storage");

  // 4. persona (congelada) + produto + imagem_base + job
  await db.from("persona").insert({
    conta_id: c.id,
    ref_image_url: refPath,
    cenario: "modern walk-in closet",
    cabelo: "long, straight, light brown",
    make: "natural, soft",
    unhas: "light",
  });

  const { data: prod } = await db
    .from("produto")
    .insert({ conta_id: c.id, nome: "Body recorte + saia couro", image_url: prodPath })
    .select("id")
    .single();

  const { data: ib } = await db
    .from("imagem_base")
    .insert({ produto_id: prod!.id, status: "gerando" })
    .select("id")
    .single();

  console.log(`  imagem_base ${ib!.id}\n`);

  // 5. chama o HANDLER REAL — o mesmo que o worker roda
  console.log("== rodando o handler gerarImagem (o codigo de producao) ==");
  console.log("   gerando... (~R$0,72)");
  const t0 = Date.now();
  await gerarImagem(db, { id: "teste", tipo: "gerar_imagem", ref_id: ib!.id, tentativas: 1 });
  console.log(`   ok em ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

  // 6. verifica o que o handler gravou
  console.log("== conferindo o que ficou no banco ==");
  const { data: depois } = await db
    .from("imagem_base")
    .select("status, image_url, erro")
    .eq("id", ib!.id)
    .single();

  console.log(`  status:    ${depois!.status}  ${depois!.status === "pronta" ? "✓" : "✗ (esperado 'pronta')"}`);
  console.log(`  image_url: ${depois!.image_url ?? "(vazio ✗)"}`);
  if (depois!.erro) console.log(`  erro:      ${depois!.erro}`);

  // 7. baixa pra inspecionar
  if (depois!.image_url) {
    const { data: blob } = await db.storage.from(BUCKET).download(depois!.image_url);
    if (blob) {
      mkdirSync("out", { recursive: true });
      writeFileSync("out/worker-base.png", Buffer.from(await blob.arrayBuffer()));
      console.log(`\n  baixada -> out/worker-base.png (compare com img/imagem base 3.png)`);
    }
  }

  const ok = depois!.status === "pronta" && depois!.image_url;
  console.log(`\n== ${ok ? "PASSOU — o pipeline do worker funciona no banco real" : "FALHOU — ver acima"} ==`);
}

main()
  .catch((e) => {
    console.error(`\nfalhou: ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (manter) {
      console.log("\n(--manter: dados de teste deixados no banco)");
    } else {
      await limpar();
      console.log("(limpou os dados de teste)");
    }
  });
