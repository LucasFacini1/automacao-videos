import { test } from "node:test";
import assert from "node:assert/strict";
import { suavizarPrompt, montarPromptVideo, montarPromptMinimo } from "../src/lib/ia/direcao";
import { FORMATOS, FORMATOS_POR_KEY } from "../src/lib/formatos";

/**
 * O gerador de vídeo barra prompt com linguagem de corpo (400 "prohibited
 * content"). O SYSTEM pede pro modelo evitar, mas isto aqui é a garantia.
 */

const PROIBIDAS = /\b(chest|bust|cleavage|breasts?|nipples?|thighs?|buttocks?|crotch)\b/i;

test("troca partes do corpo por termos de roupa", () => {
  const t = suavizarPrompt("slow push-in to a tight close-up on the chest cutout");
  assert.ok(!PROIBIDAS.test(t), `sobrou termo de corpo: ${t}`);
  assert.match(t, /neckline/);
});

test("mão no corpo vira mão no tecido", () => {
  const t = suavizarPrompt("she lightly touches her chest while speaking");
  assert.ok(!/touches her/i.test(t), `sobrou 'touches her': ${t}`);
  assert.ok(!PROIBIDAS.test(t), `sobrou termo de corpo: ${t}`);
});

test("não mexe em direção que já é de roupa", () => {
  const original = "camera holds on the asymmetric wrap hem of the leather skirt";
  assert.equal(suavizarPrompt(original), original);
});

test("o prompt final montado nunca sai com termo de corpo", () => {
  // mesmo se o modelo devolver direção arriscada, montarPromptVideo suaviza
  const prompt = montarPromptVideo({
    formato: FORMATOS_POR_KEY[FORMATOS[0].key],
    descricaoRoupa: "top with a cutout at the chest",
    direcao: {
      framing: "close-up on her bust",
      movement: "she touches her chest and runs her hands over her thighs",
      destaque: "the cleavage detail",
      speech: "Olha esse acabamento.",
    },
    referencia: "Mia in her closet",
  });
  assert.ok(!PROIBIDAS.test(prompt), `prompt vazou termo de corpo:\n${prompt}`);
});

test("prompt mínimo é neutro e mantém o boilerplate do formato", () => {
  for (const f of FORMATOS) {
    const p = montarPromptMinimo({ formato: f, referencia: "Mia in her closet", speech: "Oi gente." });
    assert.ok(!PROIBIDAS.test(p), `${f.key} vazou termo de corpo`);
    assert.ok(p.includes("Mia in her closet"), `${f.key} perdeu a referência`);
    // formato sem fala não pode ganhar SPEECH nem pelo caminho de reserva
    if (!f.temFala) assert.ok(!p.includes("SPEECH:"), `${f.key} vazou SPEECH`);
  }
});
