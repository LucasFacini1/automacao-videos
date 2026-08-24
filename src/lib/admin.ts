import "server-only";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { usuarioLogado } from "@/lib/sessao";

/**
 * Área de admin: monitoramento de custos. NUNCA aparece pro usuário final — o
 * gate é o email em ADMIN_EMAIL (.env.local). Sem essa env, /admin não existe
 * pra ninguém (ehAdmin() sempre falso).
 */

export function adminConfigurado(): boolean {
  return Boolean(process.env.ADMIN_EMAIL?.trim());
}

export async function ehAdmin(): Promise<boolean> {
  const alvo = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!alvo) return false;
  const user = await usuarioLogado();
  return Boolean(user?.email && user.email.toLowerCase() === alvo);
}

/** Barra a entrada de quem não é admin. Usar no topo de toda tela/dados de admin. */
async function exigirAdmin(): Promise<void> {
  if (!(await ehAdmin())) redirect("/");
}

export type EventoCusto = {
  id: string;
  quando: string;
  email: string;
  conta: string;
  tipo: "imagem" | "video";
  formato: string | null;
  custo: number;
  status: string;
};

export type ResumoUsuario = {
  userId: string;
  email: string;
  imagens: number;
  videos: number;
  /** Gasto de todos os tempos. */
  total: number;
  /** Gasto do mês corrente — é o que o teto compara. */
  totalMes: number;
  /** Teto mensal próprio (0 = usa o padrão do env). */
  limite: number;
};

export type PainelAdmin = {
  totalGeral: number;
  totalMes: number;
  imagens: number;
  videos: number;
  /** Teto do env (TETO_MENSAL_BRL), usado por quem não tem limite próprio. */
  tetoPadrao: number;
  porUsuario: ResumoUsuario[];
  eventos: EventoCusto[];
};

/**
 * Tudo que o /admin mostra. Agrega sobre os últimos eventos (volume baixo, cabe
 * de sobra) e resolve o email de cada user_id via a API admin do Supabase.
 */
export async function dadosAdmin(): Promise<PainelAdmin> {
  await exigirAdmin();
  const db = createAdminClient();

  const { data: eventosRaw, error } = await db
    .from("custo_evento")
    .select("id, user_id, tipo, formato_key, custo, status, created_at, conta:conta_id(handle)")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`dadosAdmin: ${error.message}`);

  const { data: usersData } = await db.auth.admin.listUsers();
  const emailPorId = new Map((usersData?.users ?? []).map((u) => [u.id, u.email ?? u.id]));

  // limites já definidos (quem não tem linha usa o padrão do env)
  const { data: limitesRaw } = await db.from("limite_usuario").select("user_id, limite_mensal");
  const limitePorId = new Map(
    ((limitesRaw ?? []) as { user_id: string; limite_mensal: number }[]).map((l) => [
      l.user_id,
      Number(l.limite_mensal) || 0,
    ]),
  );

  type Raw = {
    id: string;
    user_id: string;
    tipo: "imagem" | "video";
    formato_key: string | null;
    custo: number;
    status: string;
    created_at: string;
    conta: { handle: string } | null;
  };

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  let totalGeral = 0;
  let totalMes = 0;
  let imagens = 0;
  let videos = 0;
  const eventos: EventoCusto[] = [];

  // Começa por TODOS os usuários (não só quem já gastou), pra dar pra definir
  // limite de alguém antes da primeira geração.
  const porUsuario = new Map<string, ResumoUsuario>(
    (usersData?.users ?? []).map((u) => [
      u.id,
      {
        userId: u.id,
        email: u.email ?? u.id,
        imagens: 0,
        videos: 0,
        total: 0,
        totalMes: 0,
        limite: limitePorId.get(u.id) ?? 0,
      },
    ]),
  );

  for (const r of (eventosRaw ?? []) as unknown as Raw[]) {
    const email = emailPorId.get(r.user_id) ?? r.user_id;
    const custo = Number(r.custo);
    const noMes = new Date(r.created_at) >= inicioMes;

    totalGeral += custo;
    if (noMes) totalMes += custo;
    if (r.tipo === "imagem") imagens++;
    else videos++;

    const u = porUsuario.get(r.user_id) ?? {
      userId: r.user_id,
      email,
      imagens: 0,
      videos: 0,
      total: 0,
      totalMes: 0,
      limite: limitePorId.get(r.user_id) ?? 0,
    };
    if (r.tipo === "imagem") u.imagens++;
    else u.videos++;
    u.total += custo;
    if (noMes) u.totalMes += custo;
    porUsuario.set(r.user_id, u);

    eventos.push({
      id: r.id,
      quando: r.created_at,
      email,
      conta: r.conta?.handle ?? "—",
      tipo: r.tipo,
      formato: r.formato_key,
      custo,
      status: r.status,
    });
  }

  return {
    totalGeral,
    totalMes,
    imagens,
    videos,
    tetoPadrao: Number(process.env.TETO_MENSAL_BRL ?? 0) || 0,
    porUsuario: [...porUsuario.values()].sort((a, b) => b.totalMes - a.totalMes),
    eventos,
  };
}
