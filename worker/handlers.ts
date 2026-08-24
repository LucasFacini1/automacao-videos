import type { SupabaseClient } from "@supabase/supabase-js";
import { FORMATOS, FORMATOS_POR_KEY, type FormatoKey } from "@/lib/formatos";
import { promptImagemBase } from "@/lib/prompts";
import { gerarImagemBase, gerarVideo, MODELO_VIDEO } from "@/lib/ia/gemini";
import {
  analisarImagemBase,
  escreverLegenda,
  montarPromptVideo,
  montarPromptMinimo,
  traduzirEstilo,
} from "@/lib/ia/direcao";
import { baixarInline, subirBase64, subirBuffer } from "@/lib/storage";
import { CUSTO_IMAGEM, CUSTO_VIDEO } from "@/lib/custos";
import { removerAudio } from "./ffmpeg";

export type Job = {
  id: string;
  tipo: "gerar_imagem" | "analisar" | "gerar_video";
  ref_id: string;
  tentativas: number;
};

/**
 * Falha terminal → marca a linha que o usuário vê (foto/vídeo) como 'erro'.
 *
 * Sem isto, um job que desiste deixa a linha presa em 'gerando' e a tela fica
 * girando pra sempre — o pior jeito de falhar num produto de "sai e volta".
 * O guard `.eq(status, 'gerando')` não pisa num cancelamento (que já mudou o
 * status), então cancelar continua ganhando da falha.
 */
export async function marcarFalhaVisivel(
  db: SupabaseClient,
  job: Job,
  mensagem: string,
): Promise<void> {
  if (job.tipo === "gerar_imagem") {
    await db
      .from("imagem_base")
      .update({ status: "erro", erro: mensagem })
      .eq("id", job.ref_id)
      .eq("status", "gerando");
  } else if (job.tipo === "gerar_video") {
    await db
      .from("video")
      .update({ status: "erro", erro: mensagem })
      .eq("id", job.ref_id)
      .eq("status", "gerando");
  }
  // 'analisar' não tem linha própria com status — o erro fica no job.
}

/**
 * Grava uma linha no ledger de custo. Só o /admin lê isso — a usuária final
 * nunca vê custo. Falha-segura: se o insert der erro, loga e segue (não vale
 * travar a entrega do vídeo por causa da contabilidade).
 */
async function registrarCusto(
  db: SupabaseClient,
  ev: {
    userId: string;
    contaId: string;
    produtoId?: string | null;
    tipo: "imagem" | "video";
    refId: string;
    formatoKey?: string;
    custo: number;
  },
): Promise<void> {
  const { error } = await db.from("custo_evento").insert({
    user_id: ev.userId,
    conta_id: ev.contaId,
    produto_id: ev.produtoId ?? null,
    tipo: ev.tipo,
    ref_id: ev.refId,
    formato_key: ev.formatoKey ?? null,
    custo: ev.custo,
    status: "ok",
  });
  if (error) console.error(`  falha ao registrar custo (${ev.tipo} ${ev.refId}): ${error.message}`);
}

// --- gerar_imagem: produto + persona -> imagem base (Fase 2) -----------------

export async function gerarImagem(db: SupabaseClient, job: Job): Promise<void> {
  const { data: ib, error } = await db
    .from("imagem_base")
    .select("id, produto:produto_id(id, image_url, ajustes, conta_id, conta:conta_id(user_id))")
    .eq("id", job.ref_id)
    .single();

  if (error || !ib) throw new Error(`imagem_base ${job.ref_id} não encontrada: ${error?.message}`);

  const produto = ib.produto as unknown as {
    id: string;
    image_url: string;
    ajustes: string | null;
    conta_id: string;
    conta: { user_id: string };
  };

  const { data: persona, error: ePersona } = await db
    .from("persona")
    .select("ref_image_url, cenario, cabelo, make, unhas")
    .eq("conta_id", produto.conta_id)
    .single();

  if (ePersona || !persona) {
    throw new Error(`Conta ${produto.conta_id} não tem persona configurada.`);
  }

  // Ajuste de visual do produto (PT-BR) -> inglês, e entra no prompt da imagem.
  // É aqui que unha/cabelo/acessório funcionam (a imagem é gerada, não animada).
  const ajustesEn = produto.ajustes ? await traduzirEstilo(produto.ajustes) : undefined;
  if (ajustesEn) console.log(`  ajuste de visual da foto: "${produto.ajustes}" -> "${ajustesEn}"`);

  const prompt = promptImagemBase(persona, ajustesEn);

  const [refPersona, imgProduto] = await Promise.all([
    baixarInline(db, persona.ref_image_url),
    baixarInline(db, produto.image_url),
  ]);

  const gerada = await gerarImagemBase({ prompt, persona: refPersona, produto: imgProduto });

  // cancelado durante a geração? descarta.
  const { data: atual } = await db.from("imagem_base").select("status").eq("id", ib.id).single();
  if (atual?.status !== "gerando") {
    console.log(`  imagem ${ib.id} cancelada durante a geração — descartando`);
    return;
  }

  const path = `contas/${produto.conta_id}/base/${ib.id}.png`;
  await subirBase64(db, path, gerada);

  await db
    .from("imagem_base")
    .update({ image_url: path, status: "pronta", prompt_usado: prompt, erro: null })
    .eq("id", ib.id);

  await registrarCusto(db, {
    userId: produto.conta.user_id,
    contaId: produto.conta_id,
    produtoId: produto.id,
    tipo: "imagem",
    refId: ib.id,
    custo: CUSTO_IMAGEM,
  });
}

// --- analisar: imagem base -> direção + copy (Fase 3) ------------------------

export async function analisar(db: SupabaseClient, job: Job): Promise<void> {
  const { data: ib, error } = await db
    .from("imagem_base")
    .select("id, image_url, status, produto:produto_id(nome)")
    .eq("id", job.ref_id)
    .single();

  if (error || !ib) throw new Error(`imagem_base ${job.ref_id} não encontrada: ${error?.message}`);
  if (!ib.image_url) throw new Error(`imagem_base ${ib.id} não tem imagem.`);

  // Só analisa o que o usuário aprovou — o gate existe pra não gastar à toa.
  if (ib.status !== "aprovada") {
    throw new Error(`imagem_base ${ib.id} está '${ib.status}', esperado 'aprovada'.`);
  }

  // O nome do produto é o que está anunciado — direciona legenda e foco (ver
  // direcao.ts). Nome genérico/filename a IA ignora, ancorando na foto.
  const produtoAnunciado = (ib.produto as unknown as { nome: string } | null)?.nome || undefined;

  const imagem = await baixarInline(db, ib.image_url);

  // Passo 1: direção do vídeo. Passo 2: UMA legenda PT-BR ancorada na peça.
  // Separados de propósito (ver o doc no topo de direcao.ts). A legenda usa a
  // descrição da peça que o passo 1 produziu, então rodam em sequência.
  const analise = await analisarImagemBase({ imagemBase: imagem, formatos: FORMATOS, produtoAnunciado });
  const legenda = await escreverLegenda({
    imagemBase: imagem,
    descricaoRoupa: analise.descricao_roupa,
    produtoAnunciado,
  });

  const direcao: Record<string, unknown> = {};

  for (const f of FORMATOS) {
    const v = analise.videos[f.key] as Record<string, unknown> | undefined;
    if (!v) throw new Error(`Direção não devolveu o formato '${f.key}'.`);

    direcao[f.key] = {
      framing: v.framing,
      movement: v.movement,
      destaque: v.destaque,
      ...(f.temFala ? { speech: v.speech } : {}),
    };
  }

  // copy: uma legenda só pro produto (descrição + hashtags), não por formato.
  const { error: eIns } = await db.from("analise").upsert(
    { imagem_base_id: ib.id, descricao_roupa: analise.descricao_roupa, direcao, copy: legenda },
    { onConflict: "imagem_base_id" },
  );
  if (eIns) throw new Error(`Falha ao gravar análise: ${eIns.message}`);
}

// --- gerar_video: direção + boilerplate -> clipe (Fase 3) --------------------

export async function gerarVideoHandler(db: SupabaseClient, job: Job): Promise<void> {
  const { data: v, error } = await db
    .from("video")
    .select("id, formato_key, imagem_base_id")
    .eq("id", job.ref_id)
    .single();

  if (error || !v) throw new Error(`video ${job.ref_id} não encontrado: ${error?.message}`);

  const formato = FORMATOS_POR_KEY[v.formato_key as FormatoKey];
  if (!formato) throw new Error(`Formato '${v.formato_key}' não existe em formatos.ts.`);

  const { data: ib, error: eIb } = await db
    .from("imagem_base")
    .select("id, image_url, produto:produto_id(id, nome, conta_id, conta:conta_id(user_id))")
    .eq("id", v.imagem_base_id)
    .single();
  if (eIb || !ib?.image_url) throw new Error(`imagem_base de ${v.id} indisponível: ${eIb?.message}`);

  const produtoV = ib.produto as unknown as {
    id: string;
    nome: string;
    conta_id: string;
    conta: { user_id: string };
  };
  const contaId = produtoV.conta_id;

  const { data: analise, error: eAn } = await db
    .from("analise")
    .select("descricao_roupa, direcao")
    .eq("imagem_base_id", v.imagem_base_id)
    .single();
  if (eAn || !analise) throw new Error(`Sem análise para imagem_base ${v.imagem_base_id}.`);

  const direcao = (analise.direcao as Record<string, never>)[formato.key];
  if (!direcao) throw new Error(`Análise não tem direção para '${formato.key}'.`);

  const REFERENCIA = "the woman in the reference image, in her usual closet";

  const prompt = montarPromptVideo({
    formato,
    descricaoRoupa: analise.descricao_roupa,
    direcao,
    referencia: REFERENCIA,
  });

  // Reserva sem descrição de peça/corpo: se o filtro barrar o detalhado, o
  // gerarVideo tenta este uma vez (entrada diferente, não retentativa à toa).
  const promptFallback = montarPromptMinimo({
    formato,
    referencia: REFERENCIA,
    speech: (direcao as { speech?: string }).speech,
  });

  await db.from("video").update({ status: "gerando", prompt_final: prompt }).eq("id", v.id);

  const imagem = await baixarInline(db, ib.image_url);

  console.log(`  [${MODELO_VIDEO}] ${v.id} gerando...`);
  const { video } = await gerarVideo({
    prompt,
    promptFallback,
    imagemBase: imagem,
    duracaoS: formato.duracaoS,
    onProgresso: (n) => console.log(`  [${MODELO_VIDEO}] ${v.id} aguardando... (${n * 10}s)`),
  });

  // O usuário pode ter cancelado enquanto o vídeo gerava. Se não está mais
  // 'gerando', descarta — não sobrescreve o cancelamento.
  const { data: atual } = await db.from("video").select("status").eq("id", v.id).single();
  if (atual?.status !== "gerando") {
    console.log(`  ${v.id} cancelado durante a geração — descartando resultado`);
    return;
  }

  // gerarVideo normaliza os dois backends num Buffer só.
  let buf: Buffer = video;

  // Os dois backends geram áudio. Nos formatos sem voz, emudece (ffmpeg).
  if (!formato.temFala) buf = await removerAudio(buf);

  const path = `contas/${contaId}/videos/${v.id}.mp4`;
  await subirBuffer(db, path, buf, "video/mp4");

  await db
    .from("video")
    .update({ status: "pronto", video_url: path, duracao_s: formato.duracaoS, erro: null })
    .eq("id", v.id);

  await registrarCusto(db, {
    userId: produtoV.conta.user_id,
    contaId,
    produtoId: produtoV.id,
    tipo: "video",
    refId: v.id,
    formatoKey: formato.key,
    custo: CUSTO_VIDEO,
  });

  // Legenda PRÓPRIA deste clipe. Dois vídeos do mesmo produto não podem sair com
  // a mesma descrição — quem posta os dois precisa de textos diferentes.
  // Falhar aqui NÃO derruba o vídeo: ele já está pronto e salvo. A tela cai na
  // legenda geral da análise se esta faltar.
  try {
    const d = direcao as { destaque?: string };
    const legendaClipe = await escreverLegenda({
      imagemBase: imagem,
      descricaoRoupa: analise.descricao_roupa,
      produtoAnunciado: produtoV.nome,
      anguloDoVideo: `${formato.nome}${d.destaque ? ` — ${d.destaque}` : ""}`,
    });
    await db.from("video").update({ legenda: legendaClipe }).eq("id", v.id);
  } catch (e) {
    console.warn(`  legenda do clipe ${v.id} falhou (vídeo já salvo): ${e instanceof Error ? e.message : e}`);
  }
}
