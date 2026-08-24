"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Tutorial. Ela vai usar isso sozinha — ver PLAN.md §8, Fase 4.
 * Linguagem sem jargão: nada de "gerar", "prompt", "IA", "job".
 */
const PASSOS = [
  {
    titulo: "Tire print do produto",
    texto:
      "Achou uma peça boa pra vender? Tire um print da foto. Pode ser só a roupa, não precisa aparecer rosto nem cortar nada.",
    dica: "Print mesmo, do jeito que está. Não precisa editar.",
  },
  {
    titulo: "Confira a foto",
    texto:
      "Em menos de um minuto a foto fica pronta com a roupa vestida. Olhe se a peça ficou igual à do anúncio — mesma cor, mesmo modelo, mesmas alças.",
    dica: "Se ficou diferente, toque em Refazer. Não custa quase nada e é melhor do que postar errado.",
  },
  {
    titulo: "Escolha os vídeos",
    texto:
      "Marque os tipos de vídeo que você quer daquela peça. Dá pra pedir mais de um do mesmo tipo, que sai diferente cada vez.",
    dica: "Cada vídeo tem um custo. Aparece na tela antes de você confirmar.",
  },
  {
    titulo: "Baixe e poste",
    texto:
      "Quando ficar pronto, baixe o vídeo e a legenda já vem escrita pra você copiar. É só postar junto com seu link, onde você vende (TikTok, Shopee...).",
    dica: "Os vídeos ficam guardados. Dá pra baixar de novo depois.",
  },
];

export function Tutorial() {
  const [aberto, setAberto] = useState(false);
  const [i, setI] = useState(0);
  const passo = PASSOS[i];
  const ultimo = i === PASSOS.length - 1;

  // Primeira visita de todas: abre sozinho, uma única vez. Ela não precisa saber
  // que existe um botão "Como funciona" — o passo a passo aparece na cara dela.
  useEffect(() => {
    try {
      if (!localStorage.getItem("studio_tutorial_visto")) {
        localStorage.setItem("studio_tutorial_visto", "1");
        // Sincronização legítima com um sistema externo (localStorage) uma vez na
        // montagem — exatamente o caso que a regra abaixo super-restringe.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAberto(true);
      }
    } catch {
      // localStorage bloqueado (aba privada etc.) — sem auto-abrir, sem quebrar.
    }
  }, []);

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (!v) setI(0);
      }}
    >
      <DialogTrigger
        render={<Button variant="ghost" size="sm" className="text-muted-foreground" />}
      >
        Como funciona
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-1.5">
            {PASSOS.map((_, n) => (
              <span
                key={n}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  n <= i ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
          <DialogTitle className="text-left text-xl">
            {i + 1}. {passo.titulo}
          </DialogTitle>
          <DialogDescription className="text-left text-base leading-relaxed text-foreground/80">
            {passo.texto}
          </DialogDescription>
        </DialogHeader>

        <p className="rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
          {passo.dica}
        </p>

        <div className="flex gap-2">
          {i > 0 && (
            <Button variant="outline" className="flex-1" onClick={() => setI(i - 1)}>
              Voltar
            </Button>
          )}
          <Button
            className="flex-1"
            onClick={() => (ultimo ? setAberto(false) : setI(i + 1))}
          >
            {ultimo ? "Entendi" : "Próximo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
