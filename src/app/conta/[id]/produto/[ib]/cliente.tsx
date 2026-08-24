"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, Download, Loader2, Plus, RefreshCw, Trash2, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FORMATOS, FORMATOS_POR_KEY } from "@/lib/formatos";
import { CUSTO_VIDEO, formatarBRL } from "@/lib/custos";
import { textoLegenda, LEGENDA_MAX } from "@/lib/legenda";
import {
  aprovarImagem,
  pedirVideos,
  refazerImagem,
  cancelarVideo,
  cancelarImagem,
  excluirVideos,
} from "@/lib/acoes";
import type { EstadoProduto, VideoItem, Legenda as TipoLegenda } from "@/lib/dados";

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
  // Seleção de vídeos pra excluir em lote, e o modo "fazer mais vídeos".
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [escolhendo, setEscolhendo] = useState(false);

  const videosPendentes = estado.videos.some((v) => v.status === "na_fila" || v.status === "gerando");
  const esperandoFoto = estado.status === "gerando";
  const esperandoAnalise = estado.status === "aprovada" && estado.videos.length > 0 && !estado.temAnalise;

  usePolling(esperandoFoto || videosPendentes || esperandoAnalise);

  /** Roda uma ação e mostra toast de erro se falhar (aviso padronizado). */
  function agir(fn: () => Promise<unknown>, aoOk?: () => void) {
    iniciar(async () => {
      try {
        await fn();
        if (aoOk) aoOk();
        else router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Algo deu errado. Tente de novo.");
      }
    });
  }

  /** Refaz a foto: cria uma nova imagem base e navega pra ela. */
  function refazer(aviso?: string) {
    iniciar(async () => {
      try {
        if (aviso) toast(aviso);
        const { imagemBaseId } = await refazerImagem(estado.imagemBaseId);
        router.push(`/conta/${estado.contaId}/produto/${imagemBaseId}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não deu pra refazer.");
      }
    });
  }

  /** Marca/desmarca um vídeo na seleção. */
  function alternarSelecao(id: string) {
    setSelecionados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  /** Apaga os vídeos marcados, com confirmação. */
  function excluirSelecionados() {
    const ids = [...selecionados];
    if (ids.length === 0) return;
    if (!confirm(`Apagar ${ids.length} ${ids.length === 1 ? "vídeo" : "vídeos"}? Não dá pra desfazer.`)) return;
    agir(
      () => excluirVideos(ids),
      () => {
        setSelecionados(new Set());
        router.refresh();
      },
    );
  }

  // ---------------------------------------------------------------- gerando
  if (esperandoFoto) {
    return (
      <Secao titulo="Criando a foto" sub="Leva menos de um minuto. Pode deixar essa tela aberta.">
        <div className="glass-card flex flex-col items-center gap-4 px-6 py-14">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Vestindo a peça na modelo...</p>
          <Button
            variant="ghost"
            size="sm"
            disabled={agindo}
            onClick={() => agir(() => cancelarImagem(estado.imagemBaseId))}
            className="text-muted-foreground"
          >
            <X className="size-4" /> Cancelar
          </Button>
        </div>
        <AvisoWorker />
      </Secao>
    );
  }

  // imagem cancelada — oferece refazer
  if (estado.status === "cancelada" || estado.status === "rejeitada") {
    return (
      <Secao titulo="Criação cancelada" sub="Você cancelou a criação desta foto.">
        <div className="glass-card flex flex-col items-center gap-4 px-6 py-14">
          <p className="text-sm text-muted-foreground">Quer tentar de novo?</p>
          <Button disabled={agindo} onClick={() => refazer()}>
            <RefreshCw className="size-4" /> Refazer a foto
          </Button>
        </div>
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
          <Button variant="outline" className="mt-4 gap-1.5" disabled={agindo} onClick={() => refazer()}>
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
            onClick={() => refazer("Refazendo a foto...")}
          >
            <RefreshCw className="size-4" /> Refazer
          </Button>
          <Button
            size="lg"
            className="h-12 gap-1.5 text-base sm:flex-[2]"
            disabled={agindo}
            onClick={() => agir(() => aprovarImagem(estado.imagemBaseId))}
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
      <Secao titulo="Que vídeos você quer?" sub="Marque os estilos e quantas variações de cada — sai diferente cada vez.">
        <EscolherFormatos imagemBaseId={estado.imagemBaseId} />
      </Secao>
    );
  }

  // ------------------------------------------------------------- biblioteca
  const prontos = estado.videos.filter((v) => v.status === "pronto");
  const selecionavel = (s: VideoItem["status"]) => s === "pronto" || s === "erro" || s === "cancelado";
  const nSel = selecionados.size;
  const temLegendaPropria = estado.videos.some((v) => v.legenda);

  return (
    <Secao
      titulo={videosPendentes ? "Criando seus vídeos" : "Vídeos prontos"}
      sub={
        videosPendentes
          ? "Leva alguns minutos. Pode fechar — fica salvo aqui."
          : "Baixe e poste com seu link de afiliado."
      }
    >
      {/* Barra de seleção: aparece só quando há vídeo(s) marcado(s). */}
      {nSel > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-border bg-secondary/50 px-4 py-2.5">
          <span className="text-sm font-medium">
            {nSel} {nSel === 1 ? "selecionado" : "selecionados"}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              disabled={agindo}
              onClick={() => setSelecionados(new Set())}
            >
              Limpar
            </Button>
            <Button
              size="sm"
              disabled={agindo}
              onClick={excluirSelecionados}
              className="gap-1.5 bg-destructive text-white hover:bg-destructive/90"
            >
              <Trash2 className="size-4" /> Excluir
            </Button>
          </div>
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {estado.videos.map((v) => {
          const f = FORMATOS_POR_KEY[v.formatoKey as keyof typeof FORMATOS_POR_KEY];
          const sel = selecionados.has(v.id);
          return (
            <li
              key={v.id}
              className={`overflow-hidden rounded-2xl border bg-card transition-colors ${
                sel ? "border-primary ring-1 ring-primary" : "border-border"
              }`}
            >
              <div className="relative aspect-[9/16] bg-secondary">
                {/* Bolinha de seleção (só nos vídeos que dá pra apagar). */}
                {selecionavel(v.status) && (
                  <button
                    type="button"
                    aria-label={sel ? "Desmarcar vídeo" : "Marcar vídeo"}
                    aria-pressed={sel}
                    onClick={() => alternarSelecao(v.id)}
                    className={`absolute left-2 top-2 z-10 flex size-7 items-center justify-center rounded-full border-2 shadow-sm transition-colors ${
                      sel
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-white/80 bg-black/35 text-transparent backdrop-blur-sm hover:bg-black/50"
                    }`}
                  >
                    <Check className="size-4" />
                  </button>
                )}

                {v.status === "pronto" && v.videoUrl ? (
                  <video
                    src={v.videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    poster={estado.imagemUrl ?? undefined}
                    className="size-full object-cover"
                  />
                ) : v.status === "pronto" ? (
                  // pronto, mas a URL temporária não foi assinada (soluço de
                  // rede). O vídeo existe — sem este ramo cairia no "criando...".
                  <div className="flex size-full flex-col items-center justify-center gap-2 px-4 text-center">
                    <TriangleAlert className="size-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Não deu pra carregar agora. Atualize a página.
                    </span>
                  </div>
                ) : v.status === "erro" ? (
                  <div className="flex size-full flex-col items-center justify-center gap-2 px-4 text-center">
                    <TriangleAlert className="size-5 text-destructive" />
                    <span className="text-xs text-muted-foreground">{v.erro ?? "Falhou"}</span>
                  </div>
                ) : v.status === "cancelado" ? (
                  <div className="flex size-full flex-col items-center justify-center gap-2 px-4 text-center">
                    <X className="size-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Cancelado</span>
                  </div>
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-2">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {v.status === "gerando" ? "criando..." : "na fila"}
                    </span>
                    <button
                      disabled={agindo}
                      onClick={() => agir(() => cancelarVideo(v.id))}
                      className="mt-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 p-3">
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{f?.nome ?? v.formatoKey}</p>
                {v.status === "pronto" && v.downloadUrl && (
                  // URL assinada com Content-Disposition: attachment. O atributo
                  // `download` sozinho não funciona aqui (URL de outro domínio).
                  <a
                    href={v.downloadUrl}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label="Baixar vídeo"
                  >
                    <Download className="size-4" />
                  </a>
                )}
              </div>

              {/* Legenda DESTE clipe — cada vídeo tem a sua, pra dar pra postar
                  os dois sem repetir o texto. */}
              {v.status === "pronto" && v.legenda && <LegendaDoClipe copy={v.legenda} />}
            </li>
          );
        })}
      </ul>

      {/* Só cai na legenda geral se nenhum clipe tiver a própria (vídeos feitos
          antes deste recurso) — senão apareceria repetida embaixo. */}
      {prontos.length > 0 && !temLegendaPropria && estado.copy && <Legenda copy={estado.copy} />}

      {/* Fazer mais vídeos da MESMA peça — sem recriar o produto. */}
      {escolhendo ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium">Fazer mais vídeos desta peça</h2>
            <button
              onClick={() => setEscolhendo(false)}
              aria-label="Fechar"
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          <EscolherFormatos imagemBaseId={estado.imagemBaseId} aoPedir={() => setEscolhendo(false)} />
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <Button size="lg" className="h-12 gap-1.5 sm:flex-1" onClick={() => setEscolhendo(true)}>
            <Plus className="size-4" /> Fazer mais vídeos
          </Button>
          <Button
            variant="outline"
            size="lg"
            render={<Link href={`/conta/${estado.contaId}`} />}
            nativeButton={false}
            className="h-12 sm:w-auto"
          >
            Voltar aos produtos
          </Button>
        </div>
      )}
    </Secao>
  );
}

// --- pedaços ----------------------------------------------------------------

/**
 * Escolha de formatos + quantidades → pedirVideos. Serve tanto na primeira vez
 * (produto sem vídeos) quanto no "fazer mais vídeos" da biblioteca. Tem estado
 * próprio pra não misturar os dois usos.
 */
function EscolherFormatos({
  imagemBaseId,
  aoPedir,
}: {
  imagemBaseId: string;
  aoPedir?: () => void;
}) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const [qtd, setQtd] = useState<Record<string, number>>({ falando: 1 });
  const total = Object.values(qtd).reduce((s, n) => s + n, 0);

  function alternar(key: string) {
    setQtd((q) => {
      const n = { ...q };
      if (n[key]) delete n[key];
      else n[key] = 1;
      return n;
    });
  }

  function pedir() {
    iniciar(async () => {
      try {
        const { quantos } = await pedirVideos(imagemBaseId, qtd);
        toast.success(`${quantos} ${quantos === 1 ? "vídeo entrou" : "vídeos entraram"} na fila`);
        aoPedir?.();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não deu pra pedir os vídeos.");
      }
    });
  }

  return (
    <>
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
                  <span className="block font-medium leading-snug">
                    {f.nome}
                    {f.temFala && (
                      <span className="ml-2 align-middle text-xs font-normal text-muted-foreground">com voz</span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{f.resumo}</span>
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
        disabled={total === 0 || enviando}
        onClick={pedir}
      >
        {enviando ? "Enviando..." : `Criar ${total} ${total === 1 ? "vídeo" : "vídeos"}`}
      </Button>
      <AvisoWorker />
    </>
  );
}

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

/** Versão compacta, dentro do card do vídeo. Cada clipe tem a sua legenda. */
function LegendaDoClipe({ copy }: { copy: TipoLegenda }) {
  const texto = textoLegenda(copy);

  return (
    <div className="border-t border-border px-3 pb-3 pt-2.5">
      <div className="flex items-start gap-1.5">
        <p className="min-w-0 flex-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
          {texto}
        </p>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Copiar legenda"
          className="h-6 shrink-0 px-1.5"
          onClick={() => {
            navigator.clipboard?.writeText(texto);
            toast.success("Legenda copiada");
          }}
        >
          <Copy className="size-3.5" />
        </Button>
      </div>
      <p className="mt-1 text-right text-[10px] tabular text-muted-foreground">
        {texto.length}/{LEGENDA_MAX}
      </p>
    </div>
  );
}

function Legenda({ copy }: { copy: NonNullable<EstadoProduto["copy"]> }) {
  const texto = textoLegenda(copy);

  return (
    <div className="mt-8">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium">Legenda pronta</h2>
        <span className="tabular text-xs text-muted-foreground">
          {texto.length}/{LEGENDA_MAX}
        </span>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 whitespace-pre-line text-sm text-muted-foreground">{texto}</p>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 shrink-0 gap-1 text-xs"
            onClick={() => {
              navigator.clipboard?.writeText(texto);
              toast.success("Legenda copiada");
            }}
          >
            <Copy className="size-3.5" /> Copiar
          </Button>
        </div>
      </div>
    </div>
  );
}
