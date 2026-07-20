import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, RefreshCw } from "lucide-react";
import { Cabecalho } from "@/components/cabecalho";
import { Button } from "@/components/ui/button";
import { ExcluirConta } from "@/components/excluir-conta";
import { pegarConta } from "@/lib/dados";

/**
 * A modelo da conta + configurações. A referência é congelada (PLAN.md §3.1):
 * carrega rosto E cenário. Trocar é ação deliberada, por isso é secundária.
 */
export default async function PersonaConta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conta = await pegarConta(id);
  if (!conta) notFound();

  const p = conta.persona;
  const personaUrl = p?.refUrl ?? null;
  const campos = p
    ? [
        { rotulo: "Cabelo", valor: p.cabelo },
        { rotulo: "Maquiagem", valor: p.make },
        { rotulo: "Cenário", valor: p.cenario },
        { rotulo: "Unhas", valor: p.unhas },
      ]
    : [];

  return (
    <>
      <Cabecalho conta={{ handle: conta.handle, personaUrl }} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold">A modelo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          É ela que veste todos os produtos de {conta.handle}.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,20rem)_1fr]">
          {/* Foto */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {personaUrl ? (
              <Image
                src={personaUrl}
                alt="Foto da modelo desta conta"
                width={640}
                height={800}
                sizes="(min-width: 768px) 320px, 100vw"
                className="w-full object-cover object-top"
              />
            ) : (
              <div className="flex aspect-[4/5] items-center justify-center bg-secondary text-sm text-muted-foreground">
                sem foto
              </div>
            )}
          </div>

          {/* Detalhes + ações */}
          <div className="space-y-6">
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <dl className="divide-y divide-border">
                {campos.map((c) => (
                  <div key={c.rotulo} className="flex items-center justify-between px-4 py-3.5">
                    <dt className="text-sm text-muted-foreground">{c.rotulo}</dt>
                    <dd className="text-sm font-medium">{c.valor || "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-2xl border border-border bg-secondary/40 p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Lock className="size-4 text-muted-foreground" />
                Esta foto fica travada
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                É ela que mantém a modelo e o cenário sempre iguais em todos os vídeos. Trocar
                muda a cara da conta inteira — por isso fica separado, pra não acontecer sem
                querer.
              </p>
              <Button
                variant="outline"
                render={<Link href={`/conta/${conta.id}/persona/trocar`} />}
                nativeButton={false}
                className="mt-4 gap-1.5"
              >
                <RefreshCw className="size-4" /> Trocar a modelo
              </Button>
            </div>

            {/* Zona de risco */}
            <div className="rounded-2xl border border-destructive/25 bg-destructive/[0.03] p-4">
              <p className="text-sm font-medium text-destructive">Excluir esta conta</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Remove {conta.handle} com a modelo, os produtos e os vídeos. Não dá pra desfazer.
              </p>
              <div className="mt-3">
                <ExcluirConta contaId={conta.id} handle={conta.handle} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
