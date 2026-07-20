import { Clapperboard } from "lucide-react";
import { SetupFaltando } from "@/components/setup-faltando";
import { envFaltando, supabaseConfigurado } from "@/lib/env";
import { FormLogin } from "./form";

export default function Login() {
  if (!supabaseConfigurado()) return <SetupFaltando faltando={envFaltando()} />;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Clapperboard className="size-6" />
          </span>
          <span className="mt-3 text-lg font-semibold tracking-tight">Studio</span>
          <span className="text-sm text-muted-foreground">Vídeos de produto, no automático</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_1px_3px_rgb(0_0_0/0.04)]">
          <FormLogin />
        </div>
      </div>
    </main>
  );
}
