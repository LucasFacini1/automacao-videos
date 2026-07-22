/**
 * Formatos de vídeo. Ver PLAN.md §4 e §5.
 *
 * Estilos por MOVIMENTO (o que a câmera/modelo faz): falando, desfile, dançinha,
 * close no detalhe. A legenda é uma só por produto (ver direcao.ts) — por isso o
 * estilo é sobre a cena, não sobre o gancho de legenda. Na tela, a usuária marca
 * os estilos e quantas variações de cada.
 *
 * Ainda em código, mas o shape mapeia 1:1 para uma tabela `formato` — virar
 * biblioteca editável (adicionar estilo sem deploy) é migração, não refatoração.
 *
 * A divisão que importa:
 *   - `boilerplate` = igual em todo vídeo. Fica aqui, o modelo nunca toca.
 *   - `briefing`    = a intenção do estilo. Vai pro modelo de direção, que
 *                     escreve framing/movement/destaque/speech olhando a peça.
 */

export type FormatoKey = "falando" | "desfile" | "dancinha" | "detalhe";

export type Formato = {
  key: FormatoKey;
  nome: string;
  /** Uma linha, PT-BR, sem jargão — o que a tia lê pra saber o que é este estilo. */
  resumo: string;
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

/** Constraints técnicas — nunca mudam. Empurram pro look natural, sem cara de anúncio. */
const TECH =
  "Handheld vertical phone video, soft natural lighting, candid and unposed authentic " +
  "creator footage, subtle natural motion and real skin, 9:16";

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
    key: "falando",
    nome: "Falando",
    resumo: "Ela conversa com a câmera contando sobre a peça.",
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
    key: "desfile",
    nome: "Desfile",
    resumo: "Ela gira e mostra o look de vários ângulos.",
    temFala: false,
    duracaoS: 8,
    briefing:
      "A runway-style reveal to show the whole outfit: she walks a step toward the camera, then " +
      "moves through consecutive angles — front, side profile, a full turn to the back — with a " +
      "brief confident pause at each so the silhouette and the way the garment falls read " +
      "clearly. Single continuous walk, no cuts. Natural silent lip sync, mouth closed or neutral.",
    boilerplate: boilerplate({ fala: false, duracaoS: 8 }),
  },
  {
    key: "dancinha",
    nome: "Dançinha",
    resumo: "Uma dancinha rápida com a roupa em movimento.",
    temFala: false,
    duracaoS: 8,
    briefing:
      "A short, trendy TikTok dance moment in place — casual, fun and flattering, the kind a real " +
      "creator does. The movement is rhythmic but controlled so the outfit stays readable and the " +
      "garment moves naturally with her (fabric sways, skirt flares). Not chaotic, not exaggerated. " +
      "Natural silent lip sync, mouth closed or neutral throughout.",
    boilerplate: boilerplate({ fala: false, duracaoS: 8 }),
  },
  {
    key: "detalhe",
    nome: "Close no detalhe",
    resumo: "A câmera dá um close no detalhe da peça.",
    temFala: false,
    duracaoS: 8,
    briefing:
      "Starts framed on the outfit, then the camera moves in slow and deliberate for a close-up on " +
      "the single most distinctive detail of the garment (a cutout, the fabric texture, a hem, a " +
      "strap), holding on it so the texture and finish read. Minimal body movement — the camera " +
      "does the work. Natural silent lip sync, mouth closed or neutral throughout.",
    boilerplate: boilerplate({ fala: false, duracaoS: 8 }),
  },
];

export const FORMATOS_POR_KEY = Object.fromEntries(
  FORMATOS.map((f) => [f.key, f]),
) as Record<FormatoKey, Formato>;
