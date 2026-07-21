import type { SupabaseClient } from "@supabase/supabase-js";
import { FORMATOS, FORMATOS_POR_KEY, type FormatoKey } from "@/lib/formatos";
import { promptImagemBase } from "@/lib/prompts";
import { gerarImagemBase, gerarVideo, MODELO_VIDEO } from "@/lib/ia/gemini";
import { analisarImagemBase, montarPromptVideo } from "@/lib/ia/direcao";
import { baixarInline, subirBase64, subirBuffer } from "@/lib/storage";

export type Job = {
  id: string;
  tipo: "gerar_imagem" | "analisar" | "gerar_video";
  ref_id: string;
  tentativas: number;
};

// --- gerar_imagem: produto + persona -> imagem base (Fase 2) -----------------

export async function gerarImagem(db: SupabaseClient, job: Job): Promise<void> {
  const { data: ib, error } = await db
    .from("imagem_base")
    .select("id, produto:produto_id(id, image_url, conta_id)")
    .eq("id", job.ref_id)
    .single();

  if (error || !ib) throw new Error(`imagem_base ${job.ref_id} não encontrada: ${error?.message}`);

  const produto = ib.produto as unknown as { id: string; image_url: string; conta_id: string };

  const { data: persona, error: ePersona } = await db
    .from("persona")
    .select("ref_image_url, cenario, cabelo, make, unhas")
    .eq("conta_id", produto.conta_id)
    .single();

  if (ePersona || !persona) {
    throw new Error(`Conta ${produto.conta_id} não tem persona configurada.`);
  }

  const prompt = promptImagemBase(persona);

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
}

// --- analisar: imagem base -> direção + copy (Fase 3) ------------------------

export async function analisar(db: SupabaseClient, job: Job): Promise<void> {
  const { data: ib, error } = await db
    .from("imagem_base")
    .select("id, image_url, status")
    .eq("id", job.ref_id)
    .single();

  if (error || !ib) throw new Error(`imagem_base ${job.ref_id} não encontrada: ${error?.message}`);
  if (!ib.image_url) throw new Error(`imagem_base ${ib.id} não tem imagem.`);

  // Só analisa o que o usuário aprovou — o gate existe pra não gastar à toa.
  if (ib.status !== "aprovada") {
    throw new Error(`imagem_base ${ib.id} está '${ib.status}', esperado 'aprovada'.`);
  }

  const imagem = await baixarInline(db, ib.image_url);
  const analise = await analisarImagemBase({ imagemBase: imagem, formatos: FORMATOS });

  const direcao: Record<string, unknown> = {};
  const copy: Record<string, unknown> = {};

  for (const f of FORMATOS) {
    const v = analise.videos[f.key] as Record<string, unknown> | undefined;
    if (!v) throw new Error(`Claude não devolveu o formato '${f.key}'.`);

    direcao[f.key] = {
      framing: v.framing,
      movement: v.movement,
      destaque: v.destaque,
      ...(f.temFala ? { speech: v.speech } : {}),
    };
    copy[f.key] = { texto_tela: v.texto_tela, descricao: v.descricao, hashtags: v.hashtags };
  }

  const { error: eIns } = await db.from("analise").upsert(
    { imagem_base_id: ib.id, descricao_roupa: analise.descricao_roupa, direcao, copy },
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
    .select("id, image_url, produto:produto_id(conta_id)")
    .eq("id", v.imagem_base_id)
    .single();
  if (eIb || !ib?.image_url) throw new Error(`imagem_base de ${v.id} indisponível: ${eIb?.message}`);

  const contaId = (ib.produto as unknown as { conta_id: string }).conta_id;

  const { data: analise, error: eAn } = await db
    .from("analise")
    .select("descricao_roupa, direcao")
    .eq("imagem_base_id", v.imagem_base_id)
    .single();
  if (eAn || !analise) throw new Error(`Sem análise para imagem_base ${v.imagem_base_id}.`);

  const direcao = (analise.direcao as Record<string, never>)[formato.key];
  if (!direcao) throw new Error(`Análise não tem direção para '${formato.key}'.`);

  const prompt = montarPromptVideo({
    formato,
    descricaoRoupa: analise.descricao_roupa,
    direcao,
    referencia: "the woman in the reference image, in her usual closet",
  });

  await db.from("video").update({ status: "gerando", prompt_final: prompt }).eq("id", v.id);

  const imagem = await baixarInline(db, ib.image_url);

  const { uri } = await gerarVideo({
    prompt,
    imagemBase: imagem,
    duracaoS: formato.duracaoS,
    onProgresso: (n) => console.log(`  [${MODELO_VIDEO}] ${v.id} aguardando... (${n * 10}s)`),
  });

  // O usuário pode ter cancelado enquanto o Veo gerava. Se não está mais
  // 'gerando', descarta — não sobrescreve o cancelamento.
  const { data: atual } = await db.from("video").select("status").eq("id", v.id).single();
  if (atual?.status !== "gerando") {
    console.log(`  ${v.id} cancelado durante a geração — descartando resultado`);
    return;
  }

  // A URI do Gemini é temporária e exige a chave — baixa e guarda no storage.
  const resp = await fetch(`${uri}&key=${process.env.GOOGLE_API_KEY}`);
  if (!resp.ok) throw new Error(`Falha ao baixar o vídeo (${resp.status}).`);
  const buf = Buffer.from(await resp.arrayBuffer());

  const path = `contas/${contaId}/videos/${v.id}.mp4`;
  await subirBuffer(db, path, buf, "video/mp4");

  await db
    .from("video")
    .update({ status: "pronto", video_url: path, duracao_s: formato.duracaoS, erro: null })
    .eq("id", v.id);
}
