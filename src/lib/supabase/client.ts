"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Client do browser. Usa a anon key — RLS/filtro por user_id é quem protege. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
