/**
 * Worker. Ver PLAN.md §7.
 *
 * Roda separado do Next porque geração de vídeo leva minutos e a API do Gemini
 * é assíncrona — não cabe em função serverless. Local agora, Railway depois.
 *
 *   npm run worker
 *
 * Nunca usar --watch: o reload mata o processo no meio de uma geração e o job
 * fica preso em 'rodando' até o destravar_jobs() liberar.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const INTERVALO_MS = 3000;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Copie .env.example para .env.local e preencha.");
  process.exit(1);
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Job = {
  id: string;
  tipo: "gerar_imagem" | "analisar" | "gerar_video";
  ref_id: string;
  tentativas: number;
};

// --- handlers: Fases 2 e 3 ---------------------------------------------------

async function gerarImagem(_job: Job): Promise<void> {
  throw new Error("gerar_imagem: não implementado (Fase 2)");
}

async function analisar(_job: Job): Promise<void> {
  throw new Error("analisar: não implementado (Fase 3)");
}

async function gerarVideo(_job: Job): Promise<void> {
  throw new Error("gerar_video: não implementado (Fase 3)");
}

const HANDLERS: Record<Job["tipo"], (job: Job) => Promise<void>> = {
  gerar_imagem: gerarImagem,
  analisar: analisar,
  gerar_video: gerarVideo,
};

// --- loop --------------------------------------------------------------------

async function processarUm(): Promise<boolean> {
  const { data, error } = await db.rpc("pegar_job");
  if (error) throw new Error(`pegar_job falhou: ${error.message}`);

  const job = (data as Job[] | null)?.[0];
  if (!job) return false;

  console.log(`[${job.tipo}] ${job.id} (tentativa ${job.tentativas})`);

  try {
    await HANDLERS[job.tipo](job);
    await db.from("job").update({ status: "ok" }).eq("id", job.id);
    console.log(`[${job.tipo}] ${job.id} ok`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // tentativas já foi incrementado por pegar_job(); volta pra fila até o teto.
    const desistiu = job.tentativas >= 3;
    await db
      .from("job")
      .update({ status: desistiu ? "erro" : "pendente", ultimo_erro: msg, locked_at: null })
      .eq("id", job.id);
    console.error(`[${job.tipo}] ${job.id} ${desistiu ? "ERRO FINAL" : "falhou, vai retentar"}: ${msg}`);
  }

  return true;
}

async function main() {
  const { data: destravados } = await db.rpc("destravar_jobs");
  if (destravados) console.log(`${destravados} job(s) travado(s) devolvido(s) à fila`);

  console.log("worker rodando. ctrl+c pra parar.");

  let parar = false;
  process.on("SIGINT", () => {
    console.log("\nterminando o job atual antes de sair...");
    parar = true;
  });

  while (!parar) {
    try {
      const trabalhou = await processarUm();
      if (!trabalhou) await new Promise((r) => setTimeout(r, INTERVALO_MS));
    } catch (e) {
      console.error("erro no loop:", e instanceof Error ? e.message : e);
      await new Promise((r) => setTimeout(r, INTERVALO_MS));
    }
  }

  process.exit(0);
}

main();
