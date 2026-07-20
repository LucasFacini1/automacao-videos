import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * ID do usuário logado, a partir do cookie de sessão.
 *
 * O acesso ao banco em si é feito com o cliente admin (service_role), que ignora
 * a RLS — o que separa as contas é o filtro por este user_id em toda query
 * (ver dados.ts / acoes.ts). O service_role nunca sai do servidor.
 */
export async function usuarioLogadoId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function usuarioLogado() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
