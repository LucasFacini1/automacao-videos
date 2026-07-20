import { notFound } from "next/navigation";
import { Cabecalho } from "@/components/cabecalho";
import { pegarConta } from "@/lib/dados";
import { Trocar } from "./trocar";

export default async function TrocarPersona({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conta = await pegarConta(id);
  if (!conta) notFound();

  return (
    <>
      <Cabecalho conta={{ handle: conta.handle, personaUrl: conta.persona?.refUrl ?? null }} />
      <Trocar contaId={conta.id} handle={conta.handle} fotoAtual={conta.persona?.refUrl ?? ""} />
    </>
  );
}
