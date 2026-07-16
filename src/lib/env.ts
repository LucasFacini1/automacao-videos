/**
 * Sem .env.local o app inteiro quebraria com stack trace do Supabase.
 * Em vez disso: detecta e mostra a tela de setup (src/app/setup.tsx).
 *
 * Também permite desenhar/revisar a UI antes do Supabase existir.
 */

export function supabaseConfigurado(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function envFaltando(): string[] {
  const necessarias = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GOOGLE_API_KEY",
    "ANTHROPIC_API_KEY",
  ];
  return necessarias.filter((k) => !process.env[k]);
}
