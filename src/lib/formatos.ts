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

export type FormatoKeyModelo = "falando" | "desfile" | "dancinha" | "detalhe";
export type FormatoKeyAvulso = "giro" | "textura" | "estilo_vida";
export type FormatoKey = FormatoKeyModelo | FormatoKeyAvulso;

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

// --- avulso: só a peça, sem modelo (produto.tipo === 'avulso') --------------
//
// Sem pessoa em cena — nada de "she"/corpo/fala no boilerplate. A peça
// aparece como está na foto (cabide, manequim, flat lay). Todos sem fala: não
// tem quem falar.

const NEGATIVE_PRODUTO =
  "person, human, hand, fingers, face, model wearing the garment, changed color, changed " +
  "print, warped logo, morphed shape, phone in frame, visible studio softbox, watermark, " +
  "text overlay, subtitles, blurry focus, distorted proportions";

const TECH_PRODUTO =
  "Slow and deliberate camera movement, soft natural lighting, aesthetic e-commerce/lookbook " +
  "video, no person or hands in frame, 9:16";

function boilerplateProduto(opts: { duracaoS: number; extraNegative?: string }) {
  const negative = [NEGATIVE_PRODUTO, opts.extraNegative].filter(Boolean).join(", ");
  return [
    "[Reference: the exact garment in the photo. Keep its color, print, fabric texture, cut and proportions identical to the reference — only the camera and the setting move.]",
    "",
    `${TECH_PRODUTO}, ~${opts.duracaoS}s.`,
    `Negative: ${negative}.`,
  ].join("\n");
}

export const FORMATOS_AVULSO: Formato[] = [
  {
    key: "giro",
    nome: "Giro do produto",
    resumo: "A câmera roda em volta da peça, mostrando todos os ângulos.",
    temFala: false,
    duracaoS: 8,
    briefing:
      "A slow 180-to-360-degree orbit around the garment exactly as displayed in the photo (on " +
      "a hanger, mannequin form, or flat lay), revealing front, side and back so the full " +
      "silhouette and cut read clearly. Smooth, continuous camera movement, no cuts.",
    boilerplate: boilerplateProduto({ duracaoS: 8 }),
  },
  {
    key: "textura",
    nome: "Close no detalhe",
    resumo: "A câmera dá um close na textura ou no detalhe que vende a peça.",
    temFala: false,
    duracaoS: 8,
    briefing:
      "Starts on a wide view of the garment, then the camera pushes in slow and deliberate for a " +
      "macro close-up on the single most distinctive detail (the fabric texture, a print, an " +
      "embroidery, a button or zipper), holding on it so the material and finish read clearly.",
    boilerplate: boilerplateProduto({ duracaoS: 8 }),
  },
  {
    key: "estilo_vida",
    nome: "No dia a dia",
    resumo: "A peça estilizada num cenário real, não num fundo neutro.",
    temFala: false,
    duracaoS: 8,
    briefing:
      "The garment styled in a natural, aspirational setting (laid out on a bed, hanging against " +
      "soft window light, or a styled flat lay with subtle complementary accessories), with " +
      "gentle ambient movement — soft light shifts, fabric moving slightly as if in a light " +
      "breeze. Editorial lookbook feel, not a sterile studio shot.",
    boilerplate: boilerplateProduto({ duracaoS: 8 }),
  },
];

export const FORMATOS_POR_KEY = Object.fromEntries(
  [...FORMATOS, ...FORMATOS_AVULSO].map((f) => [f.key, f]),
) as Record<FormatoKey, Formato>;
