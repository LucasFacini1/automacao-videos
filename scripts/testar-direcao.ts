/**
 * Testa o passo de direção + copy (Gemini Flash-Lite) contra uma imagem base.
 *
 *   npm run testar:direcao
 *
 * Precisa só da GOOGLE_API_KEY. Custa centavos (~R$0,02).
 *
 * O que olhar: a direção cita algo que SÓ essa peça tem? Se sair "natural
 * movement, confident pose", o modelo não está enxergando/aproveitando a foto.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync, existsSync } from "node:fs";
import { analisarImagemBase, montarPromptVideo, MODELO } from "../src/lib/ia/direcao";
import { FORMATOS } from "../src/lib/formatos";

const BASE = process.argv[2] ?? "img/imagem base 3.png";

async function main() {
  if (!process.env.GOOGLE_API_KEY) {
    console.error("Falta GOOGLE_API_KEY no .env.local.");
    process.exit(1);
  }
  if (!existsSync(BASE)) {
    console.error(`Não achei ${BASE}`);
    process.exit(1);
  }

  console.log(`modelo: ${MODELO}`);
  console.log(`imagem: ${BASE}\n`);
  console.log("analisando...\n");

  const t0 = Date.now();
  const a = await analisarImagemBase({
    imagemBase: { base64: readFileSync(BASE).toString("base64"), mimeType: "image/png" },
    formatos: FORMATOS,
  });
  console.log(`(${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);

  console.log("=".repeat(72));
  console.log("PEÇA:", a.descricao_roupa);
  console.log("=".repeat(72));

  for (const f of FORMATOS) {
    const v = a.videos[f.key] as Record<string, unknown> | undefined;
    if (!v) {
      console.log(`\n[${f.key}] FALTOU na resposta`);
      continue;
    }
    console.log(`\n### ${f.nome}`);
    console.log(`  destaque: ${v.destaque}`);
    if (v.speech) console.log(`  fala:     "${v.speech}"`);
    console.log(`  legenda:  ${(v.texto_tela as { t: string; texto: string }[] ?? []).map((l) => `[${l.t}] ${l.texto}`).join(" | ")}`);
    console.log(`  post:     ${v.descricao}`);
    console.log(`  hashtags: ${(v.hashtags as string[] ?? []).map((h) => "#" + h).join(" ")}`);
  }

  // prompt final de um formato, pra conferir a costura
  const f0 = FORMATOS[0];
  const d0 = a.videos[f0.key] as { framing: string; movement: string; destaque: string; speech?: string };
  console.log("\n" + "=".repeat(72));
  console.log(`PROMPT FINAL (${f0.nome}) — o que vai pro gerador de vídeo:`);
  console.log("=".repeat(72));
  console.log(
    montarPromptVideo({
      formato: f0,
      descricaoRoupa: a.descricao_roupa,
      direcao: d0,
      referencia: "the woman in the reference image, in her usual closet",
    }),
  );
}

main().catch((e) => {
  console.error(`\nfalhou: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
