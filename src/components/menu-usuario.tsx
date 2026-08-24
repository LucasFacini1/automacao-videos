"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BarChart3, LayoutGrid, LogOut } from "lucide-react";
import { sair } from "@/lib/acoes";

/** Avatar do usuário → menu com "Minhas contas", "Sair" e, só pro admin, "Custos". */
export function MenuUsuario({
  inicial,
  email,
  admin = false,
}: {
  inicial: string;
  email: string;
  admin?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [saindo, iniciar] = useTransition();

  return (
    <div className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label="Menu do usuário"
        className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground ring-1 ring-border transition-colors hover:bg-accent"
      >
        {inicial}
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="glass absolute right-0 top-[calc(100%+8px)] z-50 w-56 rounded-xl p-1.5 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.6)]">
            <div className="px-2.5 py-2">
              <p className="text-xs text-muted-foreground">Conectado como</p>
              <p className="truncate text-sm font-medium">{email}</p>
            </div>
            <div className="my-1 h-px bg-border" />
            <Link
              href="/"
              onClick={() => setAberto(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground/90 transition-colors hover:bg-accent"
            >
              <LayoutGrid className="size-4 text-muted-foreground" /> Minhas contas
            </Link>
            {admin && (
              <Link
                href="/admin"
                onClick={() => setAberto(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground/90 transition-colors hover:bg-accent"
              >
                <BarChart3 className="size-4 text-muted-foreground" /> Custos
              </Link>
            )}
            <button
              disabled={saindo}
              onClick={() => iniciar(() => sair())}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground/90 transition-colors hover:bg-accent disabled:opacity-50"
            >
              <LogOut className="size-4 text-muted-foreground" /> {saindo ? "Saindo..." : "Sair"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
