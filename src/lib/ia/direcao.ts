import { GoogleGenAI } from "@google/genai";
import type { Formato } from "@/lib/formatos";

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

const SYSTEM = `Você dirige vídeos UGC de moda para afiliadas do TikTok Shop no Brasil.

Recebe uma foto de uma modelo vestindo uma peça, num closet. Sua função é escrever a DIREÇÃO de cada vídeo pedido — não o prompt inteiro.

Regras que não se quebram:

1. A direção é ESPECÍFICA DAQUELA PEÇA. "natural movement, confident pose" é inútil — descreve qualquer roupa do mundo. Encontre o que essa peça tem de particular (um recorte, o caimento, a textura, uma alça, o comprimento) e dirija o vídeo em torno disso.
2. Escreva framing/movement/destaque (e speech quando pedido) em INGLÊS — vão direto pro modelo de vídeo. A ÚNICA exceção é o speech, que é PT-BR.
3. O speech, quando houver, é PT-BR informal e natural, do jeito que brasileira de 20 e poucos anos fala no TikTok. 1 frase curta. Sem publicidade formal, sem "adquira já".
4. NÃO invente preço, desconto, marca, tecido ou composição que você não consegue ver na foto. Se não dá pra saber, não fale.
5. Não repita nas suas respostas nada que já é fixo no prompt (9:16, UGC, iluminação natural, o closet, negative). Isso já está garantido em outro lugar.
6. A modelo NUNCA segura celular e NUNCA aparece espelho/selfie.`;

/** Exemplo validado na mão pelo Lucas — a régua do que é "boa direção". */
const FEW_SHOT = `Exemplo de direção BOA, para uma peça descrita como:
"black long sleeve top with a braided cutout detail at the chest, and a black leather asymmetric mini skirt"

falando:
  framing: close-up, waist up, intimate — talking directly to the camera as if to a friend
  movement: minimal and natural, small hand gestures while speaking, lightly touches the braided cutout detail at the chest while pointing it out
  destaque: the braided cutout at the chest — reads as a designer detail but the piece is cheap
  speech: "Esse top tem um recorte que ninguém repara que é barato. Olha o detalhe trançado, ficou impecável."

desfile:
  framing: full body, head to toe, to showcase the full outfit
  movement: walks a step toward the camera, poses front-facing for a beat, turns to the side profile, then a full turn to the back to show the skirt's asymmetric hem, returns to front
  destaque: the asymmetric wrap hem of the leather skirt, which moves on the turn

detalhe:
  framing: starts mid-body, then a slow push-in to a tight close-up on the chest
  movement: minimal body movement, the camera moves in slowly and holds on the braided cutout
  destaque: the braided texture of the chest cutout — the weave and how it catches the light

Repare: cada campo cita ALGO QUE SÓ ESSA PEÇA TEM. É esse o padrão.`;

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
}): Promise<Analise> {
  const briefings = args.formatos
    .map((f) => `### ${f.key} (${f.duracaoS}s, ${f.temFala ? "COM fala" : "SEM fala"})\n${f.briefing}`)
    .join("\n\n");

  const resp = await client().models.generateContent({
    model: MODELO,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: args.imagemBase.base64, mimeType: args.imagemBase.mimeType } },
          { text: `${FEW_SHOT}\n\nAgora dirija estes vídeos para a peça da foto acima:\n\n${briefings}` },
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

const COPY_SYSTEM = `Você escreve a legenda do post de uma afiliada do TikTok Shop no Brasil — uma menina de 20 e poucos anos que mostra achados de moda.

Recebe a FOTO da peça e uma descrição dela. Escreve UMA legenda pro post (a mesma serve pros vídeos daquela peça) e as hashtags. Nada de texto na tela.

O que faz uma legenda BOA aqui (siga à risca):

1. ANCORE NA PEÇA DA FOTO. Cite algo concreto que dá pra ver — o recorte, o caimento, a cor, o tecido, o comprimento. "Esse look tá com uma vibe chic" é lixo: descreve qualquer roupa. "Esse recorte lateral faz a cintura parecer outra" vende ESTA peça.
2. VOZ REAL de TikTok brasileiro, informal, como quem manda áudio pra amiga. Nada de publicidade formal ("adquira já", "imperdível"). Pode usar "gente", "amiga", "confia".
3. 1 a 2 frases. Fecha com um empurrãozinho leve pro link ou pros comentários — sem forçar.
4. NÃO INVENTE preço, desconto, marca, tecido ou composição que você não vê na foto. Se não dá pra saber, não fala.
5. EMOJI com parcimônia (0 a 1). Hashtags: 4 a 6, misturando amplas (#tiktokshop #achadinhos) com específicas do que a peça é (#bodysuit #sainhadecouro). Sem "#" na resposta.`;

const COPY_FEW_SHOT = `Exemplo de legenda BOA, para a peça:
"black long sleeve top with a braided cutout at the chest, and a black leather asymmetric mini skirt"

descricao: "gente esse trançado no decote engana qualquer um, ninguém acredita no preço 🖤 corre no link antes de esgotar"
hashtags: [tiktokshop, achadinhos, lookdodia, sainhadecouro, modafeminina]

Repare: cita o TRANÇADO e a SAINHA DE COURO — coisas da foto. Não serviria pra outra roupa.`;

const SCHEMA_LEGENDA: JsonSchema = {
  type: "object",
  properties: {
    descricao: { type: "string", description: "Legenda do post, PT-BR, 1-2 frases, fecha com empurrão leve pro link/comentários." },
    hashtags: { type: "array", items: { type: "string" }, description: 'Hashtags sem o "#" (4 a 6). Misture amplas e específicas da peça.' },
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
}): Promise<Legenda> {
  const resp = await client().models.generateContent({
    model: MODELO,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: args.imagemBase.base64, mimeType: args.imagemBase.mimeType } },
          { text: `${COPY_FEW_SHOT}\n\nA peça da foto: ${args.descricaoRoupa}\n\nAgora escreva a legenda e as hashtags desta peça.` },
        ],
      },
    ],
    config: {
      systemInstruction: COPY_SYSTEM,
      responseMimeType: "application/json",
      responseJsonSchema: SCHEMA_LEGENDA,
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
  return legenda;
}

// --- costura ------------------------------------------------------------------

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
  // o modelo às vezes já termina com ponto — evita "hem.." no prompt
  const p = (s: string) => s.trim().replace(/\.+$/, "");

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
