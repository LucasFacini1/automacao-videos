import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Storage. Buckets são criados no setup do Supabase (ver README).
 *
 * `midia` é PRIVADO: guarda o rosto da persona e os vídeos. Nada aqui deve ser
 * servido por URL pública — o dashboard usa signed URL com validade curta.
 */
export const BUCKET = "midia";

export type ImagemInline = { base64: string; mimeType: string };

/** Baixa do storage e devolve em base64, que é o que os SDKs de IA querem. */
export async function baixarInline(db: SupabaseClient, path: string): Promise<ImagemInline> {
  const { data, error } = await db.storage.from(BUCKET).download(path);
  if (error) throw new Error(`Falha ao baixar ${path}: ${error.message}`);

  const buf = Buffer.from(await data.arrayBuffer());
  return { base64: buf.toString("base64"), mimeType: data.type || "image/png" };
}

export async function subirBase64(
  db: SupabaseClient,
  path: string,
  img: ImagemInline,
): Promise<string> {
  const { error } = await db.storage.from(BUCKET).upload(path, Buffer.from(img.base64, "base64"), {
    contentType: img.mimeType,
    upsert: true,
  });
  if (error) throw new Error(`Falha ao subir ${path}: ${error.message}`);
  return path;
}

export async function subirBuffer(
  db: SupabaseClient,
  path: string,
  buf: Buffer,
  contentType: string,
): Promise<string> {
  const { error } = await db.storage.from(BUCKET).upload(path, buf, { contentType, upsert: true });
  if (error) throw new Error(`Falha ao subir ${path}: ${error.message}`);
  return path;
}

/**
 * URL temporária pro dashboard. O bucket é privado — nunca use getPublicUrl.
 *
 * Devolve `null` em vez de lançar. Motivo: assinar falha quase sempre por
 * soluço de rede com o Supabase ("fetch failed" — erro de transporte, não de
 * arquivo faltando), e derrubar a página inteira por causa de UMA thumbnail é o
 * pior jeito de falhar: a usuária perde o acesso aos vídeos que já estão
 * prontos. Todas as telas já tratam null (renderizam placeholder).
 *
 * Tenta algumas vezes antes de desistir, porque o soluço costuma passar.
 */
export async function urlAssinada(
  db: SupabaseClient,
  path: string,
  segundos = 3600,
  /**
   * Nome do arquivo pra FORÇAR download. O atributo `download` do <a> é ignorado
   * quando a URL é de outro domínio (a signed URL é do Supabase), então o
   * browser abria o vídeo em vez de baixar. Com isto o Supabase devolve
   * Content-Disposition: attachment, e aí baixa mesmo.
   */
  nomeDownload?: string,
): Promise<string | null> {
  const TENTATIVAS = 3;

  for (let i = 1; i <= TENTATIVAS; i++) {
    let motivo = "sem URL na resposta";
    try {
      const { data, error } = await db.storage
        .from(BUCKET)
        .createSignedUrl(path, segundos, nomeDownload ? { download: nomeDownload } : undefined);
      if (!error && data?.signedUrl) return data.signedUrl;
      if (error) motivo = error.message;
    } catch (e) {
      // falha de rede pode vir como exceção, não como `error`
      motivo = e instanceof Error ? e.message : String(e);
    }

    if (i === TENTATIVAS) {
      console.warn(`urlAssinada: desisti de ${path} após ${TENTATIVAS} tentativas — ${motivo}`);
      return null;
    }
    await new Promise((r) => setTimeout(r, 150 * i)); // backoff curto
  }

  return null;
}
