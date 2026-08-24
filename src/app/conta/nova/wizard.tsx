"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarConta } from "@/lib/acoes";

/**
 * Setup da conta + persona. Grava de verdade via `criarConta`.
 *
 * DOIS passos de propósito. A antiga terceira etapa (cabelo/maquiagem) saiu: a
 * foto de referência JÁ define rosto, cabelo, make e cenário — descrever isso em
 * texto era redundante e às vezes brigava com a imagem. Ajuste fino de visual
 * agora é na tela da modelo, não no cadastro.
 *
 * A referência é CONGELADA (PLAN.md §3.1) — por isso é um passo deliberado, com
 * aviso, e a foto tem que ser a modelo JÁ no cenário (senão o fundo deriva;
 * lição da sessão em que a "foto do café" fez o closet mudar).
 */
export function Wizard() {
  const [passo, setPasso] = useState(0);
  const [handle, setHandle] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();
  const inputFile = useRef<HTMLInputElement>(null);

  const ULTIMO = 1;
  const podeAvancar = [handle.trim().length > 1, Boolean(arquivo)][passo];

  function escolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setArquivo(f);
    setPreview(URL.createObjectURL(f));
  }

  function salvar() {
    setErro(null);
    iniciar(async () => {
      const fd = new FormData();
      fd.set("handle", handle);
      if (arquivo) fd.set("ref", arquivo);
      try {
        await criarConta(fd); // redireciona pra / em caso de sucesso
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não deu pra criar. Tente de novo.");
      }
    });
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 pb-28 pt-6">
      <div className="mb-6 flex items-center gap-1.5">
        {[0, 1].map((n) => (
          <span
            key={n}
            className={`h-1 flex-1 rounded-full transition-colors ${n <= passo ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>

      {passo === 0 && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Qual é a conta?</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            O perfil onde os vídeos vão ser postados (TikTok, Shopee...).
          </p>
          <div className="mt-6 space-y-2">
            <Label htmlFor="handle">Perfil</Label>
            <div className="flex items-center gap-2 rounded-lg border bg-background pl-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
              <span className="text-muted-foreground">@</span>
              <Input
                id="handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))}
                placeholder="gabi.modafacil"
                className="h-12 border-0 bg-transparent px-0 text-base focus-visible:ring-0"
              />
            </div>
          </div>
        </>
      )}

      {passo === 1 && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">A foto da modelo</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Esta foto é a <strong className="text-foreground">base de todos os vídeos</strong> desta
            conta. Tudo que aparece nela se repete: o rosto, o cabelo, a maquiagem, as unhas — e
            também <strong className="text-foreground">o cenário do fundo</strong>.
          </p>

          <input
            ref={inputFile}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={escolherArquivo}
          />

          {preview ? (
            <div className="mt-6">
              <Image
                src={preview}
                alt="Foto escolhida"
                width={320}
                height={480}
                className="mx-auto w-56 rounded-2xl object-cover object-top ring-1 ring-border"
                unoptimized
              />
              <Button
                variant="ghost"
                className="mx-auto mt-3 block"
                onClick={() => {
                  setArquivo(null);
                  setPreview(null);
                }}
              >
                Escolher outra
              </Button>
            </div>
          ) : (
            <button
              onClick={() => inputFile.current?.click()}
              className="mt-6 flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-card transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-2xl text-primary">
                +
              </span>
              <span className="font-medium">Enviar foto da modelo</span>
              <span className="max-w-[18rem] text-center text-sm text-muted-foreground">
                Ela de corpo inteiro ou da cintura pra cima, de frente, rosto bem visível — e já no
                cenário onde os vídeos vão acontecer.
              </span>
            </button>
          )}

          {/* A referência congela (§3.1). Ela precisa saber ANTES de escolher —
              e que a foto tem que ter o cenário, senão o fundo deriva. */}
          <p className="mt-5 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3.5 py-3 text-sm leading-relaxed text-amber-200">
            <strong>Escolha com calma:</strong> é esta foto que mantém a modelo E o cenário sempre
            iguais em todos os vídeos. Se o fundo dela for a sua sala, todo vídeo vai ser na sala.
            Dá pra trocar depois, mas só na tela da modelo — de propósito.
          </p>

          {erro && <p className="mt-4 text-sm text-destructive">{erro}</p>}
        </>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg gap-2">
          {passo > 0 && (
            <Button
              variant="outline"
              size="lg"
              className="h-12 flex-1"
              disabled={salvando}
              onClick={() => setPasso(passo - 1)}
            >
              Voltar
            </Button>
          )}
          <Button
            size="lg"
            disabled={!podeAvancar || salvando}
            className="h-12 flex-[2] text-base"
            onClick={() => (passo === ULTIMO ? salvar() : setPasso(passo + 1))}
          >
            {salvando ? "Criando..." : passo === ULTIMO ? "Criar conta" : "Continuar"}
          </Button>
        </div>
      </div>
    </main>
  );
}
