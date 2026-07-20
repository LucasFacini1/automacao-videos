import Image from "next/image";
import Link from "next/link";
import { Plus, ShoppingBag, Clapperboard, ArrowRight } from "lucide-react";
import { Cabecalho } from "@/components/cabecalho";
import { SetupFaltando } from "@/components/setup-faltando";
import { Button } from "@/components/ui/button";
import { supabaseConfigurado, envFaltando } from "@/lib/env";
import { listarContasComResumo } from "@/lib/dados";

export default async function Home() {
  if (!supabaseConfigurado()) return <SetupFaltando faltando={envFaltando()} />;

  const contas = await listarContasComResumo();
  const totalPendentes = contas.reduce((s, c) => s + c.pendentes, 0);

  return (
    <>
      <Cabecalho />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {contas.length === 0 ? (
          <EstadoVazio />
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Suas contas</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {contas.length} {contas.length === 1 ? "conta ativa" : "contas ativas"}
                  {totalPendentes > 0 && (
                    <>
                      {" · "}
                      <span className="font-medium text-amber-600">
                        {totalPendentes} aguardando aprovação
                      </span>
                    </>
                  )}
                </p>
              </div>
              <Button render={<Link href="/conta/nova" />} nativeButton={false} className="gap-1.5">
                <Plus className="size-4" /> Nova conta
              </Button>
            </div>

            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {contas.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/conta/${c.id}`}
                    className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:border-foreground/15 hover:shadow-[0_2px_16px_-4px_rgb(0_0_0/0.08)]"
                  >
                    <div className="flex items-center gap-3">
                      {c.personaUrl ? (
                        <Image
                          src={c.personaUrl}
                          alt=""
                          width={44}
                          height={44}
                          className="size-11 shrink-0 rounded-full object-cover object-top ring-1 ring-border"
                          unoptimized
                        />
                      ) : (
                        <span className="size-11 shrink-0 rounded-full bg-muted ring-1 ring-border" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium leading-tight">{c.handle}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.nome}</p>
                      </div>
                      {c.pendentes > 0 && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          {c.pendentes}
                        </span>
                      )}
                    </div>

                    <div className="mt-5 flex items-center gap-4 border-t border-border/70 pt-4 text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <ShoppingBag className="size-4" />
                        <span className="font-medium text-foreground">{c.produtos}</span>
                        {c.produtos === 1 ? "produto" : "produtos"}
                      </span>
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Clapperboard className="size-4" />
                        <span className="font-medium text-foreground">{c.videos}</span>
                        {c.videos === 1 ? "vídeo" : "vídeos"}
                      </span>
                      <ArrowRight className="ml-auto size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </div>
                  </Link>
                </li>
              ))}

              <li>
                <Link
                  href="/conta/nova"
                  className="flex h-full min-h-[132px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 p-5 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-card hover:text-foreground"
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-secondary">
                    <Plus className="size-4.5" />
                  </span>
                  Nova conta
                </Link>
              </li>
            </ul>
          </>
        )}
      </main>
    </>
  );
}

function EstadoVazio() {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-card px-6 py-12 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Clapperboard className="size-6" />
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Bem-vindo ao Studio</h1>
      <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
        Crie sua primeira conta e escolha a modelo que vai vestir os produtos nos vídeos.
      </p>
      <Button
        render={<Link href="/conta/nova" />}
        nativeButton={false}
        size="lg"
        className="mt-6 gap-1.5"
      >
        <Plus className="size-4" /> Criar primeira conta
      </Button>
    </div>
  );
}
