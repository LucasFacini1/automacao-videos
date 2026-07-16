"use client";

import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Setup da conta + persona.
 *
 * A referência da persona é CONGELADA (ver PLAN.md §3.1) — por isso este é um
 * passo deliberado, com aviso, e não algo que o sistema escolhe sozinho a cada
 * produto. Trocar depois é ação consciente, aqui.
 */

const CABELOS = ["Liso, castanho claro, comprido", "Ondulado, castanho, comprido", "Liso, preto, médio"];
const MAKES = ["Natural, leve", "Glow, iluminada", "Marcada, olho esfumado"];

export function Wizard() {
  const [passo, setPasso] = useState(0);
  const [handle, setHandle] = useState("");
  const [ref, setRef] = useState<string | null>(null);
  const [cabelo, setCabelo] = useState(CABELOS[0]);
  const [make, setMake] = useState(MAKES[0]);

  const podeAvancar = [handle.trim().length > 1, Boolean(ref), true][passo];

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 pb-28 pt-6">
      <div className="mb-6 flex items-center gap-1.5">
        {[0, 1, 2].map((n) => (
          <span
            key={n}
            className={`h-1 flex-1 rounded-full transition-colors ${
              n <= passo ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* ------------------------------------------------------ 0: a conta */}
      {passo === 0 && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Qual é a conta?</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            O perfil do TikTok onde os vídeos vão ser postados.
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

      {/* --------------------------------------------------- 1: a modelo */}
      {passo === 1 && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Escolha a modelo</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Ela vai ser o rosto dessa conta em todos os vídeos.
          </p>

          {ref ? (
            <div className="mt-6">
              <Image
                src={ref}
                alt="Foto escolhida como modelo"
                width={320}
                height={480}
                className="mx-auto w-56 rounded-2xl object-cover object-top ring-1 ring-border"
              />
              <Button variant="ghost" className="mx-auto mt-3 block" onClick={() => setRef(null)}>
                Escolher outra
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setRef("/img/persona.png")}
              className="mt-6 flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-card transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-2xl text-primary">
                +
              </span>
              <span className="font-medium">Enviar foto da modelo</span>
              <span className="max-w-[17rem] text-center text-sm text-muted-foreground">
                Uma foto nítida, de frente, rosto bem visível.
              </span>
            </button>
          )}

          {/* A referência congela (PLAN.md §3.1). Ela precisa saber disso ANTES
              de escolher, não depois de 20 produtos com o rosto derretendo. */}
          <p className="mt-5 rounded-lg bg-muted px-3.5 py-3 text-sm leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Escolha com calma.</strong> Todas as fotos dessa
            conta vão ser feitas a partir dessa aqui, então é ela que mantém a modelo sempre igual.
            Dá pra trocar depois, mas só nesta tela — de propósito.
          </p>
        </>
      )}

      {/* ---------------------------------------------------- 2: o visual */}
      {passo === 2 && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">O visual dela</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Isso se repete em todo vídeo, pra não mudar do nada.
          </p>

          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label>Cabelo</Label>
              <div className="space-y-2">
                {CABELOS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCabelo(c)}
                    className={`w-full rounded-lg border px-3.5 py-3 text-left text-sm transition-colors ${
                      cabelo === c ? "border-primary/40 bg-primary/5 font-medium" : "bg-card"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Maquiagem</Label>
              <div className="space-y-2">
                {MAKES.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMake(m)}
                    className={`w-full rounded-lg border px-3.5 py-3 text-left text-sm transition-colors ${
                      make === m ? "border-primary/40 bg-primary/5 font-medium" : "bg-card"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg gap-2">
          {passo > 0 && (
            <Button variant="outline" size="lg" className="h-12 flex-1" onClick={() => setPasso(passo - 1)}>
              Voltar
            </Button>
          )}
          <Button
            size="lg"
            disabled={!podeAvancar}
            className="h-12 flex-[2] text-base"
            onClick={() => setPasso(Math.min(2, passo + 1))}
          >
            {passo === 2 ? "Criar conta" : "Continuar"}
          </Button>
        </div>
      </div>
    </main>
  );
}
