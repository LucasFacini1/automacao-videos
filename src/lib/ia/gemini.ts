import { GoogleGenAI, Modality } from "@google/genai";

/**
 * Google AI: imagem base (Nano Banana Pro) e vídeo (Omni Flash).
 * Ver PLAN.md §2.
 */

export const MODELO_IMAGEM = "gemini-3-pro-image"; // Nano Banana Pro
// Veo 3.1 Fast: o modelo de vídeo da API (o "Omni Flash" do Flow NÃO é
// gerador de vídeo pela API — só faz generateContent). Fast ~$0,10/s.
export const MODELO_VIDEO = "veo-3.1-fast-generate-preview";

let _client: GoogleGenAI | null = null;

function client(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Falta GOOGLE_API_KEY. Veja .env.example.");
  _client = new GoogleGenAI({ apiKey });
  return _client;
}

export type ImagemInline = { base64: string; mimeType: string };

// --- imagem base -------------------------------------------------------------

/**
 * Veste a persona (ref) com o produto, no cenário padrão.
 *
 * Nano Banana Pro é um modelo Gemini, não Imagen — então a chamada é
 * `generateContent` com `responseModalities: [IMAGE]`, e NÃO `generateImages()`
 * (que é a API do Imagen e não aceita duas imagens de referência).
 *
 * A ordem das imagens importa: o prompt fala em "Reference 1" (persona) e
 * "Reference 2" (produto), então elas vão nessa ordem nas parts.
 */
export async function gerarImagemBase(args: {
  prompt: string;
  persona: ImagemInline;
  produto: ImagemInline;
}): Promise<ImagemInline> {
  const resp = await client().models.generateContent({
    model: MODELO_IMAGEM,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: args.persona.base64, mimeType: args.persona.mimeType } },
          { inlineData: { data: args.produto.base64, mimeType: args.produto.mimeType } },
          { text: args.prompt },
        ],
      },
    ],
    config: {
      responseModalities: [Modality.IMAGE],
      imageConfig: { aspectRatio: "9:16", imageSize: "1K" },
    },
  });

  const parts = resp.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p) => p.inlineData?.data);

  if (!img?.inlineData?.data) {
    // Recusa de safety ou filtro devolve 200 com texto, não erro HTTP.
    const texto = parts.find((p) => p.text)?.text;
    throw new Error(
      `Nano Banana não devolveu imagem. ${texto ? `Modelo disse: ${texto}` : `finishReason: ${resp.candidates?.[0]?.finishReason ?? "desconhecido"}`}`,
    );
  }

  return {
    base64: img.inlineData.data,
    mimeType: img.inlineData.mimeType ?? "image/png",
  };
}

// --- vídeo -------------------------------------------------------------------

/**
 * Gera um clipe a partir da imagem base.
 *
 * É assíncrono: devolve uma operação e a gente faz polling. É exatamente por
 * isso que o worker existe separado do Next — não cabe em serverless.
 */
export async function gerarVideo(args: {
  prompt: string;
  imagemBase: ImagemInline;
  duracaoS: number;
  onProgresso?: (tentativa: number) => void;
}): Promise<{ uri: string }> {
  const INTERVALO_MS = 10_000;
  const MAX_ESPERA_MS = 10 * 60_000;

  let op = await client().models.generateVideos({
    model: MODELO_VIDEO,
    prompt: args.prompt,
    image: { imageBytes: args.imagemBase.base64, mimeType: args.imagemBase.mimeType },
    config: {
      numberOfVideos: 1,
      durationSeconds: args.duracaoS,
      aspectRatio: "9:16",
    },
  });

  const limite = Date.now() + MAX_ESPERA_MS;
  let tentativa = 0;

  while (!op.done) {
    if (Date.now() > limite) {
      throw new Error(`Geração passou de ${MAX_ESPERA_MS / 60_000}min sem terminar.`);
    }
    await new Promise((r) => setTimeout(r, INTERVALO_MS));
    tentativa++;
    args.onProgresso?.(tentativa);
    op = await client().operations.getVideosOperation({ operation: op });
  }

  if (op.error) {
    throw new Error(`Omni Flash falhou: ${op.error.message ?? JSON.stringify(op.error)}`);
  }

  const uri = op.response?.generatedVideos?.[0]?.video?.uri;
  if (!uri) throw new Error("Operação terminou sem vídeo. Provável filtro de conteúdo.");

  return { uri };
}
