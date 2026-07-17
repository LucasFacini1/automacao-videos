/**
 * Dados falsos para desenhar e revisar a UI antes do Supabase.
 *
 * TEMPORÁRIO. Some quando as telas forem ligadas no banco (dados.ts/acoes.ts).
 *
 * Modela o que importa pra organização multi-usuário:
 *   usuário  →  várias contas  →  cada conta tem 1 persona (congelada)  →  produtos
 *
 * O sistema não é de uma pessoa só: a tia do dono, o marido dela e o próprio
 * dono são usuários distintos, cada um com suas contas.
 */

export type Persona = {
  fotoUrl: string; // a referência congelada — carrega rosto E cenário (PLAN.md §3.1)
  cabelo: string;
  make: string;
  cenario: string;
  unhas: string;
};

export type StatusProduto = "gerando" | "aguardando_aprovacao" | "aprovada" | "com_videos";

export type ProdutoMock = {
  id: string;
  nome: string;
  produtoUrl: string;
  baseUrl: string | null;
  status: StatusProduto;
  videos: number;
  quando: string;
};

export type Conta = {
  id: string;
  handle: string;
  nome: string;
  nicho: string;
  persona: Persona;
  produtos: ProdutoMock[];
};

/** O usuário logado. Uma pessoa; pode gerenciar várias contas. */
export const USUARIO = {
  nome: "Gabi",
  email: "gabi@email.com",
  inicial: "G",
};

export const CONTAS: Conta[] = [
  {
    id: "moda",
    handle: "@gabi.modafacil",
    nome: "Moda Fácil",
    nicho: "Moda feminina",
    persona: {
      fotoUrl: "/img/persona.png",
      cabelo: "Liso, castanho claro, comprido",
      make: "Natural, leve",
      cenario: "Closet moderno",
      unhas: "Rosa",
    },
    produtos: [
      {
        id: "p1",
        nome: "Body preto recorte + saia couro",
        produtoUrl: "/img/produto-3.png",
        baseUrl: "/img/base-3.png",
        status: "com_videos",
        videos: 3,
        quando: "hoje, 14:20",
      },
      {
        id: "p2",
        nome: "Vestido midi floral rosas",
        produtoUrl: "/img/produto-2.png",
        baseUrl: "/img/base-2.png",
        status: "aguardando_aprovacao",
        videos: 0,
        quando: "hoje, 13:05",
      },
      {
        id: "p3",
        nome: "Body azul + saia couro",
        produtoUrl: "/img/produto-1.png",
        baseUrl: "/img/base-1.png",
        status: "com_videos",
        videos: 2,
        quando: "ontem, 18:40",
      },
    ],
  },
  {
    id: "achados",
    handle: "@lza.achadinhos",
    nome: "Achadinhos da Lza",
    nicho: "Variedades e promoções",
    persona: {
      fotoUrl: "/img/base-2.png",
      cabelo: "Liso, castanho, comprido",
      make: "Glow, iluminada",
      cenario: "Closet moderno",
      unhas: "Nude",
    },
    produtos: [
      {
        id: "p4",
        nome: "Vestido floral vermelho",
        produtoUrl: "/img/produto-2.png",
        baseUrl: "/img/base-2.png",
        status: "com_videos",
        videos: 2,
        quando: "terça, 10:15",
      },
    ],
  },
  {
    id: "fit",
    handle: "@bella.fit",
    nome: "Bella Fit",
    nicho: "Moda fitness",
    persona: {
      fotoUrl: "/img/base-1.png",
      cabelo: "Preso, rabo de cavalo",
      make: "Natural",
      cenario: "Closet moderno",
      unhas: "Francesinha",
    },
    produtos: [], // conta nova, ainda sem produto — mostra o estado vazio
  },
];

// --- helpers ----------------------------------------------------------------

export function pegarConta(id: string): Conta | undefined {
  return CONTAS.find((c) => c.id === id);
}

export function pegarProduto(contaId: string, produtoId: string): ProdutoMock | undefined {
  return pegarConta(contaId)?.produtos.find((p) => p.id === produtoId);
}

export function resumoConta(c: Conta) {
  const videos = c.produtos.reduce((s, p) => s + p.videos, 0);
  const pendentes = c.produtos.filter((p) => p.status === "aguardando_aprovacao").length;
  return { produtos: c.produtos.length, videos, pendentes };
}

export const ROTULO_STATUS: Record<StatusProduto, string> = {
  gerando: "Criando a foto...",
  aguardando_aprovacao: "Esperando você aprovar",
  aprovada: "Aprovada",
  com_videos: "Vídeos prontos",
};

/** Custo por vídeo em R$ — ver PLAN.md §1. Estimativa, não cobrança. */
export const CUSTO_VIDEO = 5.4;
export const CUSTO_IMAGEM = 0.72;

export function formatarBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
