import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Clapperboard } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/admin";
import { Tutorial } from "@/components/tutorial";
import { MenuUsuario } from "@/components/menu-usuario";

/**
 * Barra de topo do app.
 *  - No hub: marca do produto + menu do usuário.
 *  - Dentro de uma conta: volta pro hub + a conta atual (nunca perder de vista
 *    em qual conta está mexendo — postar na errada é o erro óbvio de multi-conta).
 *
 * O menu do usuário (com Sair) aparece em TODA tela, pra logout ser sempre
 * alcançável.
 */
export async function Cabecalho({
  conta,
}: {
  conta?: { handle: string; personaUrl: string | null };
}) {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  const email = user?.email ?? "";
  const inicial = (email[0] ?? "?").toUpperCase();
  const admin = await ehAdmin();

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6">
        {conta ? (
          <>
            <Link
              href="/"
              aria-label="Voltar para as contas"
              className="-ml-1.5 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="size-5" />
            </Link>
            <div className="flex min-w-0 items-center gap-2.5">
              {conta.personaUrl ? (
                <Image
                  src={conta.personaUrl}
                  alt=""
                  width={28}
                  height={28}
                  className="size-7 shrink-0 rounded-full object-cover object-top ring-1 ring-border"
                />
              ) : (
                <span className="size-7 shrink-0 rounded-full bg-muted ring-1 ring-border" />
              )}
              <span className="truncate text-sm font-medium">{conta.handle}</span>
            </div>
          </>
        ) : (
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Clapperboard className="size-4.5" />
            </span>
            <span className="font-display text-xl leading-none">Studio</span>
          </Link>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <Tutorial />
          <MenuUsuario inicial={inicial} email={email} admin={admin} />
        </div>
      </div>
    </header>
  );
}
