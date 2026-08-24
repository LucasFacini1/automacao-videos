import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { writeFile, readFile, unlink } from "node:fs/promises";
import ffmpegPath from "ffmpeg-static";

/**
 * Remove a trilha de áudio de um MP4, sem recodificar o vídeo (`-c copy -an`),
 * então é rápido e não perde qualidade.
 *
 * Por que existe: no Gemini Developer API o Veo 3.1 SEMPRE gera áudio e não há
 * toggle (ver ia/gemini.ts). Os formatos "sem voz" saíam com ruído/voz estranha,
 * então emudecemos aqui, no worker.
 *
 * Falha-segura: se o ffmpeg não estiver disponível ou der erro, devolve o buffer
 * original (com áudio). Emudecer é desejável — travar a entrega do vídeo, não.
 */
export async function removerAudio(buf: Buffer): Promise<Buffer> {
  if (!ffmpegPath) {
    console.warn("  ffmpeg-static não encontrado — subindo vídeo com áudio.");
    return buf;
  }

  const base = join(tmpdir(), `mudo-${randomUUID()}`);
  const entrada = `${base}-in.mp4`;
  const saida = `${base}-out.mp4`;

  try {
    await writeFile(entrada, buf);
    await new Promise<void>((resolve, reject) => {
      const p = spawn(ffmpegPath as string, ["-y", "-i", entrada, "-c", "copy", "-an", saida]);
      let err = "";
      p.stderr.on("data", (d) => (err += d));
      p.on("error", reject);
      p.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error(`ffmpeg saiu ${code}: ${err.slice(-300)}`)),
      );
    });
    return await readFile(saida);
  } catch (e) {
    console.warn(`  não deu pra emudecer, subindo com áudio: ${e instanceof Error ? e.message : e}`);
    return buf;
  } finally {
    await unlink(entrada).catch(() => {});
    await unlink(saida).catch(() => {});
  }
}
