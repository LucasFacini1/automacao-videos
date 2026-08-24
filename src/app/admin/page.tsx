import { Cabecalho } from "@/components/cabecalho";
import { dadosAdmin } from "@/lib/admin";
import { formatarBRL } from "@/lib/custos";
import { FORMATOS_POR_KEY } from "@/lib/formatos";
import { LimiteUsuario } from "./limite";

// Custos são dados vivos — nada de cache estático nesta tela.
export const dynamic = "force-dynamic";

/** Painel de custos. Gate por ADMIN_EMAIL — dadosAdmin() redireciona quem não é. */
export default async function Admin() {
  const d = await dadosAdmin();

  const fmtData = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <>
      <Cabecalho />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Custos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitoramento interno. Só você vê esta tela.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Cartao rotulo="Total (histórico)" valor={formatarBRL(d.totalGeral)} />
          <Cartao rotulo="Este mês" valor={formatarBRL(d.totalMes)} destaque />
          <Cartao rotulo="Fotos criadas" valor={String(d.imagens)} />
          <Cartao rotulo="Vídeos criados" valor={String(d.videos)} />
        </div>

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium">Por usuário</h2>
          {d.porUsuario.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum gasto ainda.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Usuário</th>
                    <th className="px-4 py-2.5 text-right font-medium">Fotos</th>
                    <th className="px-4 py-2.5 text-right font-medium">Vídeos</th>
                    <th className="px-4 py-2.5 text-right font-medium">Total</th>
                    <th className="px-4 py-2.5 text-right font-medium">No mês</th>
                    <th className="px-4 py-2.5 text-right font-medium">Teto/mês</th>
                  </tr>
                </thead>
                <tbody>
                  {d.porUsuario.map((u) => {
                    const teto = u.limite || d.tetoPadrao;
                    const estourou = teto > 0 && u.totalMes >= teto;
                    return (
                    <tr key={u.userId} className="border-t border-border">
                      <td className="max-w-[14rem] truncate px-4 py-2.5">{u.email}</td>
                      <td className="px-4 py-2.5 text-right tabular">{u.imagens}</td>
                      <td className="px-4 py-2.5 text-right tabular">{u.videos}</td>
                      <td className="px-4 py-2.5 text-right font-medium tabular">
                        {formatarBRL(u.total)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right tabular ${estourou ? "font-medium text-destructive" : ""}`}
                      >
                        {formatarBRL(u.totalMes)}
                      </td>
                      <td className="px-4 py-2.5">
                        <LimiteUsuario userId={u.userId} limite={u.limite} tetoPadrao={d.tetoPadrao} />
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium">
            Cada geração{" "}
            <span className="font-normal text-muted-foreground">
              (últimas {d.eventos.length})
            </span>
          </h2>
          {d.eventos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada gerado ainda.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Quando</th>
                    <th className="px-4 py-2.5 font-medium">Usuário</th>
                    <th className="px-4 py-2.5 font-medium">Conta</th>
                    <th className="px-4 py-2.5 font-medium">O quê</th>
                    <th className="px-4 py-2.5 text-right font-medium">Custo</th>
                  </tr>
                </thead>
                <tbody>
                  {d.eventos.map((e) => (
                    <tr key={e.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                        {fmtData(e.quando)}
                      </td>
                      <td className="max-w-[12rem] truncate px-4 py-2.5">{e.email}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{e.conta}</td>
                      <td className="px-4 py-2.5">
                        {e.tipo === "imagem"
                          ? "Foto"
                          : `Vídeo · ${
                              e.formato
                                ? FORMATOS_POR_KEY[e.formato as keyof typeof FORMATOS_POR_KEY]?.nome ??
                                  e.formato
                                : "?"
                            }`}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular">{formatarBRL(e.custo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function Cartao({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        destaque ? "border-primary/25 bg-primary/[0.04]" : "border-border bg-card"
      }`}
    >
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="mt-1 text-xl font-semibold tabular">{valor}</p>
    </div>
  );
}
