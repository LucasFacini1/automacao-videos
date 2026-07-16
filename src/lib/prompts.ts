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

export function promptImagemBase(p: PersonaConfig): string {
  return [
    "[Reference 1: minha modelo — manter identidade] [Reference 2: peça de roupa]",
    `Put the person from Reference 1 wearing the outfit from Reference 2, in her usual`,
    `setting: ${p.cenario}. Nails: ${p.unhas}. Hair: ${p.cabelo}. Makeup: ${p.make}. Pose:`,
    "standing confident, facing camera. Soft natural light. Authentic UGC phone photo,",
    "vertical 9:16, realistic skin texture.",
    "Negative: changed face, different person, changed outfit, phone in hand, studio",
    "lighting, plastic skin, deformed hands, watermark.",
  ].join("\n");
}
