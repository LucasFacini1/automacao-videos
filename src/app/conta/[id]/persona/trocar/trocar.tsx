"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Trocar a referência da persona. Ação deliberada (PLAN.md §3.1): muda a cara
 * da conta inteira e não realimenta a geração. Por isso pede confirmação
 * explícita antes de aplicar.
 */
export function Trocar({
  contaId,
  handle,
  fotoAtual,
}: {
  contaId: string;
  handle: string;
  fotoAtual: string;
}) {
  const [nova, setNova] = useState<string | null>(null);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-28 pt-6">
      <h1 className="text-2xl font-semibold tracking-tight">Trocar a modelo</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Isso muda a modelo de {handle} em todos os próximos vídeos.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Modelo de agora</p>
          <Image
            src={fotoAtual}
            alt="Modelo atual"
            width={200}
            height={280}
            className="w-full rounded-xl object-cover object-top opacity-60 ring-1 ring-border"
          />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Nova modelo</p>
          {nova ? (
            <Image
              src={nova}
              alt="Nova modelo"
              width={200}
              height={280}
              className="w-full rounded-xl object-cover object-top ring-2 ring-primary"
            />
          ) : (
            <button
              onClick={() => setNova("/img/base-2.png")}
              className="flex aspect-[5/7] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-card text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-xl text-primary">
                +
              </span>
              <span className="px-2 text-xs text-muted-foreground">Enviar nova foto</span>
            </button>
          )}
        </div>
      </div>

      <p className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3.5 py-3 text-sm leading-relaxed text-amber-200">
        A nova foto tem que ser a modelo <strong>já no closet</strong>, não um retrato solto — é
        ela que mantém o cenário igual. Os produtos que já têm vídeo não mudam.
      </p>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg gap-2">
          <Button
            render={<Link href={`/conta/${contaId}/persona`} />}
            nativeButton={false}
            variant="outline"
            size="lg"
            className="h-12 flex-1"
          >
            Cancelar
          </Button>
          <Button
            size="lg"
            disabled={!nova}
            className="h-12 flex-[2] text-base"
            onClick={() => toast.success("Modelo trocada (demo)")}
          >
            Trocar modelo
          </Button>
        </div>
      </div>
    </main>
  );
}
