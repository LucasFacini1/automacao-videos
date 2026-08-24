"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Clapperboard, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { excluirProdutos } from "@/lib/acoes";
import type { ProdutoLista, StatusImagem } from "@/lib/dados";

const ROTULO: Record<StatusImagem, string> = {
  gerando: "Criando a foto",
  pronta: "Confira a foto",
  aprovada: "Aprovada",
  rejeitada: "Refeita",
  erro: "Deu erro",
  cancelada: "Cancelada",
};

const TOM: Record<StatusImagem, string> = {
  gerando: "bg-secondary text-muted-foreground",
  pronta: "bg-brand/10 text-brand ring-1 ring-brand/20",
  aprovada: "bg-secondary text-muted-foreground",
  rejeitada: "bg-secondary text-muted-foreground",
  erro: "bg-destructive/10 text-destructive ring-1 ring-destructive/20",
  cancelada: "bg-secondary text-muted-foreground",
};

/** Grade de produtos com seleção (bolinha) pra excluir em lote. */
export function ListaProdutos({ contaId, produtos }: { contaId: string; produtos: ProdutoLista[] }) {
  const router = useRouter();
  const [agindo, iniciar] = useTransition();
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const nSel = selecionados.size;

  function alternar(id: string) {
    setSelecionados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function excluir() {
    const ids = [...selecionados];
    if (ids.length === 0) return;
    if (
      !confirm(
        `Apagar ${ids.length} ${ids.length === 1 ? "produto" : "produtos"}? Isso apaga também as fotos e os vídeos deles. Não dá pra desfazer.`,
      )
    ) {
      return;
    }
    iniciar(async () => {
      try {
        await excluirProdutos(ids);
        setSelecionados(new Set());
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não deu pra apagar.");
      }
    });
  }

  return (
    <>
      {nSel > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-border bg-secondary/50 px-4 py-2.5">
          <span className="text-sm font-medium">
            {nSel} {nSel === 1 ? "selecionado" : "selecionados"}
          </span>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" disabled={agindo} onClick={() => setSelecionados(new Set())}>
              Limpar
            </Button>
            <Button
              size="sm"
              disabled={agindo}
              onClick={excluir}
              className="gap-1.5 bg-destructive text-white hover:bg-destructive/90"
            >
              <Trash2 className="size-4" /> Excluir
            </Button>
          </div>
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {produtos.map((p) => {
          const sel = selecionados.has(p.id);
          return (
            <li key={p.id}>
              <Link
                href={p.imagemBaseId ? `/conta/${contaId}/produto/${p.imagemBaseId}` : `/conta/${contaId}`}
                className={`group flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-all hover:shadow-[0_2px_16px_-4px_rgb(0_0_0/0.08)] ${
                  sel ? "border-primary ring-1 ring-primary" : "border-border hover:border-foreground/15"
                }`}
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
                  {/* Bolinha de seleção — não navega ao clicar. */}
                  <button
                    type="button"
                    aria-label={sel ? "Desmarcar produto" : "Marcar produto"}
                    aria-pressed={sel}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      alternar(p.id);
                    }}
                    className={`absolute left-2 top-2 z-10 flex size-7 items-center justify-center rounded-full border-2 shadow-sm transition-colors ${
                      sel
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-white/80 bg-black/35 text-transparent backdrop-blur-sm hover:bg-black/50"
                    }`}
                  >
                    <Check className="size-4" />
                  </button>

                  {p.thumbUrl ? (
                    <Image
                      src={p.thumbUrl}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 90vw"
                      className="object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    // sem thumb: ou ainda está gerando, ou a URL temporária não
                    // foi assinada. Não dizer "criando..." no segundo caso.
                    <span className="flex h-full items-center justify-center px-3 text-center text-sm text-muted-foreground">
                      {p.statusImagem === "gerando" ? "criando..." : "sem prévia"}
                    </span>
                  )}
                  {p.videosProntos > 0 && (
                    <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-foreground/80 px-1.5 py-0.5 text-[11px] font-medium text-background backdrop-blur-sm">
                      <Clapperboard className="size-3" />
                      {p.videosProntos}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3.5">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{p.nome}</p>
                  {p.statusImagem && (
                    <span
                      className={`mt-auto w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${TOM[p.statusImagem]}`}
                    >
                      {ROTULO[p.statusImagem]}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
