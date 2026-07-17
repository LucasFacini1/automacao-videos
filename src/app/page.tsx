import Image from "next/image";
import Link from "next/link";
import { Cabecalho } from "@/components/cabecalho";
import { Button } from "@/components/ui/button";
import { CONTAS, resumoConta } from "@/lib/mock";

/**
 * Hub: todas as contas do usuário. Ponto de entrada do sistema multi-conta.
 * Cada card entra na conta. Persona visível pra ela reconhecer de relance.
 */
export default function Home() {
  const totalPendentes = CONTAS.reduce((s, c) => s + resumoConta(c).pendentes, 0);

  return (
    <>
      <Cabecalho />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-6">
        <h1 className="text-2xl font-semibold tracking-tight">Suas contas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {CONTAS.length} {CONTAS.length === 1 ? "conta" : "contas"}
          {totalPendentes > 0 && (
            <>
              {" · "}
              <span className="font-medium text-primary">
                {totalPendentes} foto{totalPendentes > 1 ? "s" : ""} esperando você
              </span>
            </>
          )}
        </p>

        <ul className="mt-5 space-y-3">
          {CONTAS.map((c) => {
            const r = resumoConta(c);
            return (
              <li key={c.id}>
                <Link
                  href={`/conta/${c.id}`}
                  className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-shadow hover:shadow-sm"
                >
                  <Image
                    src={c.persona.fotoUrl}
                    alt=""
                    width={56}
                    height={56}
                    className="size-14 shrink-0 rounded-full object-cover object-top ring-1 ring-border"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium leading-tight">{c.handle}</p>
                      {r.pendentes > 0 && (
                        <span className="flex size-2 shrink-0 rounded-full bg-primary" aria-label="tem foto esperando" />
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.nicho}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.produtos === 0
                        ? "Nenhum produto ainda"
                        : `${r.produtos} produto${r.produtos > 1 ? "s" : ""} · ${r.videos} vídeo${r.videos !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <span aria-hidden className="text-muted-foreground">
                    ›
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <Link
          href="/conta/nova"
          className="mt-3 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
        >
          <span className="text-lg text-primary">+</span> Nova conta
        </Link>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
        <div className="mx-auto max-w-2xl">
          <Button
            render={<Link href="/conta/nova" />}
            nativeButton={false}
            size="lg"
            className="h-12 w-full text-base"
          >
            Nova conta
          </Button>
        </div>
      </div>
    </>
  );
}
