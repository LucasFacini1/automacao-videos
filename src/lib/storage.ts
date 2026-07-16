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

/** URL temporária pro dashboard. O bucket é privado — nunca use getPublicUrl. */
export async function urlAssinada(db: SupabaseClient, path: string, segundos = 3600): Promise<string> {
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, segundos);
  if (error) throw new Error(`Falha ao assinar ${path}: ${error.message}`);
  return data.signedUrl;
}
