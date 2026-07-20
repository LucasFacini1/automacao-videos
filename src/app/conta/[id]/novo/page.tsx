import { notFound } from "next/navigation";
import { Cabecalho } from "@/components/cabecalho";
import { pegarConta } from "@/lib/dados";
import { Fluxo, type Passo } from "./fluxo";

const PASSOS: Passo[] = ["enviar", "criando", "aprovar", "escolher", "criando_videos", "pronto"];

export default async function NovoProduto({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ passo?: string }>;
}) {
  const { id } = await params;
  const conta = await pegarConta(id);
  if (!conta) notFound();

  const { passo } = await searchParams;
  const inicial = PASSOS.includes(passo as Passo) ? (passo as Passo) : "enviar";

  return (
    <>
      <Cabecalho conta={{ handle: conta.handle, personaUrl: conta.persona?.refUrl ?? null }} />
      <Fluxo inicial={inicial} contaId={conta.id} />
    </>
  );
}
