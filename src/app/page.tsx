import Image from "next/image";
import Link from "next/link";
import { Cabecalho } from "@/components/cabecalho";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PRODUTOS, ROTULO_STATUS, type StatusProduto } from "@/lib/mock";

const TOM: Record<StatusProduto, string> = {
  gerando: "bg-muted text-muted-foreground",
  aguardando_aprovacao: "bg-primary/10 text-primary border-primary/20",
  aprovada: "bg-muted text-muted-foreground",
  com_videos: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function Home() {
  const pendentes = PRODUTOS.filter((p) => p.status === "aguardando_aprovacao");

  return (
    <>
      <Cabecalho />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-6">
        <h1 className="text-2xl font-semibold tracking-tight">Seus produtos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {PRODUTOS.length} produtos · {PRODUTOS.reduce((s, p) => s + p.videos, 0)} vídeos prontos
        </p>

        {pendentes.length > 0 && (
          <Link
            href="/novo?passo=aprovar"
            className="mt-5 flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3 transition-colors hover:bg-primary/10"
          >
            <span className="relative flex size-2 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <span className="font-medium">
                {pendentes.length} foto{pendentes.length > 1 ? "s" : ""} esperando você
              </span>
              <span className="block text-muted-foreground">Confira antes de virar vídeo</span>
            </span>
            <span aria-hidden className="text-muted-foreground">
              ›
            </span>
          </Link>
        )}

        <ul className="mt-5 space-y-3">
          {PRODUTOS.map((p) => (
            <li key={p.id}>
              <Link
                href="/novo?passo=aprovar"
                className="flex gap-3 rounded-xl border bg-card p-3 transition-shadow hover:shadow-sm"
              >
                <Image
                  src={p.baseUrl ?? p.produtoUrl}
                  alt=""
                  width={64}
                  height={96}
                  className="h-24 w-16 shrink-0 rounded-lg object-cover object-top"
                />
                <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                  <div>
                    <p className="truncate font-medium leading-snug">{p.nome}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.quando}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`font-normal ${TOM[p.status]}`}>
                      {ROTULO_STATUS[p.status]}
                    </Badge>
                    {p.videos > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {p.videos} vídeo{p.videos > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      {/* Fixo embaixo: é a ação principal e ela usa com uma mão só, no celular. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
        <div className="mx-auto max-w-2xl">
          <Button
            render={<Link href="/novo" />}
            nativeButton={false}
            size="lg"
            className="h-12 w-full text-base"
          >
            Novo produto
          </Button>
        </div>
      </div>
    </>
  );
}
