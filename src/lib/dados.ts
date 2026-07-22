import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { usuarioLogadoId } from "@/lib/sessao";
import { urlAssinada } from "@/lib/storage";

/**
 * Leitura. Todo acesso ao banco pelo dashboard passa por aqui.
 *
 * Usa o cliente admin (service_role) no servidor e filtra por user_id — isso
 * ignora a RLS e é o que separa as contas de um usuário das de outro. Toda
 * query que sai de `conta` ancora no user_id (sem isto, vaza entre usuários).
 *
 * O bucket `midia` é privado — imagens vêm como signed URL, nunca URL pública.
 */

export type StatusImagem = "gerando" | "pronta" | "aprovada" | "rejeitada" | "erro" | "cancelada";

// --- hub: contas do usuário com resumo --------------------------------------

export type ContaResumo = {
  id: string;
  handle: string;
  nome: string;
  personaUrl: string | null;
  produtos: number;
  videos: number;
  pendentes: number;
};

export async function listarContasComResumo(): Promise<ContaResumo[]> {
  const userId = await usuarioLogadoId();
  if (!userId) return [];
  const db = createAdminClient();

  const { data, error } = await db
    .from("conta")
    .select(
      `id, handle, nome,
       persona ( ref_image_url ),
       produto ( id, imagem_base ( status, video ( status ) ) )`,
    )
    .eq("user_id", userId)
    .eq("ativo", true)
    .order("created_at");

  if (error) throw new Error(`listarContasComResumo: ${error.message}`);

  type IB = { status: StatusImagem; video: { status: string }[] | null };
  type Prod = { id: string; imagem_base: IB[] | null };
  type Row = {
    id: string;
    handle: string;
    nome: string;
    // persona.conta_id é unique (1-pra-1) — o Supabase embeda como objeto, não array
    persona: { ref_image_url: string } | null;
    produto: Prod[] | null;
  };

  return Promise.all(
    (data as unknown as Row[]).map(async (c) => {
      const produtos = c.produto ?? [];
      let videos = 0;
      let pendentes = 0;
      for (const p of produtos) {
        const ibs = p.imagem_base ?? [];
        videos += ibs.reduce((s, ib) => s + (ib.video ?? []).filter((v) => v.status === "pronto").length, 0);
        if (ibs.some((ib) => ib.status === "pronta")) pendentes++;
      }
      const ref = c.persona?.ref_image_url;
      return {
        id: c.id,
        handle: c.handle,
        nome: c.nome,
        personaUrl: ref ? await urlAssinada(db, ref) : null,
        produtos: produtos.length,
        videos,
        pendentes,
      };
    }),
  );
}

// --- dentro da conta --------------------------------------------------------

export type Persona = {
  refUrl: string | null;
  cabelo: string;
  make: string;
  cenario: string;
  unhas: string;
};

export type Conta = {
  id: string;
  handle: string;
  nome: string;
  persona: Persona | null;
};

export async function pegarConta(contaId: string): Promise<Conta | null> {
  const userId = await usuarioLogadoId();
  if (!userId) return null;
  const db = createAdminClient();

  const { data } = await db
    .from("conta")
    .select("id, handle, nome, persona ( ref_image_url, cabelo, make, cenario, unhas )")
    .eq("id", contaId)
    .eq("user_id", userId) // ancora no dono
    .maybeSingle();

  if (!data) return null;

  // persona.conta_id é unique (1-pra-1) — o Supabase embeda como objeto, não array
  type P = { ref_image_url: string; cabelo: string; make: string; cenario: string; unhas: string };
  const p = data.persona as unknown as P | null;

  return {
    id: data.id,
    handle: data.handle,
    nome: data.nome,
    persona: p
      ? {
          refUrl: p.ref_image_url ? await urlAssinada(db, p.ref_image_url) : null,
          cabelo: p.cabelo,
          make: p.make,
          cenario: p.cenario,
          unhas: p.unhas,
        }
      : null,
  };
}

export type ProdutoLista = {
  id: string;
  nome: string;
  criadoEm: string;
  imagemBaseId: string | null;
  statusImagem: StatusImagem | null;
  thumbUrl: string | null;
  videosProntos: number;
};

export async function listarProdutos(contaId: string): Promise<ProdutoLista[]> {
  const userId = await usuarioLogadoId();
  if (!userId) return [];
  const db = createAdminClient();

  const { data: conta } = await db
    .from("conta")
    .select("id")
    .eq("id", contaId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!conta) return [];

  const { data, error } = await db
    .from("produto")
    .select("id, nome, created_at, imagem_base ( id, image_url, status, created_at, video ( status ) )")
    .eq("conta_id", contaId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`listarProdutos: ${error.message}`);

  type IB = {
    id: string;
    image_url: string | null;
    status: StatusImagem;
    created_at: string;
    video: { status: string }[] | null;
  };

  return Promise.all(
    (data ?? []).map(async (p) => {
      const imagens = (p.imagem_base ?? []) as unknown as IB[];
      const atual = [...imagens].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      return {
        id: p.id,
        nome: p.nome,
        criadoEm: p.created_at,
        imagemBaseId: atual?.id ?? null,
        statusImagem: atual?.status ?? null,
        thumbUrl: atual?.image_url ? await urlAssinada(db, atual.image_url) : null,
        videosProntos: (atual?.video ?? []).filter((v) => v.status === "pronto").length,
      };
    }),
  );
}

// --- estado completo de um produto (a tela do fluxo) ------------------------

export type VideoItem = {
  id: string;
  formatoKey: string;
  status: "na_fila" | "gerando" | "pronto" | "erro" | "cancelado";
  videoUrl: string | null;
  erro: string | null;
};

export type Legenda = {
  descricao: string;
  hashtags: string[];
};

export type EstadoProduto = {
  imagemBaseId: string;
  contaId: string;
  produtoNome: string;
  status: StatusImagem;
  imagemUrl: string | null;
  produtoUrl: string | null;
  erroImagem: string | null;
  temAnalise: boolean;
  copy: Legenda | null;
  videos: VideoItem[];
};

/**
 * Tudo que a tela do produto precisa, numa consulta só. A tela decide o que
 * mostrar a partir do `status` + `videos` — nada de passo fingido no cliente.
 */
export async function pegarEstadoProduto(imagemBaseId: string): Promise<EstadoProduto | null> {
  const userId = await usuarioLogadoId();
  if (!userId) return null;
  const db = createAdminClient();

  const { data } = await db
    .from("imagem_base")
    .select(
      `id, status, image_url, erro,
       produto:produto_id ( nome, image_url, conta_id, conta:conta_id ( user_id ) ),
       analise ( copy ),
       video ( id, formato_key, status, video_url, erro )`,
    )
    .eq("id", imagemBaseId)
    .maybeSingle();

  if (!data) return null;

  const produto = data.produto as unknown as {
    nome: string;
    image_url: string;
    conta_id: string;
    conta: { user_id: string };
  };
  if (produto.conta.user_id !== userId) return null;

  // analise.imagem_base_id é unique (1-pra-1) — o Supabase embeda como objeto, não array
  const analise = data.analise as unknown as { copy: Legenda } | null;
  const videos = (data.video ?? []) as unknown as {
    id: string;
    formato_key: string;
    status: VideoItem["status"];
    video_url: string | null;
    erro: string | null;
  }[];

  return {
    imagemBaseId: data.id,
    contaId: produto.conta_id,
    produtoNome: produto.nome,
    status: data.status,
    imagemUrl: data.image_url ? await urlAssinada(db, data.image_url) : null,
    produtoUrl: produto.image_url ? await urlAssinada(db, produto.image_url) : null,
    erroImagem: data.erro,
    temAnalise: Boolean(analise),
    copy: analise?.copy ?? null,
    videos: await Promise.all(
      videos.map(async (v) => ({
        id: v.id,
        formatoKey: v.formato_key,
        status: v.status,
        videoUrl: v.video_url ? await urlAssinada(db, v.video_url, 3600) : null,
        erro: v.erro,
      })),
    ),
  };
}

// --- tela de aprovação ------------------------------------------------------

export type ImagemBaseDetalhe = {
  id: string;
  status: StatusImagem;
  imagemUrl: string | null;
  produtoUrl: string | null;
  produtoNome: string;
  contaId: string;
};

export async function pegarImagemBase(id: string): Promise<ImagemBaseDetalhe | null> {
  const userId = await usuarioLogadoId();
  if (!userId) return null;
  const db = createAdminClient();

  const { data } = await db
    .from("imagem_base")
    .select("id, status, image_url, produto:produto_id(nome, image_url, conta_id, conta:conta_id(user_id))")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const produto = data.produto as unknown as {
    nome: string;
    image_url: string;
    conta_id: string;
    conta: { user_id: string };
  };

  if (produto.conta.user_id !== userId) return null;

  return {
    id: data.id,
    status: data.status,
    imagemUrl: data.image_url ? await urlAssinada(db, data.image_url) : null,
    produtoUrl: produto.image_url ? await urlAssinada(db, produto.image_url) : null,
    produtoNome: produto.nome,
    contaId: produto.conta_id,
  };
}
