import "server-only";
import { createClient } from "@/lib/supabase/server";
import { urlAssinada } from "@/lib/storage";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Leitura. Todo acesso ao banco pelo dashboard passa por aqui.
 *
 * NÃO TESTADO contra Supabase de verdade — escrito sem credencial.
 * Confira contra supabase/migrations/0001_initial.sql se algo vier vazio.
 *
 * RLS está desativado (PLAN.md §3), então o filtro por user_id nestas queries
 * é a ÚNICA coisa separando as contas de um usuário das de outro. Toda query
 * que sai de `conta` precisa de um join que ancore no user_id.
 */

export type Conta = {
  id: string;
  handle: string;
  nome: string;
};

export type Persona = {
  ref_image_url: string;
  cenario: string;
  cabelo: string;
  make: string;
  unhas: string;
};

export type StatusImagem = "gerando" | "pronta" | "aprovada" | "rejeitada" | "erro";

export type ProdutoLista = {
  id: string;
  nome: string;
  criadoEm: string;
  imagemBaseId: string | null;
  statusImagem: StatusImagem | null;
  thumbUrl: string | null;
  videosProntos: number;
};

async function usuario(db: SupabaseClient) {
  const {
    data: { user },
  } = await db.auth.getUser();
  return user;
}

/** Contas do usuário logado. Vazio se deslogado — nunca lança. */
export async function listarContas(): Promise<Conta[]> {
  const db = await createClient();
  const user = await usuario(db);
  if (!user) return [];

  const { data, error } = await db
    .from("conta")
    .select("id, handle, nome")
    .eq("user_id", user.id)
    .eq("ativo", true)
    .order("created_at");

  if (error) throw new Error(`listarContas: ${error.message}`);
  return data ?? [];
}

/** Conta por id, já checando que é do usuário logado. */
export async function pegarConta(contaId: string): Promise<Conta | null> {
  const db = await createClient();
  const user = await usuario(db);
  if (!user) return null;

  const { data } = await db
    .from("conta")
    .select("id, handle, nome")
    .eq("id", contaId)
    .eq("user_id", user.id) // sem isto, qualquer um lê a conta de qualquer um
    .maybeSingle();

  return data;
}

export async function pegarPersona(contaId: string): Promise<Persona | null> {
  if (!(await pegarConta(contaId))) return null; // ancora no dono

  const db = await createClient();
  const { data } = await db
    .from("persona")
    .select("ref_image_url, cenario, cabelo, make, unhas")
    .eq("conta_id", contaId)
    .maybeSingle();

  return data;
}

/**
 * Lista de produtos da conta, com a imagem base mais recente de cada um e a
 * contagem de vídeos prontos.
 */
export async function listarProdutos(contaId: string): Promise<ProdutoLista[]> {
  if (!(await pegarConta(contaId))) return [];

  const db = await createClient();
  const { data, error } = await db
    .from("produto")
    .select(
      `id, nome, created_at,
       imagem_base ( id, image_url, status, created_at,
                     video ( id, status ) )`,
    )
    .eq("conta_id", contaId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`listarProdutos: ${error.message}`);

  type LinhaVideo = { id: string; status: string };
  type LinhaImagem = {
    id: string;
    image_url: string | null;
    status: StatusImagem;
    created_at: string;
    video: LinhaVideo[] | null;
  };

  return Promise.all(
    (data ?? []).map(async (p) => {
      const imagens = (p.imagem_base ?? []) as unknown as LinhaImagem[];
      // Um produto pode ter várias imagens base (refazer gera outra). A que
      // vale é a última.
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

export type ImagemBaseDetalhe = {
  id: string;
  status: StatusImagem;
  imagemUrl: string | null;
  produtoUrl: string | null;
  produtoNome: string;
};

/** Detalhe pra tela de aprovação: a gerada + o anúncio, pra comparar. */
export async function pegarImagemBase(id: string): Promise<ImagemBaseDetalhe | null> {
  const db = await createClient();
  const user = await usuario(db);
  if (!user) return null;

  const { data } = await db
    .from("imagem_base")
    .select("id, status, image_url, produto:produto_id(nome, image_url, conta:conta_id(user_id))")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const produto = data.produto as unknown as {
    nome: string;
    image_url: string;
    conta: { user_id: string };
  };

  // RLS off: a checagem de dono é aqui ou em lugar nenhum.
  if (produto.conta.user_id !== user.id) return null;

  return {
    id: data.id,
    status: data.status,
    imagemUrl: data.image_url ? await urlAssinada(db, data.image_url) : null,
    produtoUrl: produto.image_url ? await urlAssinada(db, produto.image_url) : null,
    produtoNome: produto.nome,
  };
}
