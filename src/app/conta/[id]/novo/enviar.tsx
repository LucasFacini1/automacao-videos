"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ImagePlus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { criarProduto, criarProdutosEmLote } from "@/lib/acoes";
import { CUSTO_IMAGEM, formatarBRL } from "@/lib/custos";

/**
 * Envio de produto(s). Aceita uma OU várias fotos de uma vez. Cada foto tem UM
 * campo: o que está sendo anunciado (o nome). É esse texto que a legenda vende —
 * se a foto é um look mas você anuncia uma peça, escreva a peça.
 *
 * 1 foto → cai direto na tela da foto (aprovar). Várias → volta pra lista da
 * conta, onde todas aparecem gerando.
 */
type Item = { id: string; file: File; preview: string; nome: string; ajustes: string };

type Tipo = "modelo" | "avulso";

export function Enviar({ contaId }: { contaId: string }) {
  const router = useRouter();
  const inputFile = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState<Tipo>("modelo");
  const [itens, setItens] = useState<Item[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const novos: Item[] = Array.from(e.target.files ?? []).map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      preview: URL.createObjectURL(f),
      nome: f.name.replace(/\.[^.]+$/, "").slice(0, 60),
      ajustes: "",
    }));
    if (novos.length) setItens((xs) => [...xs, ...novos]);
    if (inputFile.current) inputFile.current.value = ""; // permite re-escolher o mesmo arquivo
  }

  function remover(id: string) {
    setItens((xs) => {
      const alvo = xs.find((x) => x.id === id);
      if (alvo) URL.revokeObjectURL(alvo.preview);
      return xs.filter((x) => x.id !== id);
    });
  }

  function atualizar(id: string, campo: "nome" | "ajustes", valor: string) {
    setItens((xs) => xs.map((x) => (x.id === id ? { ...x, [campo]: valor } : x)));
  }

  function enviar() {
    if (itens.length === 0) return;
    setErro(null);
    iniciar(async () => {
      try {
        if (itens.length === 1) {
          const it = itens[0];
          const fd = new FormData();
          fd.set("contaId", contaId);
          fd.set("tipo", tipo);
          fd.set("foto", it.file);
          fd.set("nome", it.nome);
          fd.set("ajustes", it.ajustes);
          const { imagemBaseId } = await criarProduto(fd);
          router.push(`/conta/${contaId}/produto/${imagemBaseId}`);
        } else {
          const fd = new FormData();
          fd.set("contaId", contaId);
          fd.set("tipo", tipo);
          for (const it of itens) {
            fd.append("foto", it.file);
            fd.append("nome", it.nome);
            fd.append("ajustes", it.ajustes);
          }
          await criarProdutosEmLote(fd);
          router.push(`/conta/${contaId}`);
        }
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não deu pra enviar.");
      }
    });
  }

  const total = tipo === "avulso" ? 0 : itens.length * CUSTO_IMAGEM;
  const varios = itens.length > 1;

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-semibold">Novo produto</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tire um print da foto do produto. Pode enviar várias de uma vez.
      </p>

      {/* Escolhe ANTES de tirar a foto — muda o que ela precisa fotografar. */}
      <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-border bg-secondary/40 p-1">
        <button
          type="button"
          onClick={() => setTipo("modelo")}
          className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            tipo === "modelo" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          Com a modelo
        </button>
        <button
          type="button"
          onClick={() => setTipo("avulso")}
          className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            tipo === "avulso" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          Produto avulso
        </button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {tipo === "modelo"
          ? "A modelo veste a peça no vídeo. Envie a foto do produto (o anúncio serve)."
          : "Só a peça, sem ninguém vestindo — no cabide, no manequim ou no chão mesmo. Sem custo de foto: é a sua própria imagem que vira vídeo."}
      </p>

      <input
        ref={inputFile}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={escolher}
      />

      {itens.length === 0 ? (
        <button
          onClick={() => inputFile.current?.click()}
          className="mt-6 flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card/50 transition-colors hover:border-foreground/25 hover:bg-card"
        >
          <span className="flex size-12 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
            <ImagePlus className="size-6" />
          </span>
          <span className="font-medium">Escolher fotos</span>
          <span className="max-w-[17rem] text-center text-sm text-muted-foreground">
            {tipo === "modelo"
              ? "Pode ser só a roupa. Uma ou várias — não precisa cortar nem editar."
              : "A peça sozinha, sem modelo. Uma ou várias — não precisa cortar nem editar."}
          </span>
        </button>
      ) : (
        <div className="mt-6 space-y-3">
          {itens.map((it) => (
            <div key={it.id} className="flex gap-3 rounded-2xl border border-border bg-card p-3">
              <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-secondary">
                <Image src={it.preview} alt="" fill sizes="96px" className="object-cover" unoptimized />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    O que você está anunciando?
                  </label>
                  <Input
                    value={it.nome}
                    onChange={(e) => atualizar(it.id, "nome", e.target.value)}
                    placeholder="Ex.: saia de couro preta"
                    className="mt-1 h-9"
                  />
                </div>
                {tipo === "modelo" && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Mudar algum detalhe do visual? <span className="font-normal">(opcional)</span>
                    </label>
                    <Input
                      value={it.ajustes}
                      onChange={(e) => atualizar(it.id, "ajustes", e.target.value)}
                      placeholder="Ex.: unhas vermelhas, cabelo preso"
                      maxLength={120}
                      className="mt-1 h-9"
                    />
                  </div>
                )}
              </div>
              <button
                onClick={() => remover(it.id)}
                aria-label="Remover foto"
                className="flex size-8 shrink-0 items-center justify-center self-start rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}

          <button
            onClick={() => inputFile.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/50 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
          >
            <Plus className="size-4" /> Adicionar mais fotos
          </button>

          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            <strong className="font-medium text-foreground">Anunciando:</strong> se a foto é um look
            inteiro mas você vende só uma peça, escreva a peça (ex.: “a saia”) — a legenda sai sobre
            ela.
            {tipo === "modelo" && (
              <>
                <br />
                <strong className="font-medium text-foreground">Detalhe do visual:</strong> unha,
                cabelo ou acessório entram já na foto. Rosto e cenário continuam os da modelo.
              </>
            )}
          </p>
        </div>
      )}

      {erro && <p className="mt-4 text-sm text-destructive">{erro}</p>}

      <div className="mt-6 flex items-center justify-between gap-3 rounded-xl bg-secondary/50 px-4 py-3">
        <span className="text-sm text-muted-foreground">
          {tipo === "avulso"
            ? "Custo desta foto"
            : itens.length <= 1
              ? "Custo desta foto"
              : `Custo de ${itens.length} fotos`}
        </span>
        <span className="text-sm font-medium tabular">
          {tipo === "avulso" ? "Sem custo" : formatarBRL(total)}
        </span>
      </div>

      <Button
        size="lg"
        disabled={itens.length === 0 || enviando}
        onClick={enviar}
        className="mt-4 h-12 w-full text-base"
      >
        {enviando ? "Enviando..." : varios ? `Criar ${itens.length} fotos` : "Criar a foto"}
      </Button>
    </main>
  );
}
