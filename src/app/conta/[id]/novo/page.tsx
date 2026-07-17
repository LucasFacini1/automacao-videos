import { notFound } from "next/navigation";
import { Cabecalho } from "@/components/cabecalho";
import { pegarConta } from "@/lib/mock";
import { Fluxo, type Passo } from "./fluxo";

const PASSOS: Passo[] = ["enviar", "criando", "aprovar", "escolher", "criando_videos", "pronto"];

/**
 * Fluxo de novo produto, dentro da conta. ?passo= é só pra revisar cada tela
 * sem clicar o fluxo inteiro; sai quando ligar no banco.
 */
export default async function NovoProduto({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ passo?: string }>;
}) {
  const { id } = await params;
  const conta = pegarConta(id);
  if (!conta) notFound();

  const { passo } = await searchParams;
  const inicial = PASSOS.includes(passo as Passo) ? (passo as Passo) : "enviar";

  return (
    <>
      <Cabecalho conta={{ handle: conta.handle, personaUrl: conta.persona.fotoUrl }} />
      <Fluxo inicial={inicial} contaId={conta.id} />
    </>
  );
}
