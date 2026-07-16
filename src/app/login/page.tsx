import { SetupFaltando } from "@/components/setup-faltando";
import { envFaltando, supabaseConfigurado } from "@/lib/env";
import { FormLogin } from "./form";

export default function Login() {
  if (!supabaseConfigurado()) return <SetupFaltando faltando={envFaltando()} />;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-12">
      <FormLogin />
    </main>
  );
}
