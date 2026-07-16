import { Cabecalho } from "@/components/cabecalho";
import { Fluxo, type Passo } from "./fluxo";

const PASSOS: Passo[] = ["enviar", "criando", "aprovar", "escolher", "criando_videos", "pronto"];

/**
 * ?passo= existe só para revisar cada tela sem clicar o fluxo inteiro.
 * Sai quando ligar no banco.
 */
export default async function Novo({
  searchParams,
}: {
  searchParams: Promise<{ passo?: string }>;
}) {
  const { passo } = await searchParams;
  const inicial = PASSOS.includes(passo as Passo) ? (passo as Passo) : "enviar";

  return (
    <>
      <Cabecalho />
      <Fluxo inicial={inicial} />
    </>
  );
}
