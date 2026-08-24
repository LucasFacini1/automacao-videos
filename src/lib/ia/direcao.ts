import { GoogleGenAI } from "@google/genai";
import type { Formato } from "@/lib/formatos";
import { ajustarLegenda } from "@/lib/legenda";

/**
 * Direção dos vídeos e legendas, a partir da imagem base. Ver PLAN.md §5.
 *
 * Roda no Gemini Flash-Lite (não no Claude): precisa de VISÃO — tem que citar o
 * que aquela peça tem de específico. Flash-Lite enxerga imagem, vai bem em
 * pt-BR, custa ~10x menos que Sonnet, e usa a mesma chave da geração de
 * imagem/vídeo (uma credencial só no projeto).
 *
 * (A API do DeepSeek é text-only, por isso não serve aqui.)
 *
 * DOIS PASSOS, de propósito (um pediu o outro atrapalhava):
 *   - analisarImagemBase() → direção do vídeo (framing/movement/destaque/speech,
 *     em inglês, pro gerador de vídeo).
 *   - escreverLegendas()   → a copy PT-BR (texto na tela, descrição, hashtags).
 * Fundir os dois numa chamada só fazia a legenda sair como refugo da direção —
 * genérica, sem citar a peça. Separado, cada passo tem um cérebro só seu.
 *
 * Não escreve o prompt inteiro do vídeo — o boilerplate (referência, negative,
 * constraints) fica em formatos.ts e é costurado por montarPromptVideo().
 */

export const MODELO = "gemini-3.1-flash-lite";

let _client: GoogleGenAI | null = null;

function client(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Falta GOOGLE_API_KEY. Veja .env.example.");
  _client = new GoogleGenAI({ apiKey });
  return _client;
}

const SYSTEM = `Você dirige vídeos UGC de moda para afiliadas brasileiras — vídeos que elas postam no TikTok Shop, na Shopee e afins.

Recebe uma foto de uma modelo vestindo uma peça, num closet. Sua função é escrever a DIREÇÃO de cada vídeo pedido — não o prompt inteiro.

Regras que não se quebram:

1. A direção é ESPECÍFICA DAQUELA PEÇA. "natural movement, confident pose" é inútil — descreve qualquer roupa do mundo. Encontre o que essa peça tem de particular (um recorte, o caimento, a textura, uma alça, o comprimento) e dirija o vídeo em torno disso.
2. Escreva framing/movement/destaque (e speech quando pedido) em INGLÊS — vão direto pro modelo de vídeo. A ÚNICA exceção é o speech, que é PT-BR.
3. O speech, quando houver, é PT-BR informal e natural, do jeito que brasileira de 20 e poucos anos fala nas redes. 1 frase curta. Sem publicidade formal, sem "adquira já".
4. NÃO invente preço, desconto, marca, tecido ou composição que você não consegue ver na foto. Se não dá pra saber, não fale.
5. Não repita nas suas respostas nada que já é fixo no prompt (9:16, UGC, iluminação natural, o closet, negative). Isso já está garantido em outro lugar.
6. A modelo NUNCA segura celular e NUNCA aparece espelho/selfie.
7. LINGUAGEM DE ROUPA, NUNCA DE CORPO. O gerador de vídeo BARRA direção que descreve ou toca partes do corpo. Fale da peça: "the neckline", "the hem", "the sleeve", "the trim", "the fabric", "the waistline of the skirt". NUNCA use chest, bust, cleavage, breast, thigh, hip, butt — nem "touches her ...". Em vez de "touches the cutout at the chest", escreva "adjusts the neckline detail". O movimento é da câmera e do tecido, não das mãos no corpo.`;

/** Exemplo validado na mão pelo Lucas — a régua do que é "boa direção". */
const FEW_SHOT = `Exemplo de direção BOA, para uma peça descrita como:
"black long sleeve top with a braided detail at the neckline, and a black leather asymmetric mini skirt"

falando:
  framing: close-up, waist up, intimate — talking directly to the camera as if to a friend
  movement: minimal and natural, small hand gestures while speaking, glances down at the braided neckline detail as she mentions it
  destaque: the braided neckline detail — reads as a designer finish but the piece is cheap
  speech: "Esse top tem um acabamento que ninguém repara que é barato. Olha o trançado, ficou impecável."

desfile:
  framing: full body, head to toe, to showcase the full outfit
  movement: walks a step toward the camera, poses front-facing for a beat, turns to the side profile, then a full turn to the back to show the skirt's asymmetric hem, returns to front
  destaque: the asymmetric wrap hem of the leather skirt, which moves on the turn

detalhe:
  framing: starts mid-body, then a slow push-in to a tight close-up on the braided neckline trim
  movement: minimal body movement, the camera moves in slowly and holds on the braided trim
  destaque: the braided texture of the neckline trim — the weave and how it catches the light

Repare: cada campo cita ALGO QUE SÓ ESSA PEÇA TEM, e sempre pela ROUPA (neckline, hem, trim) — nunca por parte do corpo. É esse o padrão.`;

// --- schema ------------------------------------------------------------------

type JsonSchema = Record<string, unknown>;

/** Schema montado a partir dos formatos pedidos — cresce junto com a biblioteca. */
function schemaPara(formatos: Formato[]): JsonSchema {
  const videos: Record<string, JsonSchema> = {};

  for (const f of formatos) {
    const props: Record<string, JsonSchema> = {
      framing: { type: "string", description: "Enquadramento, em inglês." },
      movement: { type: "string", description: "Movimento e o que ela faz com a peça, em inglês." },
      destaque: { type: "string", description: "O detalhe específico desta peça que o vídeo vende, em inglês." },
    };
    const required = ["framing", "movement", "destaque"];

    if (f.temFala) {
      props.speech = {
        type: "string",
        description: "A fala exata, PT-BR natural, 1 frase curta. É lipsync — escreva pra ser dito.",
      };
      required.push("speech");
    }

    videos[f.key] = { type: "object", properties: props, required };
  }

  return {
    type: "object",
    properties: {
      descricao_roupa: {
        type: "string",
        description: "A peça (ou o look) em inglês, com precisão suficiente pra dirigir o vídeo. Só o que dá pra ver.",
      },
      videos: { type: "object", properties: videos, required: formatos.map((f) => f.key) },
    },
    required: ["descricao_roupa", "videos"],
  };
}

export type Analise = {
  descricao_roupa: string;
  videos: Record<string, Record<string, unknown>>;
};

// --- chamada -----------------------------------------------------------------

export async function analisarImagemBase(args: {
  imagemBase: { base64: string; mimeType: string };
  formatos: Formato[];
  /** O que está sendo anunciado (o nome do produto). Direciona o foco da câmera. */
  produtoAnunciado?: string;
}): Promise<Analise> {
  const briefings = args.formatos
    .map((f) => `### ${f.key} (${f.duracaoS}s, ${f.temFala ? "COM fala" : "SEM fala"})\n${f.briefing}`)
    .join("\n\n");

  // O nome do produto diz o que está à venda. Se aponta uma peça específica de
  // um look, a câmera gira nela; se descreve o look todo ou é genérico, dirige
  // pela foto normal. O vídeo em si mostra o look inteiro de qualquer jeito.
  const anuncioNota = args.produtoAnunciado
    ? `\n\nO produto anunciado se chama: "${args.produtoAnunciado}". Use isso pra decidir o foco: se a foto mostra um look e esse nome aponta UMA peça específica dele, o "destaque" e o "movement" giram nessa peça; se o nome descreve o look inteiro ou é genérico, dirija pela foto normalmente.`
    : "";

  const resp = await client().models.generateContent({
    model: MODELO,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: args.imagemBase.base64, mimeType: args.imagemBase.mimeType } },
          { text: `${FEW_SHOT}\n\nAgora dirija estes vídeos para a peça da foto acima:${anuncioNota}\n\n${briefings}` },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
      responseJsonSchema: schemaPara(args.formatos),
    },
  });

  const texto = resp.text;
  if (!texto) {
    const motivo = resp.candidates?.[0]?.finishReason ?? "desconhecido";
    throw new Error(`Gemini não devolveu direção (finishReason: ${motivo}).`);
  }

  let analise: Analise;
  try {
    analise = JSON.parse(texto) as Analise;
  } catch {
    throw new Error(`Gemini devolveu algo que não é JSON: ${texto.slice(0, 200)}`);
  }

  if (!analise.descricao_roupa || !analise.videos) {
    throw new Error("Resposta veio fora do formato esperado (sem descricao_roupa/videos).");
  }
  return analise;
}

// --- passo 2: legenda (copy PT-BR) -------------------------------------------

const COPY_SYSTEM = `Você escreve a legenda do post de uma afiliada brasileira que mostra achados de moda — vídeos que ela posta no TikTok Shop, na Shopee e afins. Uma menina de 20 e poucos anos.

Recebe a FOTO da peça e uma descrição dela. Escreve UMA legenda (a mesma serve pros vídeos daquela peça) e as hashtags. Nada de texto na tela.

O que faz uma legenda BOA aqui (siga à risca):

1. TETO RÍGIDO DE 150 CARACTERES pra legenda INTEIRA — descrição + hashtags somadas cabem em 150. Conte. A Shopee corta o que passa. Menos é melhor: prefira sobrar.
2. ANCORE NA PEÇA DA FOTO. Cite algo concreto que dá pra ver — o recorte, o caimento, a cor, o tecido. "Esse look tá com uma vibe chic" é lixo: descreve qualquer roupa. "Esse recorte afina a cintura" vende ESTA peça.
3. Voz informal e real, como quem manda áudio pra amiga. Nada de publicidade formal ("adquira já", "imperdível"). Fecha com um empurrãozinho leve pro link — sem forçar.
4. NÃO INVENTE preço, desconto, marca, tecido ou composição que você não vê na foto. Se não dá pra saber, não fala.
5. EMOJI com parcimônia (0 a 1). Hashtags: 3 a 4, curtas, misturando amplas (#achadinhos #modafeminina) com específicas da peça (#sainhadecouro). Sem "#" na resposta. Elas CONTAM nos 150 caracteres.`;

const COPY_FEW_SHOT = `Exemplo de legenda BOA (cabe em 150 contando as hashtags), para a peça:
"black long sleeve top with a braided cutout at the chest, and a black leather asymmetric mini skirt"

descricao: "esse trançado no decote engana qualquer um, ninguém acredita no preço 🖤 corre no link"
hashtags: [achadinhos, sainhadecouro, modafeminina]

Repare: cita o TRANÇADO e a SAINHA DE COURO — coisas da foto — e o texto todo com as hashtags cabe em 150.`;

const SCHEMA_LEGENDA: JsonSchema = {
  type: "object",
  properties: {
    descricao: { type: "string", description: "Legenda do post, PT-BR, curta. Conta pros 150 caracteres JUNTO com as hashtags." },
    hashtags: { type: "array", items: { type: "string" }, description: 'Hashtags sem o "#" (3 a 4, curtas). Contam no teto de 150. Misture amplas e específicas.' },
  },
  required: ["descricao", "hashtags"],
};

export type Legenda = {
  descricao: string;
  hashtags: string[];
};

/**
 * Passo 2: olha a foto (de novo, direto) e escreve UMA legenda PT-BR ancorada
 * na peça. Separado da direção de propósito — ver o doc no topo do arquivo.
 * Uma legenda por produto, não uma por vídeo — a peça é a mesma.
 */
export async function escreverLegenda(args: {
  imagemBase: { base64: string; mimeType: string };
  descricaoRoupa: string;
  /** O que está sendo anunciado (o nome do produto). Ancora a legenda nele. */
  produtoAnunciado?: string;
  /**
   * O ângulo DESTE clipe (formato + destaque). Existe pra que dois vídeos do
   * mesmo produto não saiam com a mesma legenda — quem posta os dois juntos
   * precisa de descrições diferentes.
   */
  anguloDoVideo?: string;
}): Promise<Legenda> {
  // O nome do produto é o que está à venda — a legenda vende ISSO. Se a foto é
  // um look e o nome é uma peça dele, foca na peça; se é o look todo ou nome
  // genérico, fala do que está na foto. É o ponto do recurso.
  const anuncioNota = args.produtoAnunciado
    ? `\n\nO produto anunciado se chama: "${args.produtoAnunciado}". A legenda deve vender ESSE produto. Se a foto mostra um look e esse nome é uma peça específica dele, foque nela; se o nome descreve o look inteiro ou é genérico, fale do que está na foto.`
    : "";

  // Cada clipe tem seu ângulo — a legenda tem que acompanhar, senão os dois
  // vídeos do mesmo produto saem com a mesma descrição.
  const anguloNota = args.anguloDoVideo
    ? `\n\nEsta legenda é de UM clipe específico deste produto: ${args.anguloDoVideo}. Escreva puxando o gancho DESSE clipe. Ela precisa ficar visivelmente diferente da legenda dos outros clipes do mesmo produto — outro começo, outro ângulo, outras hashtags específicas.`
    : "";

  const resp = await client().models.generateContent({
    model: MODELO,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: args.imagemBase.base64, mimeType: args.imagemBase.mimeType } },
          { text: `${COPY_FEW_SHOT}\n\nA peça da foto: ${args.descricaoRoupa}${anuncioNota}${anguloNota}\n\nAgora escreva a legenda e as hashtags desta peça.` },
        ],
      },
    ],
    config: {
      systemInstruction: COPY_SYSTEM,
      responseMimeType: "application/json",
      responseJsonSchema: SCHEMA_LEGENDA,
      // sobe a temperatura só aqui: variedade entre clipes é o objetivo
      temperature: args.anguloDoVideo ? 1.1 : undefined,
    },
  });

  const texto = resp.text;
  if (!texto) {
    const motivo = resp.candidates?.[0]?.finishReason ?? "desconhecido";
    throw new Error(`Gemini não devolveu legenda (finishReason: ${motivo}).`);
  }

  let legenda: Legenda;
  try {
    legenda = JSON.parse(texto) as Legenda;
  } catch {
    throw new Error(`Legenda veio fora de JSON: ${texto.slice(0, 200)}`);
  }
  if (!legenda.descricao) throw new Error("Legenda veio sem descrição.");
  // Trava de verdade do teto de 150 — o prompt pede, mas modelo conta mal.
  return ajustarLegenda(legenda);
}

// --- costura ------------------------------------------------------------------

/**
 * Rede de segurança do filtro de conteúdo: troca linguagem de CORPO por
 * linguagem de ROUPA antes de mandar pro gerador de vídeo.
 *
 * A regra 7 do SYSTEM já pede isso, mas modelo escorrega — e "touches her chest"
 * somado a uma pessoa fotorrealista na imagem derruba o filtro (o 400
 * "prohibited content"). Aqui é determinístico, não depende do modelo obedecer.
 */
const SUAVIZACOES: [RegExp, string][] = [
  [/\bcleavage\b/gi, "neckline"],
  [/\bbust(?:line)?\b/gi, "neckline"],
  [/\bbreasts?\b/gi, "neckline"],
  [/\bnipples?\b/gi, "fabric"],
  [/\bchest\b/gi, "neckline"],
  [/\bcrotch\b/gi, "hemline"],
  [/\bbuttocks?\b/gi, "back"],
  [/\bbutt\b/gi, "back"],
  [/\bthighs?\b/gi, "hemline"],
  [/\bhips?\b/gi, "waistline"],
  // mão no corpo -> mão no tecido
  [/\b(?:touch(?:es|ing)?|caress(?:es|ing)?|strokes?|runs?\s+(?:her\s+)?hands?\s+over)\s+(?:her\s+)?/gi, "adjusts the fabric near "],
];

/**
 * Traduz o ajuste de visual (a usuária escreve em PT-BR) pra inglês curto de
 * styling. O prompt de vídeo é todo em inglês — texto em português no meio
 * derruba a aderência do gerador.
 *
 * Se a tradução falhar, devolve o original: um ajuste cosmético nunca pode
 * derrubar a geração do vídeo.
 */
export async function traduzirEstilo(texto: string): Promise<string> {
  const limpo = texto.trim();
  if (!limpo) return "";

  try {
    const resp = await client().models.generateContent({
      model: MODELO,
      contents: [
        {
          role: "user",
          parts: [{ text: `Traduza para inglês, como itens curtos de styling separados por vírgula:\n\n${limpo}` }],
        },
      ],
      config: {
        systemInstruction:
          "Você traduz pedidos de visual de PT-BR para inglês curto e objetivo, no vocabulário de moda/beleza (ex.: 'unhas brancas' -> 'white nails'). Responda SÓ com a tradução, sem aspas nem explicação.",
      },
    });
    return resp.text?.trim().replace(/^["']|["']$/g, "") || limpo;
  } catch {
    return limpo;
  }
}

/** Aplica as SUAVIZACOES. Exportada pra ser testável. */
export function suavizarPrompt(texto: string): string {
  let t = texto;
  for (const [re, sub] of SUAVIZACOES) t = t.replace(re, sub);
  return t.replace(/\s{2,}/g, " ").trim();
}

/**
 * Prompt de reserva: só o boilerplate do formato + direção genérica, sem
 * descrição da peça e sem nada que lembre corpo. Vale menos (a direção deixa de
 * ser específica), mas passa onde o detalhado é barrado. Só é usado quando o
 * filtro derruba o principal — ver gerarVideo() em gemini.ts.
 */
export function montarPromptMinimo(args: {
  formato: Formato;
  referencia: string;
  speech?: string;
}): string {
  const linhas = [
    args.formato.boilerplate.replace("{{referencia}}", args.referencia),
    "",
    "FRAMING: medium shot, vertical, the outfit clearly visible.",
    "MOVEMENT: she stands naturally and turns slowly to show the outfit, calm and relaxed.",
    "FOCUS: the overall outfit and the way the fabric falls.",
  ];

  if (args.formato.temFala && args.speech) {
    linhas.push(
      `SPEECH: she says exactly this, spoken aloud in natural Brazilian Portuguese (pt-BR): "${args.speech}"`,
      "Relaxed conversational tone, clear natural lip sync matching the speech, correct pt-BR pronunciation.",
    );
  }

  return linhas.join("\n");
}

/**
 * Junta a direção com o boilerplate fixo do formato. Única função que sabe o
 * formato final do prompt de vídeo. Coberta por tests/prompt-video.test.ts.
 */
export function montarPromptVideo(args: {
  formato: Formato;
  descricaoRoupa: string;
  direcao: { framing: string; movement: string; destaque: string; speech?: string };
  referencia: string;
}): string {
  // tira ponto final duplicado e passa pela rede de segurança do filtro
  const p = (s: string) => suavizarPrompt(s).replace(/\.+$/, "");

  const linhas = [
    args.formato.boilerplate.replace("{{referencia}}", args.referencia),
    "",
    `Outfit: ${p(args.descricaoRoupa)}.`,
    `FRAMING: ${p(args.direcao.framing)}.`,
    `MOVEMENT: ${p(args.direcao.movement)}.`,
    `FOCUS: ${p(args.direcao.destaque)}.`,
  ];

  if (args.formato.temFala && args.direcao.speech) {
    linhas.push(
      `SPEECH: she says exactly this, spoken aloud in natural Brazilian Portuguese (pt-BR): "${args.direcao.speech}"`,
      "Relaxed conversational tone, clear natural lip sync matching the speech, correct pt-BR pronunciation.",
    );
  }

  return linhas.join("\n");
}
