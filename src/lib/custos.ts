/** Custos de geração, em R$. Ver PLAN.md §1. Estimativa pra mostrar antes de
 *  confirmar — não é cobrança. */
export const CUSTO_VIDEO = 5.4;
export const CUSTO_IMAGEM = 0.72;

export function formatarBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
