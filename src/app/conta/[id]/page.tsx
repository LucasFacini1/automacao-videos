import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecalho } from "@/components/cabecalho";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { pegarConta, resumoConta, ROTULO_STATUS, type StatusProduto } from "@/lib/mock";

const TOM: Record<StatusProduto, string> = {
  gerando: "bg-muted text-muted-foreground",
  aguardando_aprovacao: "bg-primary/10 text-primary border-primary/20",
  aprovada: "bg-muted text-muted-foreground",
  com_videos: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default async function ContaHome({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conta = pegarConta(id);
  if (!conta) notFound();

  const r = resumoConta(conta);

  return (
    <>
      <Cabecalho conta={{ handle: conta.handle, personaUrl: conta.persona.fotoUrl }} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-6">
        {/* Persona da conta — quem veste os produtos aqui. Atalho pra ver/trocar. */}
        <Link
          href={`/conta/${conta.id}/persona`}
          className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-shadow hover:shadow-sm"
        >
          <Image
            src={conta.persona.fotoUrl}
            alt=""
            width={48}
            height={48}
            className="size-12 shrink-0 rounded-full object-cover object-top ring-1 ring-border"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Modelo desta conta</p>
            <p className="truncate text-sm font-medium">{conta.nome}</p>
          </div>
          <span className="text-xs text-muted-foreground">ver ›</span>
        </Link>

        <div className="mt-6 flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
          <span className="text-sm text-muted-foreground">
            {r.produtos > 0 && `${r.videos} vídeo${r.videos !== 1 ? "s" : ""}`}
          </span>
        </div>

        {conta.produtos.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-xl text-primary">
              📷
            </div>
            <p className="mt-3 font-medium">Nenhum produto ainda</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
              Achou uma peça boa no TikTok Shop? Tire um print e comece por aqui.
            </p>
            <Button
              render={<Link href={`/conta/${conta.id}/novo`} />}
              nativeButton={false}
              className="mt-4"
            >
              Adicionar primeiro produto
            </Button>
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {conta.produtos.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/conta/${conta.id}/novo?passo=aprovar`}
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
