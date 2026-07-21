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
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-[0_8px_30px_-6px_var(--brand)] animate-pulse-glow">
            <Clapperboard className="size-6" />
          </span>
          <span className="mt-4 font-display text-3xl leading-none">Studio</span>
          <span className="mt-2 text-sm text-muted-foreground">
            Vídeos de produto, no automático
          </span>
        </div>

        <div className="glass-card glow overflow-hidden p-6">
          <div className="relative z-10">
            <FormLogin />
          </div>
        </div>
      </div>
    </main>
  );
}
