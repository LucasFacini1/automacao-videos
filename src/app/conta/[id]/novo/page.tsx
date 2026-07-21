import { notFound } from "next/navigation";
import { Cabecalho } from "@/components/cabecalho";
import { pegarConta } from "@/lib/dados";
import { Enviar } from "./enviar";

export default async function NovoProduto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conta = await pegarConta(id);
  if (!conta) notFound();

  return (
    <>
      <Cabecalho conta={{ handle: conta.handle, personaUrl: conta.persona?.refUrl ?? null }} />
      <Enviar contaId={conta.id} />
    </>
  );
}
