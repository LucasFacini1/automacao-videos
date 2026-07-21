import { notFound } from "next/navigation";
import { Cabecalho } from "@/components/cabecalho";
import { pegarConta, pegarEstadoProduto } from "@/lib/dados";
import { Produto } from "./cliente";

export default async function ProdutoPage({
  params,
}: {
  params: Promise<{ id: string; ib: string }>;
}) {
  const { id, ib } = await params;
  const [conta, estado] = await Promise.all([pegarConta(id), pegarEstadoProduto(ib)]);
  if (!conta || !estado || estado.contaId !== id) notFound();

  return (
    <>
      <Cabecalho conta={{ handle: conta.handle, personaUrl: conta.persona?.refUrl ?? null }} />
      <Produto estado={estado} />
    </>
  );
}
