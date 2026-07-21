"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, Download, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FORMATOS, FORMATOS_POR_KEY } from "@/lib/formatos";
import { CUSTO_VIDEO, formatarBRL } from "@/lib/custos";
import { aprovarImagem, pedirVideos, refazerImagem } from "@/lib/acoes";
import type { EstadoProduto } from "@/lib/dados";

/** Enquanto o worker trabalha, a tela se atualiza sozinha. */
function usePolling(ativo: boolean, ms = 4000) {
  const router = useRouter();
  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => router.refresh(), ms);
    return () => clearInterval(t);
  }, [ativo, ms, router]);
}

export function Produto({ estado }: { estado: EstadoProduto }) {
  const router = useRouter();
  const [agindo, iniciar] = useTransition();
  const [qtd, setQtd] = useState<Record<string, number>>({ talking: 1 });

  const videosPendentes = estado.videos.some((v) => v.status === "na_fila" || v.status === "gerando");
  const esperandoFoto = estado.status === "gerando";
  const esperandoAnalise = estado.status === "aprovada" && estado.videos.length > 0 && !estado.temAnalise;

  usePolling(esperandoFoto || videosPendentes || esperandoAnalise);

  const total = Object.values(qtd).reduce((s, n) => s + n, 0);

  function alternar(key: string) {
    setQtd((q) => {
      const n = { ...q };
      if (n[key]) delete n[key];
      else n[key] = 1;
      return n;
    });
  }

  // ---------------------------------------------------------------- gerando
  if (esperandoFoto) {
    return (
      <Secao titulo="Criando a foto" sub="Leva menos de um minuto. Pode deixar essa tela aberta.">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-6 py-14">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Vestindo a peça na modelo...</p>
        </div>
        <AvisoWorker />
      </Secao>
    );
  }

  // ------------------------------------------------------------------- erro
  if (estado.status === "erro") {
    return (
      <Secao titulo="Não deu certo" sub="A foto não foi criada.">
        <div className="rounded-2xl border border-destructive/25 bg-destructive/[0.03] p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-destructive">
            <TriangleAlert className="size-4" /> Erro ao criar a foto
          </p>
          {estado.erroImagem && (
            <p className="mt-2 break-words text-sm text-muted-foreground">{estado.erroImagem}</p>
          )}
          <Button
            variant="outline"
            className="mt-4 gap-1.5"
            disabled={agindo}
            onClick={() =>
              iniciar(async () => {
                const { imagemBaseId } = await refazerImagem(estado.imagemBaseId);
                router.push(`/conta/${estado.contaId}/produto/${imagemBaseId}`);
              })
            }
          >
            <RefreshCw className="size-4" /> Tentar de novo
          </Button>
        </div>
      </Secao>
    );
  }

  // -------------------------------------------------------------- aprovação
  if (estado.status === "pronta") {
    return (
      <Secao titulo="A peça ficou igual?" sub="Compare com o anúncio antes de virar vídeo.">
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Anúncio
            </p>
            {estado.produtoUrl && (
              <Image
                src={estado.produtoUrl}
                alt="Foto do anúncio"
                width={256}
                height={340}
                sizes="128px"
                className="w-full rounded-xl border border-border object-cover object-top"
              />
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Sua foto
            </p>
            {estado.imagemUrl && (
              <Image
                src={estado.imagemUrl}
                alt="Foto gerada"
                width={720}
                height={960}
                sizes="(min-width: 640px) 480px, 100vw"
                className="w-full rounded-xl border border-border object-cover object-top"
              />
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            size="lg"
            className="h-12 gap-1.5 sm:flex-1"
            disabled={agindo}
            onClick={() =>
              iniciar(async () => {
                const { imagemBaseId } = await refazerImagem(estado.imagemBaseId);
                toast("Refazendo a foto...");
                router.push(`/conta/${estado.contaId}/produto/${imagemBaseId}`);
              })
            }
          >
            <RefreshCw className="size-4" /> Refazer
          </Button>
          <Button
            size="lg"
            className="h-12 gap-1.5 text-base sm:flex-[2]"
            disabled={agindo}
            onClick={() =>
              iniciar(async () => {
                await aprovarImagem(estado.imagemBaseId);
                router.refresh();
              })
            }
          >
            <Check className="size-4" /> Ficou igual, continuar
          </Button>
        </div>
      </Secao>
    );
  }

  // ------------------------------------------- aprovada, ainda sem vídeos
  if (estado.videos.length === 0) {
    return (
      <Secao titulo="Que vídeos você quer?" sub="Pode pedir mais de um do mesmo tipo — sai diferente cada vez.">
        <ul className="space-y-3">
          {FORMATOS.map((f) => {
            const n = qtd[f.key] ?? 0;
            const on = n > 0;
            return (
              <li
                key={f.key}
                className={`rounded-xl border p-4 transition-colors ${
                  on ? "border-foreground/20 bg-secondary/40" : "border-border bg-card"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox id={f.key} checked={on} onCheckedChange={() => alternar(f.key)} className="mt-0.5" />
                  <label htmlFor={f.key} className="min-w-0 flex-1 cursor-pointer">
                    <span className="block font-medium leading-snug">{f.nome}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {f.duracaoS}s · {f.temFala ? "ela fala" : "sem fala"}
                    </span>
                  </label>
                  {on && (
                    <div className="flex shrink-0 items-center rounded-lg border border-border bg-background">
                      <button
                        aria-label="Menos um"
                        className="flex size-8 items-center justify-center text-lg text-muted-foreground disabled:opacity-30"
                        disabled={n <= 1}
                        onClick={() => setQtd((q) => ({ ...q, [f.key]: n - 1 }))}
                      >
                        −
                      </button>
                      <span className="w-5 text-center text-sm font-medium tabular">{n}</span>
                      <button
                        aria-label="Mais um"
                        className="flex size-8 items-center justify-center text-lg text-muted-foreground disabled:opacity-30"
                        disabled={n >= 5}
                        onClick={() => setQtd((q) => ({ ...q, [f.key]: n + 1 }))}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-3">
          <span className="text-sm text-muted-foreground">
            {total} {total === 1 ? "vídeo" : "vídeos"}
          </span>
          <span className="text-sm font-medium tabular">{formatarBRL(total * CUSTO_VIDEO)}</span>
        </div>

        <Button
          size="lg"
          className="mt-4 h-12 w-full text-base"
          disabled={total === 0 || agindo}
          onClick={() =>
            iniciar(async () => {
              await pedirVideos(estado.imagemBaseId, qtd);
              router.refresh();
            })
          }
        >
          {agindo ? "Enviando..." : `Criar ${total} ${total === 1 ? "vídeo" : "vídeos"}`}
        </Button>
        <AvisoWorker />
      </Secao>
    );
  }

  // ------------------------------------------------------------- biblioteca
  const prontos = estado.videos.filter((v) => v.status === "pronto");
  return (
    <Secao
      titulo={videosPendentes ? "Criando seus vídeos" : "Vídeos prontos"}
      sub={
        videosPendentes
          ? "Leva alguns minutos. Pode fechar — fica salvo aqui."
          : "Baixe e poste com seu link de afiliado."
      }
    >
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {estado.videos.map((v) => {
          const f = FORMATOS_POR_KEY[v.formatoKey as keyof typeof FORMATOS_POR_KEY];
          return (
            <li
              key={v.id}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              <div className="relative aspect-[9/16] bg-secondary">
                {v.status === "pronto" && v.videoUrl ? (
                  <video
                    src={v.videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    poster={estado.imagemUrl ?? undefined}
                    className="size-full object-cover"
                  />
                ) : v.status === "erro" ? (
                  <div className="flex size-full flex-col items-center justify-center gap-2 px-4 text-center">
                    <TriangleAlert className="size-5 text-destructive" />
                    <span className="text-xs text-muted-foreground">{v.erro ?? "Falhou"}</span>
                  </div>
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-2">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {v.status === "gerando" ? "criando..." : "na fila"}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 p-3">
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{f?.nome ?? v.formatoKey}</p>
                {v.status === "pronto" && v.videoUrl && (
                  <a
                    href={v.videoUrl}
                    download={`${v.formatoKey}.mp4`}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label="Baixar vídeo"
                  >
                    <Download className="size-4" />
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {prontos.length > 0 && <Legendas copy={estado.copy} />}

      <div className="mt-8">
        <Button
          variant="outline"
          render={<Link href={`/conta/${estado.contaId}`} />}
          nativeButton={false}
          className="w-full sm:w-auto"
        >
          Voltar aos produtos
        </Button>
      </div>
    </Secao>
  );
}

// --- pedaços ----------------------------------------------------------------

function Secao({
  titulo,
  sub,
  children,
}: {
  titulo: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-semibold">{titulo}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
      <div className="mt-6">{children}</div>
    </main>
  );
}

/** O worker roda em outro processo. Se não estiver ligado, nada sai da fila. */
function AvisoWorker() {
  return (
    <p className="mt-4 text-center text-xs text-muted-foreground">
      Parou de andar? Confira se o worker está rodando (<code>npm run worker</code>).
    </p>
  );
}

function Legendas({ copy }: { copy: EstadoProduto["copy"] }) {
  const entradas = Object.entries(copy);
  if (entradas.length === 0) return null;

  return (
    <div className="mt-8 space-y-3">
      <h2 className="text-sm font-medium">Legendas prontas</h2>
      {entradas.map(([key, c]) => {
        const f = FORMATOS_POR_KEY[key as keyof typeof FORMATOS_POR_KEY];
        const texto = [c.descricao, (c.hashtags ?? []).map((h) => `#${h}`).join(" ")]
          .filter(Boolean)
          .join("\n\n");
        return (
          <div key={key} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{f?.nome ?? key}</p>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs"
                onClick={() => {
                  navigator.clipboard?.writeText(texto);
                  toast.success("Legenda copiada");
                }}
              >
                <Copy className="size-3.5" /> Copiar
              </Button>
            </div>
            {c.texto_tela && c.texto_tela.length > 0 && (
              <ul className="mt-2 space-y-1">
                {c.texto_tela.map((l, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="shrink-0 tabular text-xs text-muted-foreground/70">{l.t}</span>
                    <span>{l.texto}</span>
                  </li>
                ))}
              </ul>
            )}
            {c.descricao && (
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{texto}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
