import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecalho } from "@/components/cabecalho";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { pegarConta, listarProdutos, type StatusImagem } from "@/lib/dados";

const ROTULO: Record<StatusImagem, string> = {
  gerando: "Criando a foto...",
  pronta: "Esperando você aprovar",
  aprovada: "Aprovada",
  rejeitada: "Refeita",
  erro: "Deu erro",
};
const TOM: Record<StatusImagem, string> = {
  gerando: "bg-muted text-muted-foreground",
  pronta: "bg-primary/10 text-primary border-primary/20",
  aprovada: "bg-muted text-muted-foreground",
  rejeitada: "bg-muted text-muted-foreground",
  erro: "bg-destructive/10 text-destructive border-destructive/20",
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

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-6">
        <Link
          href={`/conta/${conta.id}/persona`}
          className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-shadow hover:shadow-sm"
        >
          {personaUrl ? (
            <Image
              src={personaUrl}
              alt=""
              width={48}
              height={48}
              className="size-12 shrink-0 rounded-full object-cover object-top ring-1 ring-border"
              unoptimized
            />
          ) : (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              ?
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Modelo desta conta</p>
            <p className="truncate text-sm font-medium">{conta.nome}</p>
          </div>
          <span className="text-xs text-muted-foreground">ver ›</span>
        </Link>

        <div className="mt-6 flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
          {produtos.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {totalVideos} vídeo{totalVideos !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {produtos.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-xl text-primary">
              📷
            </div>
            <p className="mt-3 font-medium">Nenhum produto ainda</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
              Achou uma peça boa no TikTok Shop? Tire um print e comece por aqui.
            </p>
            <Button render={<Link href={`/conta/${conta.id}/novo`} />} nativeButton={false} className="mt-4">
              Adicionar primeiro produto
            </Button>
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {produtos.map((p) => (
              <li key={p.id}>
                <Link
                  href={p.imagemBaseId ? `/conta/${conta.id}/novo?ib=${p.imagemBaseId}` : `/conta/${conta.id}`}
                  className="flex gap-3 rounded-xl border bg-card p-3 transition-shadow hover:shadow-sm"
                >
                  {p.thumbUrl ? (
                    <Image
                      src={p.thumbUrl}
                      alt=""
                      width={64}
                      height={96}
                      className="h-24 w-16 shrink-0 rounded-lg object-cover object-top"
                      unoptimized
                    />
                  ) : (
                    <span className="flex h-24 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                      ...
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                    <div>
                      <p className="truncate font-medium leading-snug">{p.nome}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.statusImagem && (
                        <Badge variant="outline" className={`font-normal ${TOM[p.statusImagem]}`}>
                          {ROTULO[p.statusImagem]}
                        </Badge>
                      )}
                      {p.videosProntos > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {p.videosProntos} vídeo{p.videosProntos > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
        <div className="mx-auto max-w-2xl">
          <Button
            render={<Link href={`/conta/${conta.id}/novo`} />}
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
