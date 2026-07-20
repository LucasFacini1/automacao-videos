import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecalho } from "@/components/cabecalho";
import { Button } from "@/components/ui/button";
import { pegarConta } from "@/lib/dados";

/**
 * A persona da conta. Referência congelada (PLAN.md §3.1): carrega rosto E
 * cenário. Trocar é ação deliberada — por isso o aviso e o botão secundário.
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

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-6">
        <h1 className="text-2xl font-semibold tracking-tight">A modelo desta conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          É ela que veste todos os produtos de {conta.handle}.
        </p>

        <div className="mt-5 overflow-hidden rounded-2xl border bg-card">
          {personaUrl ? (
            <Image
              src={personaUrl}
              alt="Foto da modelo desta conta"
              width={640}
              height={800}
              className="w-full object-cover object-top"
              unoptimized
            />
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center bg-muted text-muted-foreground">
              sem foto
            </div>
          )}
          <dl className="divide-y">
            {campos.map((c) => (
              <div key={c.rotulo} className="flex items-center justify-between px-4 py-3">
                <dt className="text-sm text-muted-foreground">{c.rotulo}</dt>
                <dd className="text-sm font-medium">{c.valor || "—"}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="mt-4 rounded-lg bg-muted px-3.5 py-3 text-sm leading-relaxed text-muted-foreground">
          Essa foto é o que mantém a modelo e o cenário sempre iguais em todos os vídeos.
          Trocar muda a cara da conta inteira — por isso fica separado, pra não acontecer sem querer.
        </p>

        <Button
          variant="outline"
          render={<Link href={`/conta/${conta.id}/persona/trocar`} />}
          nativeButton={false}
          className="mt-4 w-full"
        >
          Trocar a modelo
        </Button>
      </main>
    </>
  );
}
