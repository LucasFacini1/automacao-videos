"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { excluirConta } from "@/lib/acoes";

/**
 * Exclusão de conta. Irreversível e leva junto produtos, fotos e vídeos —
 * por isso exige digitar o @ da conta, não só um "tem certeza?".
 */
export function ExcluirConta({ contaId, handle }: { contaId: string; handle: string }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, iniciar] = useTransition();

  const alvo = handle.replace(/^@/, "");
  const confere = texto.replace(/^@/, "").trim() === alvo;

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (!v) {
          setTexto("");
          setErro(null);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          />
        }
      >
        <Trash2 className="size-4" />
        Excluir conta
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-left">Excluir {handle}?</DialogTitle>
          <DialogDescription className="text-left leading-relaxed">
            Some tudo: a modelo, os produtos, as fotos e os vídeos já gerados. Não dá pra
            desfazer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor="confirmar" className="text-sm text-muted-foreground">
            Para confirmar, digite <span className="font-medium text-foreground">{alvo}</span>
          </label>
          <Input
            id="confirmar"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={alvo}
            autoComplete="off"
            className="h-11"
          />
        </div>

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            disabled={!confere || excluindo}
            onClick={() =>
              iniciar(async () => {
                setErro(null);
                try {
                  await excluirConta(contaId);
                } catch (e) {
                  setErro(e instanceof Error ? e.message : "Não deu pra excluir.");
                }
              })
            }
          >
            {excluindo ? "Excluindo..." : "Excluir"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
