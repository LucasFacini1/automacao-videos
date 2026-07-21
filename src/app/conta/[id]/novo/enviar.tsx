"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarProduto } from "@/lib/acoes";
import { CUSTO_IMAGEM, formatarBRL } from "@/lib/custos";

/**
 * Envio do produto. Grava de verdade e enfileira a geração da foto — daí em
 * diante quem trabalha é o worker, e a tela do produto acompanha pelo banco.
 */
export function Enviar({ contaId }: { contaId: string }) {
  const router = useRouter();
  const inputFile = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setArquivo(f);
    setPreview(URL.createObjectURL(f));
    if (!nome) setNome(f.name.replace(/\.[^.]+$/, "").slice(0, 60));
  }

  function enviar() {
    if (!arquivo) return;
    setErro(null);
    iniciar(async () => {
      try {
        const fd = new FormData();
        fd.set("contaId", contaId);
        fd.set("foto", arquivo);
        fd.set("nome", nome);
        const { imagemBaseId } = await criarProduto(fd);
        router.push(`/conta/${contaId}/produto/${imagemBaseId}`);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não deu pra enviar.");
      }
    });
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-semibold">Novo produto</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tire um print da foto do produto no TikTok Shop e envie aqui.
      </p>

      <input
        ref={inputFile}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={escolher}
      />

      {preview ? (
        <div className="mt-6 space-y-5">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
            <Image
              src={preview}
              alt="Foto escolhida"
              width={480}
              height={640}
              className="max-h-[22rem] w-full object-contain"
              unoptimized
            />
            <button
              onClick={() => {
                setArquivo(null);
                setPreview(null);
                if (inputFile.current) inputFile.current.value = "";
              }}
              aria-label="Remover foto"
              className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-foreground/70 text-background backdrop-blur-sm transition-colors hover:bg-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome">Nome do produto</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Body preto de recorte"
              className="h-11"
            />
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputFile.current?.click()}
          className="mt-6 flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card/50 transition-colors hover:border-foreground/25 hover:bg-card"
        >
          <span className="flex size-12 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
            <ImagePlus className="size-6" />
          </span>
          <span className="font-medium">Escolher foto</span>
          <span className="max-w-[17rem] text-center text-sm text-muted-foreground">
            Pode ser só a roupa. Não precisa cortar nem editar nada.
          </span>
        </button>
      )}

      {erro && <p className="mt-4 text-sm text-destructive">{erro}</p>}

      <div className="mt-6 flex items-center justify-between gap-3 rounded-xl bg-secondary/50 px-4 py-3">
        <span className="text-sm text-muted-foreground">Custo desta foto</span>
        <span className="text-sm font-medium tabular">{formatarBRL(CUSTO_IMAGEM)}</span>
      </div>

      <Button
        size="lg"
        disabled={!arquivo || enviando}
        onClick={enviar}
        className="mt-4 h-12 w-full text-base"
      >
        {enviando ? "Enviando..." : "Criar a foto"}
      </Button>
    </main>
  );
}
