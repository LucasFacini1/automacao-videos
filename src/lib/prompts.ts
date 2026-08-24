/**
 * Prompt de geração da imagem base. Ver PLAN.md §1.
 *
 * Este é o prompt do Lucas, validado na mão no Flow — os 3 pares de
 * (produto → imagem base) em img/ saíram dele. Mexer aqui é mexer no que
 * já funciona: mede antes.
 */

export type PersonaConfig = {
  cenario: string;
  cabelo: string;
  make: string;
  unhas: string;
};

/**
 * `ajustesProduto`: mudança de visual pedida pra ESTE produto (unhas, cabelo,
 * acessório), já em inglês. É AQUI que ela funciona — a imagem é gerada, então o
 * modelo pinta a unha, prende o cabelo, põe o relógio. No vídeo não dá: ele só
 * anima a foto já pronta. Vazio = mantém tudo como na referência.
 */
export function promptImagemBase(p: PersonaConfig, ajustesProduto?: string): string {
  // Campo vazio = "mantém o que está na referência", não "sem isso". O cadastro
  // não pede mais cabelo/make: a foto de referência já define rosto, cabelo,
  // maquiagem e cenário. Só entra no prompt o que foi preenchido de propósito
  // (na tela da modelo) — senão sairia "Hair: . Makeup: ." e o modelo se perde.
  const persona = [
    p.cenario?.trim() ? `Setting: ${p.cenario}` : null,
    p.unhas?.trim() ? `Nails: ${p.unhas}` : null,
    p.cabelo?.trim() ? `Hair: ${p.cabelo}` : null,
    p.make?.trim() ? `Makeup: ${p.make}` : null,
  ]
    .filter(Boolean)
    .join(". ");

  const aj = ajustesProduto?.trim();

  return [
    "[Reference 1: minha modelo — manter identidade] [Reference 2: peça de roupa]",
    "Put the person from Reference 1 wearing the outfit from Reference 2.",
    // Com ajuste, cabelo/unha/make PODEM mudar — então não os trave no "keep".
    // O rosto e o cenário nunca mudam (a persona é congelada, PLAN.md §3.1).
    aj
      ? "Keep her face and identity and the background setting exactly as in Reference 1."
      : "Keep her face, hair, makeup and the background setting exactly as in Reference 1.",
    persona ? `${persona}.` : null,
    aj ? `Apply these specific styling changes to her look: ${aj}.` : null,
    "Pose: standing confident, facing camera. Soft natural light. Authentic UGC phone photo,",
    "vertical 9:16, realistic skin texture.",
    "Negative: changed face, different person, changed outfit, changed background, phone in",
    "hand, studio lighting, plastic skin, deformed hands, watermark.",
  ]
    .filter(Boolean)
    .join("\n");
}
