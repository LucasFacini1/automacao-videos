import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, ImagePlus, ChevronRight, Clapperboard, Settings2 } from "lucide-react";
import { Cabecalho } from "@/components/cabecalho";
import { Button } from "@/components/ui/button";
import { pegarConta, listarProdutos, type StatusImagem } from "@/lib/dados";

const ROTULO: Record<StatusImagem, string> = {
  gerando: "Criando a foto",
  pronta: "Confira a foto",
  aprovada: "Aprovada",
  rejeitada: "Refeita",
  erro: "Deu erro",
};

const TOM: Record<StatusImagem, string> = {
  gerando: "bg-secondary text-muted-foreground",
  pronta: "bg-brand/10 text-brand ring-1 ring-brand/20",
  aprovada: "bg-secondary text-muted-foreground",
  rejeitada: "bg-secondary text-muted-foreground",
  erro: "bg-destructive/10 text-destructive ring-1 ring-destructive/20",
};

export default async function ContaHome({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conta = await pegarConta(id);
  if (!conta) notFound();

  const produtos = await listarProdutos(id);
  const totalVideos = produtos.reduce((s, p) => s + p.videosProntos, 0);
  const personaUrl = conta.persona?.refUrl ?? null;

  return (
    <>
      <Cabecalho conta={{ handle: conta.handle, personaUrl }} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {/* Modelo da conta */}
        <Link
          href={`/conta/${conta.id}/persona`}
          className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/15"
        >
          {personaUrl ? (
            <Image
              src={personaUrl}
              alt=""
              width={96}
              height={96}
              className="size-12 shrink-0 rounded-full object-cover object-top ring-1 ring-border"
            />
          ) : (
            <span className="size-12 shrink-0 rounded-full bg-secondary ring-1 ring-border" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Modelo desta conta
            </p>
            <p className="mt-0.5 truncate font-medium">{conta.nome}</p>
          </div>
          <span className="flex items-center gap-1 text-sm text-muted-foreground transition-colors group-hover:text-foreground">
            <Settings2 className="size-4" />
            <ChevronRight className="size-4" />
          </span>
        </Link>

        {/* Produtos */}
        <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Produtos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {produtos.length === 0
                ? "Nada por aqui ainda"
                : `${produtos.length} ${produtos.length === 1 ? "produto" : "produtos"} · ${totalVideos} ${totalVideos === 1 ? "vídeo" : "vídeos"}`}
            </p>
          </div>
          {produtos.length > 0 && (
            <Button
              render={<Link href={`/conta/${conta.id}/novo`} />}
              nativeButton={false}
              className="gap-1.5"
            >
              <Plus className="size-4" /> Novo produto
            </Button>
          )}
        </div>

        {produtos.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
              <ImagePlus className="size-6" />
            </span>
            <p className="mt-4 font-medium">Comece pelo primeiro produto</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Achou uma peça boa no TikTok Shop? Tire um print da foto e envie — a modelo veste
              e os vídeos saem prontos.
            </p>
            <Button
              render={<Link href={`/conta/${conta.id}/novo`} />}
              nativeButton={false}
              size="lg"
              className="mt-6 gap-1.5"
            >
              <Plus className="size-4" /> Adicionar produto
            </Button>
          </div>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {produtos.map((p) => (
              <li key={p.id}>
                <Link
                  href={p.imagemBaseId ? `/conta/${conta.id}/produto/${p.imagemBaseId}` : `/conta/${conta.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-foreground/15 hover:shadow-[0_2px_16px_-4px_rgb(0_0_0/0.08)]"
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
                    {p.thumbUrl ? (
                      <Image
                        src={p.thumbUrl}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 90vw"
                        className="object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        criando...
                      </span>
                    )}
                    {p.videosProntos > 0 && (
                      <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-foreground/80 px-1.5 py-0.5 text-[11px] font-medium text-background backdrop-blur-sm">
                        <Clapperboard className="size-3" />
                        {p.videosProntos}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3.5">
                    <p className="line-clamp-2 text-sm font-medium leading-snug">{p.nome}</p>
                    {p.statusImagem && (
                      <span
                        className={`mt-auto w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${TOM[p.statusImagem]}`}
                      >
                        {ROTULO[p.statusImagem]}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
