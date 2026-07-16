/**
 * Tela mostrada quando o .env.local não está configurado.
 * Existe para o app não explodir com stack trace do Supabase — e para dar o
 * passo a passo em vez de deixar quem clonou adivinhando.
 */
export function SetupFaltando({ faltando }: { faltando: string[] }) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Falta configurar</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        O app não sobe sem as chaves. É uma vez só.
      </p>

      <ol className="mt-6 space-y-4 text-sm">
        <li className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
            1
          </span>
          <span>
            Crie o projeto em{" "}
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline underline-offset-4"
            >
              supabase.com
            </a>
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
            2
          </span>
          <span>
            No SQL Editor, rode as migrations de <code className="text-xs">supabase/migrations/</code>{" "}
            na ordem
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
            3
          </span>
          <span>
            Storage → New bucket → nome <code className="text-xs">midia</code> →{" "}
            <strong>Private</strong>
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
            4
          </span>
          <span>
            <code className="text-xs">cp .env.example .env.local</code> e preencha
          </span>
        </li>
      </ol>

      <div className="mt-6 rounded-xl border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground">Faltando agora</p>
        <ul className="mt-2 space-y-1">
          {faltando.map((k) => (
            <li key={k} className="font-mono text-xs text-destructive">
              {k}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-5 text-xs text-muted-foreground">
        Depois de preencher, reinicie o <code>npm run dev</code> — o Next só lê o .env no boot.
      </p>
    </main>
  );
}
