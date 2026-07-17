/**
 * Teste isolado da geração da imagem base.
 *
 *   npm run testar:imagem
 *
 * Precisa SÓ da GOOGLE_API_KEY no .env.local. Não toca Supabase, não toca
 * Claude, não gera vídeo.
 *
 * Existe porque este é o maior risco do projeto: se o Nano Banana Pro via API
 * não reproduzir o que o Lucas já valida na mão no Flow, nada mais importa.
 * O script gera a partir de img/persona.png + img/imagem produto 3.png e salva
 * em out/ ao lado da imagem base que ele já aprovou, para comparação direta.
 *
 * Custo: ~R$0,72 por execução.
 */
import { config } from "dotenv";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

// .env.local é a convenção do Next e é o que fica fora do git. Rodando via tsx
// (fora do Next), precisa apontar explícito — `dotenv/config` só leria `.env`.
config({ path: ".env.local" });
import { gerarImagemBase, MODELO_IMAGEM } from "../src/lib/ia/gemini";
import { promptImagemBase } from "../src/lib/prompts";

const PERSONA = "img/persona.png";
const PRODUTO = "img/imagem produto 3.png";
const GABARITO = "img/imagem base 3.png";
const SAIDA = "out/base-gerada.png";

/** Mesma config da conta da tia — bate com o que gerou o gabarito. */
const CONFIG = {
  cenario: "modern walk-in closet",
  cabelo: "long, straight, light brown",
  make: "natural, soft",
  unhas: "light",
};

function inline(caminho: string) {
  if (!existsSync(caminho)) throw new Error(`Não achei ${caminho}`);
  return {
    base64: readFileSync(caminho).toString("base64"),
    mimeType: caminho.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
  };
}

async function main() {
  if (!process.env.GOOGLE_API_KEY) {
    console.error("Falta GOOGLE_API_KEY no .env.local.");
    console.error("Pegue em https://aistudio.google.com/apikey");
    process.exit(1);
  }

  const prompt = promptImagemBase(CONFIG);

  console.log(`modelo:  ${MODELO_IMAGEM}`);
  console.log(`persona: ${PERSONA}`);
  console.log(`produto: ${PRODUTO}`);
  console.log(`\n--- prompt ---\n${prompt}\n--------------\n`);
  console.log("gerando... (~R$0,72)");

  const t0 = Date.now();
  const img = await gerarImagemBase({
    prompt,
    persona: inline(PERSONA),
    produto: inline(PRODUTO),
  });
  const seg = ((Date.now() - t0) / 1000).toFixed(1);

  mkdirSync("out", { recursive: true });
  writeFileSync(SAIDA, Buffer.from(img.base64, "base64"));

  console.log(`\npronto em ${seg}s -> ${SAIDA}\n`);
  console.log("Agora compare, lado a lado:");
  console.log(`  gerada agora:      ${SAIDA}`);
  console.log(`  que você aprovou:  ${GABARITO}`);
  console.log("\nOlhe nesta ordem:");
  console.log("  1. É a mesma pessoa? (rosto, cabelo)");
  console.log("  2. É o mesmo closet? (estante, perfumes, janela)");
  console.log("  3. A peça está fiel? (o body de recorte + saia de couro)");
  console.log("  4. Inventou acessório que não existe no produto?");
  console.log("\nSe 1 e 2 baterem, a API reproduz o Flow e o resto é ligar fio.");
  console.log("Se não baterem, o prompt precisa de ajuste antes de qualquer outra coisa.");
}

main().catch((e) => {
  console.error(`\nfalhou: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
