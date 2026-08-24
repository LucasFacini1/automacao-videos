import { GoogleGenAI, Modality } from "@google/genai";
import { ErroSemRetentar } from "@/lib/erros";

/**
 * Google AI: imagem base (Nano Banana Pro) e vídeo (Veo 3.1 Fast ou Omni Flash).
 * Ver PLAN.md §2.
 */

export const MODELO_IMAGEM = "gemini-3-pro-image"; // Nano Banana Pro

// Dois backends de vídeo, trocáveis por env (VIDEO_BACKEND=veo|omni).
//
// veo  (PADRÃO): veo-3.1-fast. Assíncrono (polling), 1080p, e — o que importa
//      aqui — tem `personGeneration: "allow_adult"`, o opt-in explícito pra
//      gerar vídeo com PESSOA na imagem de entrada. A persona é uma pessoa,
//      então sem esse opt-in o filtro barra.
// omni: gemini-omni-flash-preview, via Interactions API. Síncrono e mais
//      simples (mp4 inline), mas 720p e SEM equivalente de personGeneration —
//      na prática o filtro bloqueia a persona com 400 "prohibited content".
export const MODELO_VIDEO_VEO = "veo-3.1-fast-generate-preview";
export const MODELO_VIDEO_OMNI = "gemini-omni-flash-preview";

// Padrão: omni (escolha do dono do projeto). VIDEO_BACKEND=veo troca pro Veo.
export const BACKEND_VIDEO: "veo" | "omni" =
  (process.env.VIDEO_BACKEND ?? "").toLowerCase() === "veo" ? "veo" : "omni";

export const MODELO_VIDEO = BACKEND_VIDEO === "omni" ? MODELO_VIDEO_OMNI : MODELO_VIDEO_VEO;

/** Mensagem que a usuária final vê quando o filtro barra. Sem jargão. */
const MSG_FILTRO = "O gerador de vídeo barrou esta foto no filtro de conteúdo. Tente refazer a foto ou peça outro formato.";

/**
 * Bloqueio de conteúdo é determinístico: a mesma foto+prompt barra sempre.
 * Retentar só queima tempo (e as 3 tentativas) pra falhar igual — por isso vira
 * ErroSemRetentar.
 *
 * CUIDADO com o que entra aqui. A primeira versão casava com /safety/ e passou a
 * classificar o 400 de `safety_settings` (erro de PARÂMETRO) como bloqueio de
 * conteúdo — o log dizia "filtro barrou" e escondia um bug de configuração, com
 * a usuária vendo "sua foto foi barrada". Erro de config tem que aparecer como
 * erro de config. Por isso a lista de exclusão vem primeiro.
 */
export function ehBloqueioDeConteudo(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);

  // erro de parâmetro/payload NUNCA é bloqueio de conteúdo
  if (/is not available on the Gemini API|Unknown name|Invalid JSON payload|Invalid value|invalid argument/i.test(msg)) {
    return false;
  }

  return /prohibited content|blocked due to|content polic|safety filter|violat\w*\s+\w*\s*polic/i.test(msg);
}

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
    // Recusa de safety ou filtro devolve 200 com texto, não erro HTTP. É
    // determinístico — a mesma foto barra sempre, então não adianta retentar.
    const texto = parts.find((p) => p.text)?.text;
    const motivo = resp.candidates?.[0]?.finishReason ?? "desconhecido";
    throw new ErroSemRetentar(
      `Nano Banana não devolveu imagem. ${texto ? `Modelo disse: ${texto}` : `finishReason: ${motivo}`}`,
      "A foto do produto foi barrada pelo filtro do gerador. Tente enviar outra imagem do produto (sem pessoas, sem marca d'água).",
    );
  }

  return {
    base64: img.inlineData.data,
    mimeType: img.inlineData.mimeType ?? "image/png",
  };
}

// --- vídeo -------------------------------------------------------------------

export type VideoGerado = { video: Buffer; mimeType: string };

/**
 * Gera um clipe a partir da imagem base. Despacha pro backend escolhido em
 * VIDEO_BACKEND e normaliza o retorno (Buffer), pra o worker não saber a
 * diferença entre um e outro.
 */
export async function gerarVideo(args: {
  prompt: string;
  /** Versão neutra, sem descrição de corpo/peça. Usada se o filtro barrar. */
  promptFallback?: string;
  imagemBase: ImagemInline;
  duracaoS: number;
  onProgresso?: (tentativa: number) => void;
}): Promise<VideoGerado> {
  const gerar = (prompt: string) =>
    BACKEND_VIDEO === "omni"
      ? gerarVideoOmni({ ...args, prompt })
      : gerarVideoVeo({ ...args, prompt });

  try {
    return await gerar(args.prompt);
  } catch (e) {
    // ErroSemRetentar aqui = filtro de conteúdo. Retentar o MESMO prompt seria
    // inútil (determinístico), mas um prompt diferente é outra requisição — e a
    // versão neutra costuma passar. Uma tentativa só, e avisa no log.
    if (e instanceof ErroSemRetentar && args.promptFallback) {
      console.warn(`  filtro barrou o prompt detalhado; tentando a versão neutra...`);
      return await gerar(args.promptFallback);
    }
    throw e;
  }
}

/**
 * Veo 3.1 Fast (padrão). Assíncrono: devolve uma operação e a gente faz polling
 * — é por isso que o worker existe separado do Next.
 */
async function gerarVideoVeo(args: {
  prompt: string;
  imagemBase: ImagemInline;
  duracaoS: number;
  onProgresso?: (tentativa: number) => void;
}): Promise<VideoGerado> {
  const INTERVALO_MS = 10_000;
  const MAX_ESPERA_MS = 10 * 60_000;

  let op;
  try {
    op = await client().models.generateVideos({
      model: MODELO_VIDEO_VEO,
      prompt: args.prompt,
      image: { imageBytes: args.imagemBase.base64, mimeType: args.imagemBase.mimeType },
      config: {
        numberOfVideos: 1,
        durationSeconds: args.duracaoS,
        aspectRatio: "9:16",
        resolution: "1080p",
        // OPT-IN da pessoa. A persona é uma pessoa na imagem de entrada; sem
        // isto o Veo barra a geração no filtro. Aceito no Developer API.
        personGeneration: "allow_adult",
        // `generateAudio` NÃO existe no Developer API — o SDK lança só de a
        // chave estar presente, mesmo valendo false. Áudio sai sempre; o mudo
        // dos formatos sem voz é feito no worker (ffmpeg).
      },
    });
  } catch (e) {
    if (ehBloqueioDeConteudo(e)) {
      throw new ErroSemRetentar(`Veo bloqueou a entrada: ${e instanceof Error ? e.message : String(e)}`, MSG_FILTRO);
    }
    throw e;
  }

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
    throw new Error(`Veo falhou: ${op.error.message ?? JSON.stringify(op.error)}`);
  }

  const uri = op.response?.generatedVideos?.[0]?.video?.uri;
  if (!uri) {
    // Terminou sem vídeo = filtro de conteúdo (RAI). Determinístico: não retenta.
    const resp = op.response as { raiMediaFilteredReasons?: string[] } | undefined;
    const motivos = resp?.raiMediaFilteredReasons?.join("; ");
    throw new ErroSemRetentar(
      `Veo terminou sem vídeo (filtro de conteúdo). ${motivos ?? "Sem detalhe do motivo."}`,
      MSG_FILTRO,
    );
  }

  // A URI do Gemini é temporária e exige a chave. Baixa aqui pra normalizar o
  // retorno com o Omni (que já devolve o mp4 inline).
  const resp = await fetch(`${uri}&key=${process.env.GOOGLE_API_KEY}`);
  if (!resp.ok) throw new Error(`Falha ao baixar o vídeo (${resp.status}).`);
  return { video: Buffer.from(await resp.arrayBuffer()), mimeType: "video/mp4" };
}

/**
 * Omni Flash via Interactions API. Síncrono: devolve o mp4 inline (base64), sem
 * polling. 720p, e SEM opt-in de pessoa — por isso costuma bater no filtro com
 * a persona. Fica aqui pra reteste quando/se a API abrir esse caso.
 */
async function gerarVideoOmni(args: {
  prompt: string;
  imagemBase: ImagemInline;
}): Promise<VideoGerado> {
  let interacao;
  try {
    interacao = await client().interactions.create({
      model: MODELO_VIDEO_OMNI,
      input: [
        { type: "image", data: args.imagemBase.base64, mime_type: args.imagemBase.mimeType },
        { type: "text", text: args.prompt },
      ],
      // delivery "inline" = mp4 volta em base64 no output_video.data (sem fetch).
      response_format: { type: "video", aspect_ratio: "9:16", delivery: "inline" },
      generation_config: { video_config: { task: "image_to_video" } },
      // NÃO passar `safety_settings` aqui: o tipo existe no SDK, mas o Developer
      // API rejeita com 400 ("not available on the Gemini API, but it is
      // available on the Gemini Enterprise Agent Platform"). Só Vertex aceita.
      // Ou seja: não há alavanca de safety configurável neste caminho.
    });
  } catch (e) {
    if (ehBloqueioDeConteudo(e)) {
      throw new ErroSemRetentar(
        `Omni Flash bloqueou a entrada: ${e instanceof Error ? e.message : String(e)}`,
        MSG_FILTRO,
      );
    }
    throw e;
  }

  const video = interacao.output_video;
  if (!video?.data) {
    const texto = interacao.output_text;
    throw new ErroSemRetentar(
      `Omni Flash não devolveu vídeo. ${texto ? `Modelo disse: ${texto}` : "Sem detalhe do motivo."}`,
      MSG_FILTRO,
    );
  }

  return { video: Buffer.from(video.data, "base64"), mimeType: video.mime_type ?? "video/mp4" };
}
