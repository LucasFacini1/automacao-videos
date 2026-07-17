import Image from "next/image";
import Link from "next/link";
import { USUARIO } from "@/lib/mock";
import { Tutorial } from "@/components/tutorial";

/**
 * Cabeçalho contextual.
 *
 * - No hub (sem conta): mostra o usuário.
 * - Dentro de uma conta: mostra a conta + um "voltar" pro hub, pra deixar
 *   claro em qual conta ela está mexendo. Sistema multi-conta: perder esse
 *   contexto é postar produto na conta errada.
 */
export function Cabecalho({
  conta,
}: {
  conta?: { handle: string; personaUrl: string };
}) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
        {conta ? (
          <>
            <Link
              href="/"
              aria-label="Voltar para minhas contas"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              ‹
            </Link>
            <Image
              src={conta.personaUrl}
              alt=""
              width={32}
              height={32}
              className="size-8 shrink-0 rounded-full object-cover object-top ring-1 ring-border"
            />
            <span className="truncate text-sm font-medium">{conta.handle}</span>
          </>
        ) : (
          <>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
              {USUARIO.inicial}
            </span>
            <span className="truncate text-sm font-medium">{USUARIO.nome}</span>
          </>
        )}
        <div className="ml-auto">
          <Tutorial />
        </div>
      </div>
    </header>
  );
}
