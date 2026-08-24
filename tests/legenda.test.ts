import { test } from "node:test";
import assert from "node:assert/strict";
import { ajustarLegenda, textoLegenda, LEGENDA_MAX } from "../src/lib/legenda";

test("legenda curta passa intacta", () => {
  const copy = { descricao: "essa saia cai igual às caras", hashtags: ["achadinhos", "modafeminina"] };
  const r = ajustarLegenda(copy);
  assert.equal(r.descricao, copy.descricao);
  assert.deepEqual(r.hashtags, copy.hashtags);
  assert.ok(textoLegenda(r).length <= LEGENDA_MAX);
});

test("solta hashtags do fim até caber nos 150", () => {
  const copy = {
    descricao: "esse trançado no decote engana qualquer um, ninguém acredita no preço, corre no link antes de esgotar",
    hashtags: ["achadinhos", "modafeminina", "lookdodia", "sainhadecouro", "tiktokshop", "shopeeachados"],
  };
  const r = ajustarLegenda(copy);
  assert.ok(textoLegenda(r).length <= LEGENDA_MAX, `passou de ${LEGENDA_MAX}: ${textoLegenda(r).length}`);
  assert.ok(r.hashtags.length < copy.hashtags.length, "devia ter soltado hashtags");
  // não mexeu na descrição, que sozinha já cabia
  assert.equal(r.descricao, copy.descricao);
});

test("descrição sozinha maior que o teto é cortada em palavra", () => {
  const copy = { descricao: "palavra ".repeat(40).trim(), hashtags: ["x"] };
  const r = ajustarLegenda(copy);
  assert.ok(textoLegenda(r).length <= LEGENDA_MAX);
  assert.ok(!r.descricao.endsWith(" "), "não deve terminar em espaço");
  assert.ok(!r.descricao.includes("  "), "sem corte no meio deixando espaço duplo");
});

test("textoLegenda tolera # já presente e junta descrição + tags", () => {
  const t = textoLegenda({ descricao: "oi", hashtags: ["#achadinhos", "moda"] });
  assert.ok(t.includes("#achadinhos"));
  assert.ok(!t.includes("##"), "não duplica o #");
  assert.ok(t.includes("#moda"));
});
