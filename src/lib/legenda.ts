/**
 * Legenda do post: montagem e o teto de 150 caracteres.
 *
 * 150 incluindo as hashtags é exigência da Shopee (ela corta o que passa), e
 * cabe bem no TikTok também. O modelo recebe isso no prompt, mas modelo conta
 * caractere mal — então `ajustarLegenda` é a trava de verdade, no código.
 *
 * Puro (sem server-only): serve tanto o worker (na geração) quanto o cliente
 * (na exibição), pra contar exatamente o mesmo texto nos dois lados.
 */
export const LEGENDA_MAX = 150;

type Copy = { descricao: string; hashtags?: string[] };

/** O texto final que a pessoa copia: descrição + hashtags. É isto que conta. */
export function textoLegenda(copy: Copy): string {
  const tags = (copy.hashtags ?? []).map((h) => `#${h.replace(/^#/, "")}`).join(" ");
  return [copy.descricao?.trim(), tags].filter(Boolean).join("\n\n");
}

/**
 * Garante que a legenda inteira caiba em LEGENDA_MAX. Estratégia: primeiro solta
 * hashtags do fim (são o mais descartável); se a descrição sozinha ainda passar,
 * corta ela num limite de palavra. Assim o teto vale mesmo se o modelo furar.
 */
export function ajustarLegenda(copy: Copy): { descricao: string; hashtags: string[] } {
  let descricao = (copy.descricao ?? "").trim();
  const hashtags = [...(copy.hashtags ?? [])];

  while (hashtags.length > 0 && textoLegenda({ descricao, hashtags }).length > LEGENDA_MAX) {
    hashtags.pop();
  }

  if (textoLegenda({ descricao, hashtags }).length > LEGENDA_MAX) {
    descricao = descricao.slice(0, LEGENDA_MAX);
    const corte = descricao.lastIndexOf(" ");
    if (corte > 100) descricao = descricao.slice(0, corte);
    descricao = descricao.trim();
  }

  return { descricao, hashtags };
}
