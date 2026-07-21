/**
 * Exercita o pipeline REAL de ponta a ponta, com o worker rodando.
 *
 *   (terminal 1)  npm run worker
 *   (terminal 2)  npm run testar:pipeline
 *
 * Faz o que o usuário faria (enviar produto, aprovar a foto, pedir 1 vídeo) e
 * deixa o WORKER de produção fazer o resto (gerar imagem, direção, vídeo).
 * Não chama os handlers direto — insere no banco e observa, igual à UI.
 *
 * Gera 1 vídeo de verdade (~R$5,40) + a imagem (~R$0,72) + a direção (centavos).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { BUCKET } from "../src/lib/storage";

const EMAIL = "lucas-facini@hotmail.com";
const PRODUTO_IMG = "img/imagem produto 3.png";
const FORMATO = "talking";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const dorme = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function esperar<T>(o: string, fn: () => Promise<T | null>, timeoutS = 480): Promise<T> {
  const limite = Date.now() + timeoutS * 1000;
  process.stdout.write(`aguardando ${o}`);
  while (Date.now() < limite) {
    const v = await fn();
    if (v) {
      process.stdout.write(" ✓\n");
      return v;
    }
    process.stdout.write(".");
    await dorme(4000);
  }
  throw new Error(`timeout esperando ${o}`);
}

async function main() {
  const { data: lista } = await db.auth.admin.listUsers();
  const user = lista.users.find((u) => u.email === EMAIL);
  if (!user) throw new Error(`sem usuário ${EMAIL} — rode criar:usuario`);

  const { data: conta } = await db
    .from("conta")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!conta) throw new Error("sem conta — rode semear:conta");
  console.log(`conta ${conta.id}\n`);

  // 1. usuário envia o produto (o que criarProduto faz)
  const { data: produto } = await db
    .from("produto")
    .insert({ conta_id: conta.id, nome: "TESTE pipeline — body recorte", image_url: "" })
    .select("id")
    .single();
  const prodPath = `contas/${conta.id}/produtos/${produto!.id}.png`;
  await db.storage.from(BUCKET).upload(prodPath, readFileSync(PRODUTO_IMG), { contentType: "image/png", upsert: true });
  await db.from("produto").update({ image_url: prodPath }).eq("id", produto!.id);
  const { data: ib } = await db
    .from("imagem_base")
    .insert({ produto_id: produto!.id, status: "gerando" })
    .select("id")
    .single();
  await db.from("job").insert({ tipo: "gerar_imagem", ref_id: ib!.id });
  console.log(`produto enviado, imagem_base ${ib!.id}\n`);

  // 2. worker gera a imagem base
  await esperar("a foto (worker gerar_imagem)", async () => {
    const { data } = await db.from("imagem_base").select("status, erro").eq("id", ib!.id).single();
    if (data?.status === "erro") throw new Error(`imagem falhou: ${data.erro}`);
    return data?.status === "pronta" ? data : null;
  });

  // 3. usuário aprova (o que aprovarImagem faz)
  await db.from("imagem_base").update({ status: "aprovada" }).eq("id", ib!.id);
  await db.from("job").insert({ tipo: "analisar", ref_id: ib!.id });
  console.log("foto aprovada\n");

  // 4. worker escreve a direção
  await esperar("a direção (worker analisar)", async () => {
    const { data } = await db.from("analise").select("id").eq("imagem_base_id", ib!.id).maybeSingle();
    return data ?? null;
  });

  // 5. usuário pede 1 vídeo (o que pedirVideos faz)
  const { data: video } = await db
    .from("video")
    .insert({ imagem_base_id: ib!.id, formato_key: FORMATO })
    .select("id")
    .single();
  await db.from("job").insert({ tipo: "gerar_video", ref_id: video!.id });
  console.log(`1 vídeo pedido (${FORMATO}), video ${video!.id}`);
  console.log("(este é o passo caro — geração leva minutos)\n");

  // 6. worker gera o vídeo
  const pronto = await esperar(
    "o vídeo (worker gerar_video)",
    async () => {
      const { data } = await db.from("video").select("status, video_url, erro").eq("id", video!.id).single();
      if (data?.status === "erro") throw new Error(`vídeo falhou: ${data.erro}`);
      return data?.status === "pronto" ? data : null;
    },
    900,
  );

  console.log("\n" + "=".repeat(60));
  console.log("PIPELINE COMPLETO ✓");
  console.log("=".repeat(60));
  console.log(`vídeo no storage: ${pronto.video_url}`);

  // baixa pra inspecionar
  const { data: blob } = await db.storage.from(BUCKET).download(pronto.video_url!);
  if (blob) {
    const { writeFileSync, mkdirSync } = await import("node:fs");
    mkdirSync("out", { recursive: true });
    const buf = Buffer.from(await blob.arrayBuffer());
    writeFileSync("out/video-real.mp4", buf);
    console.log(`baixado: out/video-real.mp4 (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
  }
  console.log(`\nabra tambem na interface: /conta/${conta.id}/produto/${ib!.id}`);
}

main().catch((e) => {
  console.error(`\nfalhou: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
