/**
 * Formatos de vídeo. Ver PLAN.md §4 e §5.
 *
 * PROVISÓRIOS — o Lucas quer montar uma biblioteca maior (dancinhas, movimento,
 * desfilando) depois do MVP rodar. O shape aqui mapeia 1:1 para uma tabela
 * `formato`, então virar biblioteca editável é migração, não refatoração.
 *
 * A divisão que importa:
 *   - `boilerplate` = igual em todo vídeo. Fica aqui, o Claude nunca toca.
 *   - `briefing`    = a intenção do formato. Vai pro Claude, que escreve a
 *                     direção (framing/movement/destaque/speech) olhando a peça.
 */

export type FormatoKey = "talking" | "achado_do_dia" | "nota_1_a_10";

export type Formato = {
  key: FormatoKey;
  nome: string;
  temFala: boolean;
  duracaoS: number;
  briefing: string;
  boilerplate: string;
};

/** Negative comum — nunca muda. */
const NEGATIVE_BASE =
  "changed face, different person, changed outfit, phone in hand, studio lighting, " +
  "plastic skin, deformed hands, watermark, text, subtitles, logos, stiff expression, " +
  "exaggerated movement, distorted body or hands";

/** Constraints técnicas — nunca mudam. */
const TECH = "Handheld vertical phone video, soft natural lighting, realistic casual UGC, 9:16";

function boilerplate(opts: { fala: boolean; duracaoS: number; extraNegative?: string }) {
  const negative = [
    NEGATIVE_BASE,
    opts.fala ? "English speech" : "audible speech, talking, open mouth movement",
    opts.extraNegative,
  ]
    .filter(Boolean)
    .join(", ");

  return [
    // Uma linha só trava identidade + cenário (antes isto vinha repetido).
    "[Reference: {{referencia}}. Keep her face, body and closet identical to the reference.]",
    "",
    `${TECH}, ~${opts.duracaoS}s.`,
    `Negative: ${negative}.`,
  ].join("\n");
}

export const FORMATOS: Formato[] = [
  {
    key: "talking",
    nome: "Talking (com fala)",
    temFala: true,
    duracaoS: 8,
    briefing:
      "Casual talking-to-camera video, as if speaking to a friend. Intimate and charismatic. " +
      "Movement should be minimal and natural — small hand gestures while speaking, and she " +
      "should physically draw attention to the single most distinctive detail of the garment. " +
      "Speech must be in natural Brazilian Portuguese (pt-BR), 1 short sentence, with correct " +
      "pt-BR pronunciation and lip sync matching the speech.",
    boilerplate: boilerplate({ fala: true, duracaoS: 8 }),
  },
  {
    key: "achado_do_dia",
    nome: "Série: Achado do dia (sem fala)",
    temFala: false,
    duracaoS: 8,
    briefing:
      "Recurring 'find of the day' reveal — energetic and branded, part of an ongoing series. " +
      "Same signature opening pose and same closing pose every episode, so the series is " +
      "instantly recognizable. Between them she moves to show the full outfit and returns to " +
      "front, letting the garment's silhouette read clearly. Natural silent lip sync, mouth " +
      "closed or neutral throughout.",
    boilerplate: boilerplate({ fala: false, duracaoS: 8 }),
  },
  {
    key: "nota_1_a_10",
    nome: "Nota de 1 a 10 (sem fala)",
    temFala: false,
    duracaoS: 8,
    briefing:
      "A 'rate this fit' reveal: she moves through consecutive angles — front, side, back, side, " +
      "front — with a short pause at each so the viewer can judge the outfit. Confident and " +
      "playful, slightly runway-like but still casual UGC. Single continuous outfit walk, no cuts. " +
      "Natural silent lip sync, mouth stays closed or neutral throughout.",
    boilerplate: boilerplate({ fala: false, duracaoS: 8 }),
  },
];

export const FORMATOS_POR_KEY = Object.fromEntries(
  FORMATOS.map((f) => [f.key, f]),
) as Record<FormatoKey, Formato>;
