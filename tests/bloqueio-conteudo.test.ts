import { test } from "node:test";
import assert from "node:assert/strict";
import { ehBloqueioDeConteudo } from "../src/lib/ia/gemini";

/**
 * Regressão real: a primeira versão casava com /safety/ e classificava o 400 de
 * `safety_settings` (erro de PARÂMETRO) como bloqueio de conteúdo. Resultado: o
 * log dizia "filtro barrou o prompt" e a usuária veria "sua foto foi barrada",
 * escondendo um bug de configuração. Erro de config precisa aparecer como tal.
 */

test("erro de parâmetro NÃO é bloqueio de conteúdo", () => {
  const e = new Error(
    "400 The parameter 'safety_settings' is not available on the Gemini API but it is available on the Gemini Enterprise Agent Platform.",
  );
  assert.equal(ehBloqueioDeConteudo(e), false);
});

test("outros erros de payload também não são bloqueio de conteúdo", () => {
  for (const msg of [
    "400 Invalid JSON payload received. Unknown name 'foo'.",
    "400 Invalid value at 'config.resolution'",
    "INVALID_ARGUMENT: bad request",
  ]) {
    assert.equal(ehBloqueioDeConteudo(new Error(msg)), false, `classificou errado: ${msg}`);
  }
});

test("bloqueio de conteúdo de verdade é reconhecido", () => {
  for (const msg of [
    "400 Request blocked due to prohibited content guidelines. Please modify your input and retry.",
    "Blocked due to content policy violation",
    "The request was blocked by the safety filter",
  ]) {
    assert.equal(ehBloqueioDeConteudo(new Error(msg)), true, `não reconheceu: ${msg}`);
  }
});

test("erro genérico de rede não vira bloqueio de conteúdo", () => {
  assert.equal(ehBloqueioDeConteudo(new Error("fetch failed: ECONNRESET")), false);
});
