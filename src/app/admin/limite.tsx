"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { definirLimiteUsuario } from "@/lib/acoes";

/**
 * Editor do teto mensal de UM usuário, na tabela do /admin.
 * Vazio/0 = essa pessoa usa o padrão do env (mostrado no placeholder).
 */
export function LimiteUsuario({
  userId,
  limite,
  tetoPadrao,
}: {
  userId: string;
  limite: number;
  tetoPadrao: number;
}) {
  const [valor, setValor] = useState(limite ? String(limite) : "");
  const [salvando, iniciar] = useTransition();

  function salvar() {
    iniciar(async () => {
      try {
        await definirLimiteUsuario(userId, Number(valor) || 0);
        toast.success("Limite salvo");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não deu pra salvar.");
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Input
        value={valor}
        onChange={(e) => setValor(e.target.value.replace(/[^\d.,]/g, "").replace(",", "."))}
        placeholder={tetoPadrao ? String(tetoPadrao) : "sem teto"}
        inputMode="decimal"
        aria-label="Limite mensal em reais"
        className="h-8 w-24 text-right tabular"
      />
      <Button size="sm" variant="outline" className="h-8" disabled={salvando} onClick={salvar}>
        {salvando ? "..." : "Salvar"}
      </Button>
    </div>
  );
}
