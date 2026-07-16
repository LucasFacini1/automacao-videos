"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET } from "@/lib/storage";
import { FORMATOS_POR_KEY, type FormatoKey } from "@/lib/formatos";

/**
 * Escritas. Todo caminho que muda o banco passa por aqui.
 *
 * NÃO TESTADO contra Supabase de verdade — escrito sem credencial.
 *
 * RLS está desativado (PLAN.md §3): a checagem de dono nestas funções é a
 * única coisa impedindo um usuário de mexer na conta do outro. Toda ação que
 * recebe um id de fora TEM que ancorar no user_id antes de escrever.
 */

async function exigirUsuario() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  return { db, user };
}

/** Confirma que a conta é do usuário logado. Lança se não for. */
async function exigirDonoDaConta(contaId: string) {
  const { db, user } = await exigirUsuario();
  const { data } = await db
    .from("conta")
    .select("id")
    .eq("id", contaId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) throw new Error("Conta não encontrada.");
  return { db, user };
}

// --- conta + persona ---------------------------------------------------------

export async function criarConta(form: FormData) {
  const { db, user } = await exigirUsuario();
  const admin = createAdminClient();

  const handle = String(form.get("handle") ?? "").replace(/^@/, "").trim();
  const ref = form.get("ref") as File | null;

  if (!handle) throw new Error("Informe o perfil.");
  if (!ref || ref.size === 0) throw new Error("Envie a foto da modelo.");

  const { data: conta, error: eConta } = await db
    .from("conta")
    .insert({ user_id: user.id, handle, nome: handle })
    .select("id")
    .single();

  if (eConta) throw new Error(`Não deu pra criar a conta: ${eConta.message}`);

  // A referência congela aqui (PLAN.md §3.1). Caminho fixo por conta, sem
  // timestamp: trocar a modelo sobrescreve, e nenhuma geração passa a apontar
  // pra uma imagem gerada.
  const path = `contas/${conta.id}/persona/referencia.png`;
  const { error: eUp } = await admin.storage
    .from(BUCKET)
    .upload(path, Buffer.from(await ref.arrayBuffer()), {
      contentType: ref.type || "image/png",
      upsert: true,
    });

  if (eUp) throw new Error(`Não deu pra salvar a foto: ${eUp.message}`);

  const { error: ePersona } = await db.from("persona").insert({
    conta_id: conta.id,
    ref_image_url: path,
    cenario: String(form.get("cenario") ?? "modern walk-in closet"),
    cabelo: String(form.get("cabelo") ?? ""),
    make: String(form.get("make") ?? ""),
    unhas: String(form.get("unhas") ?? "light"),
  });

  if (ePersona) throw new Error(`Não deu pra salvar a modelo: ${ePersona.message}`);

  revalidatePath("/");
  redirect("/");
}

// --- produto -> imagem base --------------------------------------------------

export async function criarProduto(form: FormData) {
  const contaId = String(form.get("contaId") ?? "");
  const { db } = await exigirDonoDaConta(contaId);
  const admin = createAdminClient();

  const foto = form.get("foto") as File | null;
  if (!foto || foto.size === 0) throw new Error("Envie a foto do produto.");

  const nome = String(form.get("nome") ?? "").trim() || "Produto sem nome";

  const { data: produto, error: eProd } = await db
    .from("produto")
    .insert({ conta_id: contaId, nome, image_url: "" })
    .select("id")
    .single();

  if (eProd) throw new Error(`Não deu pra salvar o produto: ${eProd.message}`);

  const path = `contas/${contaId}/produtos/${produto.id}.png`;
  const { error: eUp } = await admin.storage
    .from(BUCKET)
    .upload(path, Buffer.from(await foto.arrayBuffer()), {
      contentType: foto.type || "image/png",
      upsert: true,
    });

  if (eUp) throw new Error(`Não deu pra salvar a foto: ${eUp.message}`);
  await db.from("produto").update({ image_url: path }).eq("id", produto.id);

  const { data: ib, error: eIb } = await db
    .from("imagem_base")
    .insert({ produto_id: produto.id, status: "gerando" })
    .select("id")
    .single();

  if (eIb) throw new Error(`Não deu pra enfileirar: ${eIb.message}`);

  await db.from("job").insert({ tipo: "gerar_imagem", ref_id: ib.id });

  revalidatePath("/");
  return { imagemBaseId: ib.id };
}

/** Refazer: nova imagem_base pro mesmo produto. A anterior fica no histórico. */
export async function refazerImagem(imagemBaseId: string) {
  const { db } = await exigirUsuario();

  const { data: anterior } = await db
    .from("imagem_base")
    .select("produto_id")
    .eq("id", imagemBaseId)
    .maybeSingle();

  if (!anterior) throw new Error("Imagem não encontrada.");

  await db.from("imagem_base").update({ status: "rejeitada" }).eq("id", imagemBaseId);

  const { data: nova, error } = await db
    .from("imagem_base")
    .insert({ produto_id: anterior.produto_id, status: "gerando" })
    .select("id")
    .single();

  if (error) throw new Error(`Não deu pra refazer: ${error.message}`);

  await db.from("job").insert({ tipo: "gerar_imagem", ref_id: nova.id });

  revalidatePath("/");
  return { imagemBaseId: nova.id };
}

// --- aprovação ---------------------------------------------------------------

/**
 * Aprova e já enfileira a análise.
 *
 * A análise roda ENQUANTO ela escolhe os formatos, então quando os jobs de
 * vídeo entrarem na fila a direção já existe. Isso funciona porque a fila é
 * FIFO por created_at e o `analisar` entra antes: com UM worker, a ordem é
 * garantida. Se um dia rodar mais de um worker em paralelo, `gerar_video`
 * pode achar a análise ausente — nesse caso ele erra e retenta, mas o certo
 * seria uma dependência explícita entre jobs.
 */
export async function aprovarImagem(imagemBaseId: string) {
  const { db } = await exigirUsuario();

  const { error } = await db
    .from("imagem_base")
    .update({ status: "aprovada" })
    .eq("id", imagemBaseId);

  if (error) throw new Error(`Não deu pra aprovar: ${error.message}`);

  await db.from("job").insert({ tipo: "analisar", ref_id: imagemBaseId });

  revalidatePath("/");
}

// --- vídeos ------------------------------------------------------------------

export async function pedirVideos(imagemBaseId: string, quantidades: Record<string, number>) {
  const { db } = await exigirUsuario();

  const linhas: { imagem_base_id: string; formato_key: string }[] = [];

  for (const [key, n] of Object.entries(quantidades)) {
    if (!FORMATOS_POR_KEY[key as FormatoKey]) throw new Error(`Formato inválido: ${key}`);
    // Teto por pedido: sem isso, um clique errado vira R$100 de vídeo.
    const qtd = Math.max(0, Math.min(5, Math.trunc(n)));
    for (let i = 0; i < qtd; i++) linhas.push({ imagem_base_id: imagemBaseId, formato_key: key });
  }

  if (linhas.length === 0) throw new Error("Escolha pelo menos um vídeo.");

  const { data: videos, error } = await db.from("video").insert(linhas).select("id");
  if (error) throw new Error(`Não deu pra pedir os vídeos: ${error.message}`);

  await db.from("job").insert(videos.map((v) => ({ tipo: "gerar_video", ref_id: v.id })));

  revalidatePath("/");
  return { quantos: videos.length };
}
