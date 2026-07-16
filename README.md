# automacao-videos

Gera vídeos UGC de produto para afiliados do TikTok Shop, usando uma persona IA fixa por conta.

**Leia [PLAN.md](PLAN.md) antes de mexer em qualquer coisa** — arquitetura, schema, fases e as decisões que já foram tomadas (e por quê).

## Rodar

Precisa de duas coisas ligadas ao mesmo tempo: o dashboard e o worker.

```bash
npm install
cp .env.example .env.local   # preencha as chaves

npm run dev                  # dashboard  → http://localhost:3000
npm run worker               # worker     → outro terminal
```

O worker é um processo separado porque geração de vídeo leva minutos e a API do Gemini
é assíncrona. Sem ele rodando, nada sai da fila.

**Nunca rode o worker com `--watch`.** O reload mata o processo no meio de uma geração
e o job fica preso em `rodando` até o `destravar_jobs()` liberar (15 min).

## O primeiro teste que importa

Antes de ligar o resto, responda: **a API reproduz o que você já valida no Flow?**
Precisa só da `GOOGLE_API_KEY` — nem Supabase, nem Claude.

```bash
npm run testar:imagem
```

Gera a imagem base a partir de `img/persona.png` + `img/imagem produto 3.png` e salva
em `out/base-gerada.png`. Compare com `img/imagem base 3.png`, que você já aprovou.
Custa ~R$0,72.

Se rosto e closet baterem, o resto é ligar fio. Se não baterem, o prompt precisa de
ajuste antes de qualquer outra coisa.

## Testes

```bash
npm test
```

Cobre a costura do prompt de vídeo — que o formato mudo descarta o `speech`, que o
negative certo entra em cada caso, que a referência é substituída. Lógica pura, roda
sem chave nenhuma.

## Setup do Supabase

1. Crie o projeto em [supabase.com](https://supabase.com).
2. Rode as migrations **na ordem**, no SQL Editor:
   ```
   supabase/migrations/0001_initial.sql
   supabase/migrations/0002_pegar_job.sql
   ```
3. Crie o bucket de storage: **Storage → New bucket → nome `midia` → Private.**

   Tem que ser **privado**. Guarda o rosto da persona e os vídeos; o dashboard
   acessa por signed URL de validade curta (`urlAssinada()` em `src/lib/storage.ts`).
   Nunca use `getPublicUrl` aqui.
4. Copie as chaves de **Settings → API** para o `.env.local`.

RLS está **desativado** no MVP — o worker usa `service_role` e o dashboard filtra por
`user_id`. Ligar antes de qualquer usuário além dos três conhecidos.

## Onde as coisas estão

| Caminho | O quê |
|---|---|
| `src/lib/formatos.ts` | Formatos de vídeo: `briefing` (vai pro Claude) + `boilerplate` (fixo) |
| `src/lib/prompts.ts` | Prompt da imagem base — validado na mão, mexer só com medição |
| `src/lib/supabase/admin.ts` | Client `service_role`. Só server/worker, nunca browser |
| `supabase/migrations/` | Schema |
| `worker/index.ts` | Loop da fila + handlers |
| `img/` | Os 3 pares (produto → imagem base) que o Lucas validou. Few-shot e referência de qualidade |

## Status

Fase 0 (setup) pronta. Fases 1–6 em [PLAN.md](PLAN.md#8-fases).
