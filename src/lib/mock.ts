/**
 * Dados falsos para desenhar e revisar a UI antes do Supabase existir.
 *
 * TEMPORÁRIO. Some quando as telas forem ligadas no banco (Fase 1).
 * As imagens apontam para /img, que é uma cópia dos pares reais que o Lucas
 * validou — então a UI é julgada com o material de verdade, não placeholder.
 */

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

export const CONTA = {
  handle: "@gabi.modafacil",
  nome: "Gabi Moda Fácil",
  personaUrl: "/img/persona.png",
};

export const PRODUTOS: ProdutoMock[] = [
  {
    id: "1",
    nome: "Body preto recorte + saia couro",
    produtoUrl: "/img/produto-3.png",
    baseUrl: "/img/base-3.png",
    status: "com_videos",
    videos: 3,
    quando: "hoje, 14:20",
  },
  {
    id: "2",
    nome: "Vestido midi floral rosas",
    produtoUrl: "/img/produto-2.png",
    baseUrl: "/img/base-2.png",
    status: "aguardando_aprovacao",
    videos: 0,
    quando: "hoje, 13:05",
  },
  {
    id: "3",
    nome: "Body azul + saia couro",
    produtoUrl: "/img/produto-1.png",
    baseUrl: "/img/base-1.png",
    status: "com_videos",
    videos: 2,
    quando: "ontem, 18:40",
  },
];

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
