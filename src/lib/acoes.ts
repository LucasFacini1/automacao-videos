"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { usuarioLogado } from "@/lib/sessao";
import { BUCKET } from "@/lib/storage";
import { FORMATOS_POR_KEY, type FormatoKey } from "@/lib/formatos";

/**
 * Escritas. Todo caminho que muda o banco passa por aqui.
 *
 * Usa o cliente admin (service_role) no servidor — ignora RLS. A checagem de
 * dono (user_id) nestas funções é a única coisa impedindo um usuário de mexer
 * na conta do outro. Toda ação que recebe um id de fora ancora no user_id.
 */

async function exigirUsuario() {
  const user = await usuarioLogado();
  if (!user) redirect("/login");
  return { db: createAdminClient(), user };
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
  // timestamp: nenhuma geração passa a apontar pra uma imagem gerada.
  const path = `contas/${conta.id}/persona/referencia.png`;
  const { error: eUp } = await db.storage
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
  redirect(`/conta/${conta.id}`);
}

/**
 * Exclui a conta inteira: persona, produtos, imagens, vídeos e os arquivos no
 * storage. Irreversível — a UI pede confirmação digitando o @ da conta.
 */
export async function excluirConta(contaId: string) {
  const { db } = await exigirDonoDaConta(contaId);

  // storage não tem cascade: limpa a pasta da conta antes de apagar a linha
  for (const pasta of ["persona", "produtos", "base", "videos"]) {
    const { data } = await db.storage.from(BUCKET).list(`contas/${contaId}/${pasta}`);
    if (data?.length) {
      await db.storage
        .from(BUCKET)
        .remove(data.map((f) => `contas/${contaId}/${pasta}/${f.name}`));
    }
  }

  // o resto cai por ON DELETE CASCADE (ver schema)
  const { error } = await db.from("conta").delete().eq("id", contaId);
  if (error) throw new Error(`Não deu pra excluir a conta: ${error.message}`);

  revalidatePath("/");
  redirect("/");
}

/** Exclui um produto e tudo que veio dele. */
export async function excluirProduto(produtoId: string) {
  const { db, user } = await exigirUsuario();

  const { data: prod } = await db
    .from("produto")
    .select("id, conta_id, conta:conta_id(user_id)")
    .eq("id", produtoId)
    .maybeSingle();

  if (!prod) throw new Error("Produto não encontrado.");
  if ((prod.conta as unknown as { user_id: string }).user_id !== user.id) {
    throw new Error("Produto não encontrado.");
  }

  const { error } = await db.from("produto").delete().eq("id", produtoId);
  if (error) throw new Error(`Não deu pra excluir: ${error.message}`);

  revalidatePath(`/conta/${prod.conta_id}`);
}

// --- produto -> imagem base --------------------------------------------------

export async function criarProduto(form: FormData) {
  const contaId = String(form.get("contaId") ?? "");
  const { db } = await exigirDonoDaConta(contaId);

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
  const { error: eUp } = await db.storage
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

  revalidatePath(`/conta/${contaId}`);
  return { imagemBaseId: ib.id };
}

/** Refazer: nova imagem_base pro mesmo produto. A anterior fica no histórico. */
export async function refazerImagem(imagemBaseId: string) {
  const { db, user } = await exigirUsuario();

  const { data: ib } = await db
    .from("imagem_base")
    .select("produto_id, produto:produto_id(conta_id, conta:conta_id(user_id))")
    .eq("id", imagemBaseId)
    .maybeSingle();

  if (!ib) throw new Error("Imagem não encontrada.");
  const dono = (ib.produto as unknown as { conta: { user_id: string } }).conta.user_id;
  if (dono !== user.id) throw new Error("Imagem não encontrada.");

  await db.from("imagem_base").update({ status: "rejeitada" }).eq("id", imagemBaseId);

  const { data: nova, error } = await db
    .from("imagem_base")
    .insert({ produto_id: ib.produto_id, status: "gerando" })
    .select("id")
    .single();

  if (error) throw new Error(`Não deu pra refazer: ${error.message}`);

  await db.from("job").insert({ tipo: "gerar_imagem", ref_id: nova.id });

  revalidatePath("/");
  return { imagemBaseId: nova.id };
}

// --- aprovação ---------------------------------------------------------------

/**
 * Aprova e já enfileira a análise. A análise roda enquanto ela escolhe os
 * formatos, então a direção já existe quando os jobs de vídeo entram (FIFO, um
 * worker). Ver PLAN.md §5.
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
    const qtd = Math.max(0, Math.min(5, Math.trunc(n))); // teto: clique errado não vira R$100
    for (let i = 0; i < qtd; i++) linhas.push({ imagem_base_id: imagemBaseId, formato_key: key });
  }

  if (linhas.length === 0) throw new Error("Escolha pelo menos um vídeo.");

  const { data: videos, error } = await db.from("video").insert(linhas).select("id");
  if (error) throw new Error(`Não deu pra pedir os vídeos: ${error.message}`);

  await db.from("job").insert(videos.map((v) => ({ tipo: "gerar_video", ref_id: v.id })));

  revalidatePath("/");
  return { quantos: videos.length };
}
