import { test } from "node:test";
import assert from "node:assert/strict";
import { FORMATOS, FORMATOS_POR_KEY } from "../src/lib/formatos";
import { montarPromptVideo } from "../src/lib/ia/claude";

const DIRECAO = {
  framing: "close-up, waist up",
  movement: "small hand gestures, touches the braided cutout",
  destaque: "the braided cutout at the chest",
  speech: "Esse top tem um recorte que ninguém repara que é barato.",
};

const ROUPA = "black long sleeve top with a braided cutout, black leather mini skirt";

function montar(key: keyof typeof FORMATOS_POR_KEY) {
  return montarPromptVideo({
    formato: FORMATOS_POR_KEY[key],
    descricaoRoupa: ROUPA,
    direcao: DIRECAO,
    referencia: "Mia in her closet",
  });
}

test("formato sem fala descarta o speech mesmo se vier preenchido", () => {
  // O Claude pode devolver speech por engano. Se vazar num formato mudo,
  // o vídeo sai com ela falando quando não devia.
  for (const f of FORMATOS.filter((f) => !f.temFala)) {
    const p = montar(f.key);
    assert.ok(!p.includes("SPEECH:"), `${f.key} vazou SPEECH`);
    assert.ok(!p.includes(DIRECAO.speech), `${f.key} vazou a fala`);
  }
});

test("formato com fala inclui o speech literal", () => {
  const p = montar("talking");
  assert.ok(p.includes("SPEECH:"));
  assert.ok(p.includes(DIRECAO.speech));
  assert.ok(p.includes("pt-BR"));
});

test("negative bloqueia inglês quando tem fala, e fala quando é mudo", () => {
  assert.ok(montar("talking").includes("English speech"));

  for (const f of FORMATOS.filter((f) => !f.temFala)) {
    const p = montar(f.key);
    assert.ok(p.includes("audible speech"), `${f.key} não bloqueia áudio de fala`);
    assert.ok(!p.includes("English speech"), `${f.key} bloqueou inglês à toa`);
  }
});

test("todo formato carrega o negative base e as constraints fixas", () => {
  for (const f of FORMATOS) {
    const p = montar(f.key);
    for (const trecho of ["changed face", "different person", "phone in hand", "watermark"]) {
      assert.ok(p.includes(trecho), `${f.key} perdeu "${trecho}" do negative`);
    }
    assert.ok(p.includes("9:16"), `${f.key} perdeu o 9:16`);
    assert.ok(p.includes(`~${f.duracaoS}s`), `${f.key} perdeu a duração`);
  }
});

test("a referência é substituída, não deixa o placeholder no prompt", () => {
  for (const f of FORMATOS) {
    const p = montar(f.key);
    assert.ok(!p.includes("{{referencia}}"), `${f.key} deixou o placeholder cru`);
    assert.ok(p.includes("Mia in her closet"), `${f.key} não injetou a referência`);
  }
});

test("a descrição da roupa entra no prompt", () => {
  for (const f of FORMATOS) {
    assert.ok(montar(f.key).includes(ROUPA), `${f.key} não injetou a roupa`);
  }
});

test("as chaves dos formatos são únicas", () => {
  const keys = FORMATOS.map((f) => f.key);
  assert.equal(new Set(keys).size, keys.length);
});
