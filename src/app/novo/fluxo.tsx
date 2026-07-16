"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { FORMATOS } from "@/lib/formatos";
import { CUSTO_VIDEO, formatarBRL } from "@/lib/mock";

export type Passo = "enviar" | "criando" | "aprovar" | "escolher" | "criando_videos" | "pronto";

const PRODUTO = "/img/produto-3.png";
const BASE = "/img/base-3.png";

/** Legenda pronta que o Claude devolve — aqui falsa, só pra desenhar a tela. */
const COPY_EXEMPLO =
  "Achei esse body de recorte e não acreditei no preço 🖤 O detalhe trançado no busto parece peça de grife.\n\n#lookdodia #achadinhos #modafeminina";

export function Fluxo({ inicial = "enviar" }: { inicial?: Passo }) {
  const [passo, setPasso] = useState<Passo>(inicial);
  const [qtd, setQtd] = useState<Record<string, number>>({ talking: 1 });

  const total = Object.values(qtd).reduce((s, n) => s + n, 0);
  const custo = total * CUSTO_VIDEO;

  function alternar(key: string) {
    setQtd((q) => {
      const novo = { ...q };
      if (novo[key]) delete novo[key];
      else novo[key] = 1;
      return novo;
    });
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 pt-6">
      {/* ---------------------------------------------------------- enviar */}
      {passo === "enviar" && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Novo produto</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tire um print da foto do produto no TikTok Shop e envie aqui.
          </p>

          <button
            onClick={() => setPasso("criando")}
            className="mt-6 flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-card transition-colors hover:border-primary/50 hover:bg-primary/5"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-2xl text-primary">
              +
            </span>
            <span className="font-medium">Escolher foto</span>
            <span className="max-w-[16rem] text-center text-sm text-muted-foreground">
              Pode ser só a roupa. Não precisa cortar nem editar nada.
            </span>
          </button>
        </>
      )}

      {/* --------------------------------------------------------- criando */}
      {passo === "criando" && (
        <div className="flex flex-col items-center pt-8">
          <div className="relative">
            <Image
              src={PRODUTO}
              alt=""
              width={160}
              height={240}
              className="h-60 w-40 rounded-xl object-cover object-top opacity-40 blur-[1px]"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="size-8 animate-spin rounded-full border-[3px] border-primary/25 border-t-primary" />
            </div>
          </div>
          <h1 className="mt-6 text-xl font-semibold">Vestindo a peça...</h1>
          <p className="mt-1 text-sm text-muted-foreground">Leva menos de um minuto.</p>
          <Progress value={62} className="mt-5 h-1.5 w-56" />
          <Button variant="ghost" className="mt-6" onClick={() => setPasso("aprovar")}>
            (demo) pular espera
          </Button>
        </div>
      )}

      {/* --------------------------------------------------------- aprovar */}
      {passo === "aprovar" && (
        <>
          <Badge variant="outline" className="border-primary/20 bg-primary/10 font-normal text-primary">
            Confira antes de virar vídeo
          </Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">A peça ficou igual?</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare com o anúncio. Olhe cor, modelo e alças.
          </p>

          <div className="mt-5 grid grid-cols-[5rem_1fr] gap-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Anúncio</p>
              <Image
                src={PRODUTO}
                alt="Foto do produto no anúncio"
                width={80}
                height={120}
                className="w-full rounded-lg object-cover object-top ring-1 ring-border"
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Sua foto</p>
              <Image
                src={BASE}
                alt="Foto gerada com a peça vestida"
                width={320}
                height={480}
                className="w-full rounded-xl object-cover object-top ring-1 ring-border"
              />
            </div>
          </div>

          <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
            <div className="mx-auto flex max-w-2xl gap-2">
              <Button
                variant="outline"
                size="lg"
                className="h-12 flex-1"
                onClick={() => {
                  toast("Refazendo a foto...");
                  setPasso("criando");
                }}
              >
                Refazer
              </Button>
              <Button size="lg" className="h-12 flex-[2] text-base" onClick={() => setPasso("escolher")}>
                Ficou igual, continuar
              </Button>
            </div>
          </div>
        </>
      )}

      {/* -------------------------------------------------------- escolher */}
      {passo === "escolher" && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Que vídeos você quer?</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pode pedir mais de um do mesmo tipo — sai diferente cada vez.
          </p>

          <ul className="mt-5 space-y-3">
            {FORMATOS.map((f) => {
              const n = qtd[f.key] ?? 0;
              const on = n > 0;
              return (
                <li
                  key={f.key}
                  className={`rounded-xl border p-3.5 transition-colors ${
                    on ? "border-primary/40 bg-primary/5" : "bg-card"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={f.key}
                      checked={on}
                      onCheckedChange={() => alternar(f.key)}
                      className="mt-0.5"
                    />
                    <label htmlFor={f.key} className="min-w-0 flex-1 cursor-pointer">
                      <span className="block font-medium leading-snug">{f.nome}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {f.duracaoS}s · {f.temFala ? "ela fala" : "sem fala"}
                      </span>
                    </label>

                    {on && (
                      <div className="flex shrink-0 items-center gap-1 rounded-lg border bg-background">
                        <button
                          aria-label="Menos um"
                          className="flex size-8 items-center justify-center text-lg text-muted-foreground disabled:opacity-30"
                          disabled={n <= 1}
                          onClick={() => setQtd((q) => ({ ...q, [f.key]: n - 1 }))}
                        >
                          −
                        </button>
                        <span className="w-4 text-center text-sm font-medium tabular-nums">{n}</span>
                        <button
                          aria-label="Mais um"
                          className="flex size-8 items-center justify-center text-lg text-muted-foreground disabled:opacity-30"
                          disabled={n >= 5}
                          onClick={() => setQtd((q) => ({ ...q, [f.key]: n + 1 }))}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
            <div className="mx-auto max-w-2xl">
              <div className="mb-2.5 flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">
                  {total} vídeo{total === 1 ? "" : "s"}
                </span>
                <span className="font-medium tabular-nums">{formatarBRL(custo)}</span>
              </div>
              <Button
                size="lg"
                disabled={total === 0}
                className="h-12 w-full text-base"
                onClick={() => setPasso("criando_videos")}
              >
                Criar {total} vídeo{total === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* -------------------------------------------------- criando_videos */}
      {passo === "criando_videos" && (
        <div className="pt-6">
          <h1 className="text-2xl font-semibold tracking-tight">Criando seus vídeos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Leva alguns minutos. Pode fechar — a gente avisa quando terminar.
          </p>

          <ul className="mt-5 space-y-3">
            {[
              { nome: FORMATOS[0].nome, estado: "pronto" },
              { nome: FORMATOS[1].nome, estado: "criando" },
              { nome: FORMATOS[2].nome, estado: "fila" },
            ].map((v) => (
              <li key={v.nome} className="flex items-center gap-3 rounded-xl border bg-card p-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  {v.estado === "pronto" && <span className="text-emerald-600">✓</span>}
                  {v.estado === "criando" && (
                    <span className="size-4 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
                  )}
                  {v.estado === "fila" && <span className="text-xs text-muted-foreground">···</span>}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{v.nome}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {v.estado === "pronto" ? "pronto" : v.estado === "criando" ? "criando..." : "na fila"}
                </span>
              </li>
            ))}
          </ul>

          <Button variant="ghost" className="mt-6 w-full" onClick={() => setPasso("pronto")}>
            (demo) pular espera
          </Button>
        </div>
      )}

      {/* ---------------------------------------------------------- pronto */}
      {passo === "pronto" && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Prontos 🎉</h1>
          <p className="mt-1 text-sm text-muted-foreground">Baixe e poste com seu link de afiliado.</p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {FORMATOS.map((f) => (
              <div key={f.key} className="overflow-hidden rounded-xl border bg-card">
                <div className="relative aspect-[9/16] bg-muted">
                  <Image src={BASE} alt="" fill className="object-cover object-top" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/15">
                    <span className="flex size-10 items-center justify-center rounded-full bg-white/95 text-sm shadow-sm">
                      ▶
                    </span>
                  </span>
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
                    0:{String(f.duracaoS).padStart(2, "0")}
                  </span>
                </div>
                <div className="p-2.5">
                  <p className="truncate text-xs font-medium">{f.nome}</p>
                  <Button size="sm" variant="outline" className="mt-2 h-8 w-full text-xs">
                    Baixar
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border bg-card p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Legenda pronta</p>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => {
                  navigator.clipboard?.writeText(COPY_EXEMPLO);
                  toast.success("Legenda copiada");
                }}
              >
                Copiar
              </Button>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {COPY_EXEMPLO}
            </p>
          </div>

          <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
            <div className="mx-auto max-w-2xl">
              <Button
                render={<Link href="/" />}
                nativeButton={false}
                size="lg"
                variant="outline"
                className="h-12 w-full"
              >
                Voltar aos produtos
              </Button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
