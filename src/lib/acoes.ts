"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { usuarioLogado } from "@/lib/sessao";
import { BUCKET } from "@/lib/storage";
import { FORMATOS_POR_KEY, type FormatoKey } from "@/lib/formatos";
import { CUSTO_IMAGEM, CUSTO_VIDEO } from "@/lib/custos";
import { ehAdmin } from "@/lib/admin";
import type { TipoProduto } from "@/lib/ia/direcao";

// Teto de gasto mensal, em R$. O valor de cada pessoa fica no banco
// (limite_usuario, editável no /admin); TETO_MENSAL_BRL no env é só o padrão pra
// quem não tem linha lá. 0 nos dois = sem teto. Ver PLAN.md §9.
const TETO_PADRAO_BRL = Number(process.env.TETO_MENSAL_BRL ?? 0) || 0;

/**
 * Soma o que o USUÁRIO já gastou no mês, em TODAS as contas dele.
 * Antes era por conta — aí quem tinha 3 contas gastava 3x o teto.
 */
export async function gastoDoMes(
  db: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<number> {
  const inicio = new Date();
  inicio.setDate(1);
  inicio.setHours(0, 0, 0, 0);
  const { data } = await db
    .from("custo_evento")
    .select("custo")
    .eq("user_id", userId)
    .gte("created_at", inicio.toISOString());
  return (data ?? []).reduce((s, e) => s + Number((e as { custo: number }).custo), 0);
}

/** Teto do usuário: o do banco se houver, senão o padrão do env. 0 = sem teto. */
export async function limiteDoUsuario(
  db: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<number> {
  const { data } = await db
    .from("limite_usuario")
    .select("limite_mensal")
    .eq("user_id", userId)
    .maybeSingle();
  const proprio = Number((data as { limite_mensal: number } | null)?.limite_mensal ?? 0) || 0;
  return proprio || TETO_PADRAO_BRL;
}

/**
 * Barra a criação se o gasto do mês + o novo custo passar do teto do usuário.
 * Mensagem sem jargão — a usuária final é quem vê.
 */
async function exigirDentroDoTeto(
  db: ReturnType<typeof createAdminClient>,
  userId: string,
  custoNovo: number,
): Promise<void> {
  const teto = await limiteDoUsuario(db, userId);
  if (!teto) return;
  const gasto = await gastoDoMes(db, userId);
  if (gasto + custoNovo > teto) {
    throw new Error("Você atingiu o limite de uso deste mês. Fale com quem cuida da conta pra liberar mais.");
  }
}

/**
 * Define o teto mensal de UM usuário (tela /admin). 0 = volta pro padrão do env.
 * Gate de admin aqui dentro: é uma server action, então qualquer um poderia
 * chamá-la pela rede — checar só na tela que renderiza não bastaria.
 */
export async function definirLimiteUsuario(userId: string, limite: number) {
  if (!(await ehAdmin())) throw new Error("Não autorizado.");

  const valor = Math.max(0, Number.isFinite(limite) ? limite : 0);
  const db = createAdminClient();

  const { error } = await db
    .from("limite_usuario")
    .upsert({ user_id: userId, limite_mensal: valor, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw new Error(`Não deu pra salvar o limite: ${error.message}`);

  revalidatePath("/admin");
}

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

// --- sessão ------------------------------------------------------------------

/** Sair da conta. Encerra a sessão (cookie) e volta pro login. */
export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
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
    // Vazio de propósito: quem define rosto, cabelo, make e cenário é a foto de
    // referência (o cadastro não pergunta mais). O promptImagemBase omite campo
    // vazio e manda manter o que está na referência. Ajuste fino é na tela da
    // modelo, e aí sim entra no prompt.
    cenario: String(form.get("cenario") ?? ""),
    cabelo: String(form.get("cabelo") ?? ""),
    make: String(form.get("make") ?? ""),
    unhas: String(form.get("unhas") ?? ""),
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

/**
 * Exclui vários produtos de uma vez (seleção na tela da conta). Apaga também os
 * arquivos no storage — a foto do produto, as imagens base e os vídeos (o banco
 * cai por cascade, o storage não). Filtra pra manter só os produtos do usuário.
 */
export async function excluirProdutos(produtoIds: string[]) {
  const { db, user } = await exigirUsuario();
  if (produtoIds.length === 0) return;

  const { data: prods } = await db
    .from("produto")
    .select("id, conta_id, image_url, conta:conta_id(user_id), imagem_base(image_url, video(video_url))")
    .in("id", produtoIds);
  if (!prods || prods.length === 0) return;

  type Prod = {
    id: string;
    conta_id: string;
    image_url: string | null;
    conta: { user_id: string };
    imagem_base: { image_url: string | null; video: { video_url: string | null }[] | null }[] | null;
  };
  const meus = (prods as unknown as Prod[]).filter((p) => p.conta.user_id === user.id);
  if (meus.length === 0) throw new Error("Produto não encontrado.");

  // junta todos os caminhos de storage que penduram nesses produtos
  const paths: string[] = [];
  for (const p of meus) {
    if (p.image_url) paths.push(p.image_url);
    for (const ib of p.imagem_base ?? []) {
      if (ib.image_url) paths.push(ib.image_url);
      for (const v of ib.video ?? []) if (v.video_url) paths.push(v.video_url);
    }
  }
  if (paths.length) await db.storage.from(BUCKET).remove(paths);

  const ids = meus.map((p) => p.id);
  const { error } = await db.from("produto").delete().in("id", ids);
  if (error) throw new Error(`Não deu pra excluir: ${error.message}`);

  revalidatePath(`/conta/${meus[0].conta_id}`);
  revalidatePath("/");
}

// --- produto -> imagem base --------------------------------------------------

/** Cria 1 produto: linha + upload da foto + imagem_base + job. Devolve o id da imagem_base. */
async function criarUmProduto(
  db: ReturnType<typeof createAdminClient>,
  contaId: string,
  item: { foto: File; nome: string; ajustes?: string; tipo?: TipoProduto },
): Promise<string> {
  const { data: produto, error: eProd } = await db
    .from("produto")
    .insert({
      conta_id: contaId,
      nome: item.nome,
      image_url: "",
      tipo: item.tipo === "avulso" ? "avulso" : "modelo",
      // ajustes é só pra tipo='modelo' — avulso não tem persona pra ajustar.
      ajustes: item.tipo === "avulso" ? null : item.ajustes || null,
    })
    .select("id")
    .single();
  if (eProd) throw new Error(`Não deu pra salvar o produto: ${eProd.message}`);

  const path = `contas/${contaId}/produtos/${produto.id}.png`;
  const { error: eUp } = await db.storage
    .from(BUCKET)
    .upload(path, Buffer.from(await item.foto.arrayBuffer()), {
      contentType: item.foto.type || "image/png",
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
  return ib.id;
}

export async function criarProduto(form: FormData) {
  const contaId = String(form.get("contaId") ?? "");
  const { db, user } = await exigirDonoDaConta(contaId);

  const tipo: TipoProduto = form.get("tipo") === "avulso" ? "avulso" : "modelo";
  // Avulso não compõe com a persona — nada é gerado nessa etapa, sem custo.
  await exigirDentroDoTeto(db, user.id, tipo === "avulso" ? 0 : CUSTO_IMAGEM);

  const foto = form.get("foto") as File | null;
  if (!foto || foto.size === 0) throw new Error("Envie a foto do produto.");

  const nome = String(form.get("nome") ?? "").trim() || "Produto sem nome";
  const ajustes = String(form.get("ajustes") ?? "").trim().slice(0, 120) || undefined;

  const imagemBaseId = await criarUmProduto(db, contaId, { foto, nome, ajustes, tipo });

  revalidatePath(`/conta/${contaId}`);
  return { imagemBaseId };
}

/**
 * Cria vários produtos de uma vez (upload em lote). Cada foto vira um produto
 * com seu nome (= o que está sendo anunciado). O teto do mês vale pro lote
 * inteiro. Devolve os ids das imagens base, na ordem enviada.
 */
export async function criarProdutosEmLote(form: FormData) {
  const contaId = String(form.get("contaId") ?? "");
  const { db, user } = await exigirDonoDaConta(contaId);

  // Um tipo só pra todo o lote — misturar modelo/avulso no mesmo upload não
  // vale a complexidade de tela; quem precisar dos dois faz duas levas.
  const tipo: TipoProduto = form.get("tipo") === "avulso" ? "avulso" : "modelo";

  // getAll preserva a ordem de inserção — foto[i], nome[i] e ajustes[i] alinham.
  const fotos = form.getAll("foto");
  const nomes = form.getAll("nome").map((n) => String(n));
  const ajustesArr = form.getAll("ajustes").map((a) => String(a));

  const itens: { foto: File; nome: string; ajustes?: string; tipo: TipoProduto }[] = [];
  for (let i = 0; i < fotos.length; i++) {
    const f = fotos[i];
    if (!(f instanceof File) || f.size === 0) continue;
    itens.push({
      foto: f,
      nome: (nomes[i] ?? "").trim() || `Produto ${i + 1}`,
      ajustes: (ajustesArr[i] ?? "").trim().slice(0, 120) || undefined,
      tipo,
    });
  }
  if (itens.length === 0) throw new Error("Envie ao menos uma foto.");

  await exigirDentroDoTeto(db, user.id, tipo === "avulso" ? 0 : itens.length * CUSTO_IMAGEM);

  const imagemBaseIds: string[] = [];
  for (const it of itens) imagemBaseIds.push(await criarUmProduto(db, contaId, it));

  revalidatePath(`/conta/${contaId}`);
  return { imagemBaseIds };
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
  const prod = ib.produto as unknown as { conta_id: string; conta: { user_id: string } };
  if (prod.conta.user_id !== user.id) throw new Error("Imagem não encontrada.");

  await exigirDentroDoTeto(db, user.id, CUSTO_IMAGEM);

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

/**
 * Enfileira os vídeos pedidos. Ajuste de visual (unhas/cabelo/acessório) NÃO
 * entra aqui: o vídeo só anima a foto pronta, então isso é decidido na criação
 * do produto (vira a imagem base). Ver promptImagemBase.
 */
export async function pedirVideos(imagemBaseId: string, quantidades: Record<string, number>) {
  const { db, user } = await exigirUsuario();

  // Ancora no dono: sem isto, um usuário logado enfileiraria vídeos (e custo) na
  // imagem de outro. Todo o resto de acoes.ts checa dono — aqui também.
  const { data: ib } = await db
    .from("imagem_base")
    .select("id, produto:produto_id(conta_id, conta:conta_id(user_id))")
    .eq("id", imagemBaseId)
    .maybeSingle();
  const prod = ib?.produto as unknown as { conta_id: string; conta: { user_id: string } } | undefined;
  if (!prod || prod.conta.user_id !== user.id) throw new Error("Imagem não encontrada.");

  const linhas: { imagem_base_id: string; formato_key: string }[] = [];

  for (const [key, n] of Object.entries(quantidades)) {
    if (!FORMATOS_POR_KEY[key as FormatoKey]) throw new Error(`Formato inválido: ${key}`);
    const qtd = Math.max(0, Math.min(5, Math.trunc(n))); // teto: clique errado não vira R$100
    for (let i = 0; i < qtd; i++) linhas.push({ imagem_base_id: imagemBaseId, formato_key: key });
  }

  if (linhas.length === 0) throw new Error("Escolha pelo menos um vídeo.");

  await exigirDentroDoTeto(db, user.id, linhas.length * CUSTO_VIDEO);

  const { data: videos, error } = await db.from("video").insert(linhas).select("id");
  if (error) throw new Error(`Não deu pra pedir os vídeos: ${error.message}`);

  await db.from("job").insert(videos.map((v) => ({ tipo: "gerar_video", ref_id: v.id })));

  revalidatePath("/");
  return { quantos: videos.length };
}

// --- cancelamento ------------------------------------------------------------

/** Garante que o item (via imagem_base) é do usuário logado. */
async function donoDaImagemBase(db: ReturnType<typeof createAdminClient>, ibId: string, userId: string) {
  const { data } = await db
    .from("imagem_base")
    .select("id, produto:produto_id(conta:conta_id(user_id))")
    .eq("id", ibId)
    .maybeSingle();
  const dono = (data?.produto as unknown as { conta: { user_id: string } } | undefined)?.conta.user_id;
  return Boolean(data) && dono === userId;
}

/**
 * Cancela um vídeo em `na_fila` ou `gerando`.
 *
 * Se ainda está na fila, tira o job antes do worker pegar — não gasta nada.
 * Se já está gerando, marca cancelado; o worker, ao terminar a chamada do Veo,
 * vê que não está mais `gerando` e descarta o resultado (ver worker/handlers).
 */
export async function cancelarVideo(videoId: string) {
  const { db, user } = await exigirUsuario();

  const { data: v } = await db
    .from("video")
    .select("id, status, imagem_base_id")
    .eq("id", videoId)
    .maybeSingle();
  if (!v) throw new Error("Vídeo não encontrado.");
  if (!(await donoDaImagemBase(db, v.imagem_base_id, user.id))) {
    throw new Error("Vídeo não encontrado.");
  }
  if (v.status === "pronto" || v.status === "cancelado") return;

  // tira o job da fila se ainda não foi pego (sem custo)
  await db.from("job").delete().eq("tipo", "gerar_video").eq("ref_id", videoId).eq("status", "pendente");
  await db.from("video").update({ status: "cancelado" }).eq("id", videoId);

  revalidatePath("/");
}

/**
 * Apaga um vídeo já finalizado (pronto/erro/cancelado): remove o arquivo do
 * storage e a linha. Irreversível — a UI confirma antes. Para vídeos ainda na
 * fila ou gerando, o caminho é `cancelarVideo`, não este.
 */
export async function excluirVideo(videoId: string) {
  const { db, user } = await exigirUsuario();

  const { data: v } = await db
    .from("video")
    .select("id, video_url, imagem_base_id")
    .eq("id", videoId)
    .maybeSingle();
  if (!v) throw new Error("Vídeo não encontrado.");
  if (!(await donoDaImagemBase(db, v.imagem_base_id, user.id))) {
    throw new Error("Vídeo não encontrado.");
  }

  // Job genérico (ref_id não é FK, não cai por cascade): limpa manualmente.
  await db.from("job").delete().eq("tipo", "gerar_video").eq("ref_id", videoId);
  if (v.video_url) {
    await db.storage.from(BUCKET).remove([v.video_url]);
  }

  const { error } = await db.from("video").delete().eq("id", videoId);
  if (error) throw new Error(`Não deu pra apagar o vídeo: ${error.message}`);

  revalidatePath("/");
}

/**
 * Apaga vários vídeos de uma vez (seleção na biblioteca). Filtra pra manter só
 * os que são do usuário — id de fora de outra conta é simplesmente ignorado.
 */
export async function excluirVideos(videoIds: string[]) {
  const { db, user } = await exigirUsuario();
  if (videoIds.length === 0) return;

  const { data: vids } = await db
    .from("video")
    .select("id, video_url, imagem_base_id")
    .in("id", videoIds);
  if (!vids || vids.length === 0) return;

  const checados = await Promise.all(
    vids.map(async (v) => ((await donoDaImagemBase(db, v.imagem_base_id, user.id)) ? v : null)),
  );
  const permitidos = checados.filter((v): v is NonNullable<typeof v> => v !== null);
  if (permitidos.length === 0) throw new Error("Vídeo não encontrado.");

  const ids = permitidos.map((v) => v.id);
  const paths = permitidos.map((v) => v.video_url).filter((p): p is string => Boolean(p));

  await db.from("job").delete().eq("tipo", "gerar_video").in("ref_id", ids);
  if (paths.length) await db.storage.from(BUCKET).remove(paths);

  const { error } = await db.from("video").delete().in("id", ids);
  if (error) throw new Error(`Não deu pra apagar: ${error.message}`);

  revalidatePath("/");
}

/** Cancela a geração da foto (imagem base) enquanto está `gerando`. */
export async function cancelarImagem(imagemBaseId: string) {
  const { db, user } = await exigirUsuario();

  if (!(await donoDaImagemBase(db, imagemBaseId, user.id))) {
    throw new Error("Imagem não encontrada.");
  }

  const { data: ib } = await db.from("imagem_base").select("status").eq("id", imagemBaseId).maybeSingle();
  if (!ib || ib.status !== "gerando") return;

  await db.from("job").delete().eq("tipo", "gerar_imagem").eq("ref_id", imagemBaseId).eq("status", "pendente");
  await db.from("imagem_base").update({ status: "cancelada" }).eq("id", imagemBaseId);

  revalidatePath("/");
}
