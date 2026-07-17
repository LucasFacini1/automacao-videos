import { notFound } from "next/navigation";
import { Cabecalho } from "@/components/cabecalho";
import { pegarConta } from "@/lib/mock";
import { Trocar } from "./trocar";

export default async function TrocarPersona({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conta = pegarConta(id);
  if (!conta) notFound();

  return (
    <>
      <Cabecalho conta={{ handle: conta.handle, personaUrl: conta.persona.fotoUrl }} />
      <Trocar contaId={conta.id} handle={conta.handle} fotoAtual={conta.persona.fotoUrl} />
    </>
  );
}
