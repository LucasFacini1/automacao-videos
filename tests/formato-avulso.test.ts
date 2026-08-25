import { test } from "node:test";
import assert from "node:assert/strict";
import { FORMATOS, FORMATOS_AVULSO, FORMATOS_POR_KEY } from "../src/lib/formatos";
import { montarPromptVideo, montarPromptMinimo, suavizarPromptAvulso } from "../src/lib/ia/direcao";

/**
 * Produto avulso (sem modelo): a garantia que mais importa é NUNCA introduzir
 * uma pessoa no prompt de vídeo — nem por acidente, nem se a IA de direção
 * escorregar. Ver SYSTEM_AVULSO em direcao.ts.
 */

const PROIBIDAS_PESSOA = /\b(she|her|woman|model|hand|hands|finger|fingers|chest|hip|hips)\b/i;

/** Só as linhas que vêm da DIREÇÃO — a Negative: lista essas palavras de propósito (é o que ela proíbe). */
function linhasDeDirecao(prompt: string): string {
  return prompt
    .split("\n")
    .filter((l) => /^(Outfit:|FRAMING:|MOVEMENT:|FOCUS:)/.test(l))
    .join("\n");
}

test("chaves de avulso não colidem com as de modelo", () => {
  const modeloKeys = new Set(FORMATOS.map((f) => f.key));
  for (const f of FORMATOS_AVULSO) {
    assert.ok(!modeloKeys.has(f.key), `chave duplicada entre modelo e avulso: ${f.key}`);
  }
});

test("FORMATOS_POR_KEY resolve as duas famílias", () => {
  for (const f of [...FORMATOS, ...FORMATOS_AVULSO]) {
    assert.equal(FORMATOS_POR_KEY[f.key], f);
  }
});

test("nenhum formato avulso tem fala — não tem quem falar", () => {
  for (const f of FORMATOS_AVULSO) {
    assert.equal(f.temFala, false, `${f.key} não devia ter fala`);
  }
});

test("boilerplate avulso não deixa placeholder de referência cru", () => {
  for (const f of FORMATOS_AVULSO) {
    assert.ok(!f.boilerplate.includes("{{referencia}}"), `${f.key} tem placeholder não resolvido`);
  }
});

test("prompt de vídeo avulso nunca menciona pessoa, mesmo se a direção vazar", () => {
  // Direção "suja" de propósito — simula a IA escorregando, igual ao teste
  // equivalente de suavizar-prompt.test.ts pro fluxo com modelo.
  const direcaoSuja = {
    framing: "close-up on her hand touching the fabric",
    movement: "the woman turns slowly to show the garment",
    destaque: "how it looks on her",
  };

  for (const f of FORMATOS_AVULSO) {
    const p = montarPromptVideo({
      formato: f,
      descricaoRoupa: "black satin slip dress on a hanger",
      direcao: direcaoSuja,
      referencia: "the exact garment in the reference image",
      tipo: "avulso",
    });
    const direcaoGerada = linhasDeDirecao(p);
    assert.ok(!PROIBIDAS_PESSOA.test(direcaoGerada), `${f.key} vazou menção a pessoa:\n${direcaoGerada}`);
  }
});

test("suavizarPromptAvulso remove pessoa de frases sujas isoladas", () => {
  assert.ok(!PROIBIDAS_PESSOA.test(suavizarPromptAvulso("close-up on her hand touching the fabric")));
  assert.ok(!PROIBIDAS_PESSOA.test(suavizarPromptAvulso("the woman turns slowly to show the garment")));
  assert.ok(!PROIBIDAS_PESSOA.test(suavizarPromptAvulso("how it looks on her")));
});

test("prompt mínimo (fallback do filtro) é diferente pra avulso — sem 'she'", () => {
  for (const f of FORMATOS_AVULSO) {
    const p = montarPromptMinimo({ formato: f, referencia: "the exact garment in the reference image", tipo: "avulso" });
    const direcaoGerada = linhasDeDirecao(p);
    assert.ok(!PROIBIDAS_PESSOA.test(direcaoGerada), `${f.key} (fallback avulso) vazou menção a pessoa:\n${direcaoGerada}`);
  }
  // sanity check: o fallback de MODELO continua com "she" (comportamento antigo preservado)
  const pModelo = montarPromptMinimo({ formato: FORMATOS[0], referencia: "Mia in her closet" });
  assert.ok(/\bshe\b/i.test(pModelo), "fallback de modelo perdeu a referência à modelo");
});
