import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, ImagePlus, ChevronRight, Settings2 } from "lucide-react";
import { Cabecalho } from "@/components/cabecalho";
import { Button } from "@/components/ui/button";
import { pegarConta, listarProdutos } from "@/lib/dados";
import { ListaProdutos } from "./produtos-lista";

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
              Achou uma peça boa pra vender? Tire um print da foto e envie — a modelo veste
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
          <div className="mt-6">
            <ListaProdutos contaId={conta.id} produtos={produtos} />
          </div>
        )}
      </main>
    </>
  );
}
