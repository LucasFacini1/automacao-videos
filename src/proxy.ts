import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Proxy (era "middleware" antes do Next 16 — renomeado, mesma função).
 *
 * Renova a sessão do Supabase a cada request e barra quem não está logado.
 *
 * IMPORTANTE: usar `NextResponse.next()` puro. No Next 16, `NextResponse.next({
 * request })` (padrão antigo do Supabase SSR) faz a rota casada cair em 404.
 * Os cookies renovados são escritos na resposta; nos redirects, copiados à mão.
 *
 * Sem as chaves do Supabase, deixa passar — pra UI ainda rodar/revisar offline.
 */
const PUBLICAS = ["/login", "/auth"];

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const publica = PUBLICAS.some((p) => path.startsWith(p));

  // Redireciona copiando os cookies que o refresh acabou de setar.
  const redirecionar = (para: string) => {
    const r = NextResponse.redirect(new URL(para, request.nextUrl));
    for (const c of response.cookies.getAll()) r.cookies.set(c);
    return r;
  };

  if (!user && !publica) return redirecionar("/login");
  if (user && path === "/login") return redirecionar("/");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|img/|.*\\.png$).*)"],
};
