import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod";
import type { Formato } from "@/lib/formatos";

/**
 * Claude: olha a imagem base e escreve a DIREÇÃO de cada vídeo + a copy.
 * Ver PLAN.md §5.
 *
 * Não escreve o prompt inteiro — o boilerplate (referência, negative,
 * constraints) fica em formatos.ts e é costurado depois. O Claude só preenche
 * o que muda de peça pra peça.
 */

export const MODELO = "claude-sonnet-5";

let _client: Anthropic | null = null;

function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Falta ANTHROPIC_API_KEY. Veja .env.example.");
  _client = new Anthropic({ apiKey });
  return _client;
}

const SYSTEM = `Você dirige vídeos UGC de moda para afiliadas do TikTok Shop no Brasil.

Recebe uma foto de uma modelo vestindo uma peça, num closet. Sua função é escrever a DIREÇÃO de cada vídeo pedido — não o prompt inteiro.

Regras que não se quebram:

1. A direção é ESPECÍFICA DAQUELA PEÇA. "natural movement, confident pose" é inútil — descreve qualquer roupa do mundo. Encontre o que essa peça tem de particular (um recorte, o caimento, a textura, uma alça, o comprimento) e dirija o vídeo em torno disso.
2. Escreva framing/movement/destaque em INGLÊS — vão direto pro modelo de vídeo.
3. Escreva a copy em PT-BR informal e natural, do jeito que brasileira de 20 e poucos anos fala no TikTok. Sem publicidade formal, sem "adquira já".
4. NÃO invente preço, desconto, marca, tecido ou composição que você não consegue ver na foto. Se não dá pra saber, não fale.
5. Não repita nas suas respostas nada que já é fixo no prompt (9:16, UGC, iluminação natural, o closet, negative). Isso já está garantido em outro lugar — repetir só atrapalha.
6. A modelo NUNCA segura celular e NUNCA aparece espelho/selfie.`;

/** Exemplo validado na mão pelo Lucas — a régua do que é "boa direção". */
const FEW_SHOT_ENTRADA =
  "black long sleeve top with a braided cutout detail at the chest, and a black leather asymmetric mini skirt";

const FEW_SHOT_SAIDA = `talking:
  framing: close-up, waist up, intimate — talking directly to the camera as if to a friend
  movement: minimal and natural, small hand gestures while speaking, lightly touches the braided cutout detail at the chest while pointing it out
  destaque: the braided cutout at the chest — it reads as a designer detail but the piece is cheap
  speech: "Esse top tem um recorte que ninguém repara que é barato. Olha o detalhe trançado, ficou impecável."

achado_do_dia:
  framing: full body, head to toe, to showcase the full outfit
  movement: walks two steps toward the camera, hits a confident signature opening pose (hand on hip, chin slightly up), does a slow full turn to show the skirt's asymmetric hem and the back of the top, returns to front, finishes on the same signature closing pose
  destaque: the asymmetric wrap hem of the leather skirt, which moves on the turn

nota_1_a_10:
  framing: full body, consecutive angles — front view, then side profile, then back view
  movement: poses front-facing for a beat, quarter turn to the side profile, then full turn to the back, holding each angle briefly like a runway showcase
  destaque: how the cutout top and the leather skirt read as one look from every angle

Repare: cada campo cita ALGO QUE SÓ ESSA PEÇA TEM. É esse o padrão.`;

// --- schema ------------------------------------------------------------------

/**
 * Schema montado a partir dos formatos pedidos, para o structured output
 * exigir exatamente esses e nenhum a mais. Cresce sozinho quando a biblioteca
 * de formatos crescer.
 */
function schemaPara(formatos: Formato[]) {
  const shape: Record<string, z.ZodType> = {};

  for (const f of formatos) {
    const campos: Record<string, z.ZodType> = {
      framing: z.string().describe("Enquadramento, em inglês."),
      movement: z.string().describe("Movimento e o que ela faz com a peça, em inglês."),
      destaque: z.string().describe("O detalhe específico desta peça que o vídeo vende, em inglês."),
      texto_tela: z
        .array(
          z.object({
            t: z.string().describe('Janela em segundos, ex: "0-3s".'),
            texto: z.string().describe("Texto na tela, PT-BR. Pode ter emoji."),
          }),
        )
        .describe("Legendas na tela (CapCut), na ordem."),
      descricao: z.string().describe("Descrição do post, PT-BR, curta."),
      hashtags: z.array(z.string()).describe('Hashtags sem o "#".'),
    };

    if (f.temFala) {
      campos.speech = z
        .string()
        .describe("A fala exata, PT-BR natural, 1 frase curta. É lipsync — escreva pra ser dito, não lido.");
    }

    shape[f.key] = z.object(campos);
  }

  return z.object({
    descricao_roupa: z
      .string()
      .describe("A peça (ou o look) em inglês, com precisão suficiente pra dirigir o vídeo. Só o que dá pra ver."),
    videos: z.object(shape),
  });
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
  const schema = schemaPara(args.formatos);

  const briefings = args.formatos
    .map((f) => `### ${f.key} (${f.duracaoS}s, ${f.temFala ? "COM fala" : "SEM fala"})\n${f.briefing}`)
    .join("\n\n");

  const resp = await client().messages.parse({
    model: MODELO,
    max_tokens: 4096,
    system: SYSTEM,
    output_config: { format: zodOutputFormat(schema) },
    messages: [
      {
        role: "user",
        content: `Exemplo de direção boa, para uma peça descrita como:\n${FEW_SHOT_ENTRADA}\n\n${FEW_SHOT_SAIDA}`,
      },
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: args.imagemBase.mimeType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
              data: args.imagemBase.base64,
            },
          },
          { type: "text", text: `Dirija estes vídeos para a peça da foto:\n\n${briefings}` },
        ],
      },
    ],
  });

  if (resp.stop_reason === "refusal") {
    throw new Error(`Claude recusou: ${resp.stop_details?.explanation ?? "sem detalhe"}`);
  }
  if (resp.stop_reason === "max_tokens") {
    throw new Error("Resposta truncada em max_tokens. Aumente o limite ou reduza os formatos por chamada.");
  }
  if (!resp.parsed_output) {
    throw new Error("Claude respondeu fora do schema.");
  }

  return resp.parsed_output as Analise;
}

// --- costura ------------------------------------------------------------------

/**
 * Junta a direção do Claude com o boilerplate fixo do formato.
 * Esta função é a única que sabe o formato final do prompt de vídeo.
 */
export function montarPromptVideo(args: {
  formato: Formato;
  descricaoRoupa: string;
  direcao: { framing: string; movement: string; destaque: string; speech?: string };
  referencia: string;
}): string {
  const linhas = [
    args.formato.boilerplate.replace("{{referencia}}", args.referencia),
    "",
    `Outfit: ${args.descricaoRoupa}.`,
    `FRAMING: ${args.direcao.framing}.`,
    `MOVEMENT: ${args.direcao.movement}.`,
    `FOCUS: ${args.direcao.destaque}.`,
  ];

  if (args.formato.temFala && args.direcao.speech) {
    linhas.push(
      `SPEECH: she says exactly this, spoken aloud in natural Brazilian Portuguese (pt-BR): "${args.direcao.speech}"`,
      "Relaxed conversational tone, clear natural lip sync matching the speech, correct pt-BR pronunciation.",
    );
  }

  return linhas.join("\n");
}
