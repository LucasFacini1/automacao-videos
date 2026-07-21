# Plano técnico — Automação de vídeos (TikTok Shop afiliados)

## 1. O que o sistema faz

Transforma a foto de um produto do TikTok Shop em vídeos UGC prontos pra postar, usando uma persona IA fixa por conta.

```
foto do produto  →  imagem base (persona vestindo a peça no closet)
                         ↓
                   [ APROVAR ]  ← usuário decide aqui, antes de gastar com vídeo
                         ↓
              direção + copy PT-BR (Gemini Flash-Lite)
                         ↓
                template do formato (código)
                         ↓
                 N clipes 9:16 (Veo 3.1 Fast)
                         ↓
                  biblioteca → download
```

O gate de aprovação existe porque imagem custa R$0,72 e vídeo custa R$5,40. Errar barato.

## 2. Stack

| Camada | Escolha |
|---|---|
| Front | Next.js 16.2 + React 19.2 + Tailwind 4 + shadcn/ui |
| Auth / DB / Storage | Supabase |
| Fila | Tabela `job` no Postgres (`SELECT ... FOR UPDATE SKIP LOCKED`) |
| Worker | Processo Node separado — local agora, Railway depois |
| Imagem | `gemini-3-pro-image` (Nano Banana **Pro** — o mesmo que o Lucas usa no Flow) |
| Direção + copy | `gemini-3.1-flash-lite` (visão + direção + copy PT-BR) |
| Vídeo | `veo-3.1-fast-generate-preview` (8s, image-to-video) |

**Por que o worker é separado:** a API de vídeo é assíncrona (devolve uma operação, você consulta até ficar pronto) e leva minutos. Não cabe em função serverless. Dashboard vai pra Vercel, worker vai pra Railway. Desacoplado desde já = zero refatoração depois.

> **Nota de versão:** o plano original dizia Next 15 + Tailwind 3. O `create-next-app@latest` instalou **Next 16.2 + Tailwind 4** (mais novo, não mais velho). Diferença prática: Tailwind 4 configura por CSS (`src/app/globals.css`), sem `tailwind.config.js`.

## 3. Schema

```sql
-- auth.users vem do Supabase

conta
  id, user_id → auth.users, handle, nome, ativo, created_at

persona                          -- 1 por conta
  id, conta_id → conta (unique),
  ref_image_url,                 -- CONGELADA. Ver §3.1

  cenario     text,              -- "modern walk-in closet"
  cabelo      text,              -- preenche [CABELO]
  make        text,              -- preenche [MAKE]
  unhas       text,
  created_at, updated_at

produto
  id, conta_id → conta, nome, image_url,
  link_afiliado text null, preco numeric null, created_at

imagem_base
  id, produto_id → produto, image_url null,
  status  text,   -- gerando | pronta | aprovada | rejeitada | erro
  prompt_usado text, erro text null, created_at

analise                          -- saída do modelo de direção, 1 por imagem_base aprovada
  id, imagem_base_id → imagem_base (unique),
  descricao_roupa text,          -- em inglês, entra no prompt de vídeo
  copy jsonb,                    -- { texto_tela: [...], descricao, hashtags: [...] }
  created_at

video
  id, imagem_base_id → imagem_base, formato_key text,
  status text,  -- na_fila | gerando | pronto | erro
  video_url null, duracao_s int, prompt_final text, erro text null,
  created_at

job
  id, tipo text,        -- gerar_imagem | analisar | gerar_video
  ref_id uuid,          -- aponta pro registro do tipo correspondente
  status text,          -- pendente | rodando | ok | erro
  tentativas int default 0, ultimo_erro text null,
  locked_at timestamptz null, created_at
```

**RLS e acesso.** O Supabase cria as tabelas com RLS **ligada**. Em vez de desligar,
todo acesso do servidor (dashboard e worker) usa o cliente **`service_role`**, que a
ignora — e o que separa um usuário do outro é o **filtro por `user_id`** em `dados.ts` /
`acoes.ts`. A `service_role` nunca sai do servidor (só server components, server actions
e worker). Se um dia o acesso passar a vir do browser, aí sim é preciso escrever policies.

> Já custou tempo: usar o cliente *autenticado* nas escritas dá
> `new row violates row-level security policy`, porque não há policy nenhuma.

### 3.1 A referência da persona é congelada

`persona.ref_image_url` é definida **uma vez**, no setup da conta, e toda geração aponta sempre pra ela. Pode ser uma imagem base que o usuário já aprovou — o que importa é que seja **fixa**.

**Nunca** usar "a imagem base mais recente" como referência. Isso cria degradação geracional: base 2 gerada a partir da base 1, base 3 a partir da base 2, cada uma desviando um pouco. Xerox de xerox — em algumas dezenas de produtos a persona virou outra pessoa, sem nenhum passo isolado parecer errado. As alças que apareceram no vestido floral e o colar de pérolas no body são exatamente esse tipo de desvio; realimentados, acumulam.

Trocar a referência é ação deliberada no setup. Se um dia der pra promover uma base a referência, é um botão explícito na biblioteca — nunca automático.

## 4. Formatos de vídeo

Ficam em código (`lib/formatos.ts`), como array tipado:

```ts
type Formato = {
  key: string;            // "talking" | "achado_do_dia" | "nota_1_a_10"
  nome: string;           // rótulo no dashboard
  tem_fala: boolean;
  duracao_s: number;
  briefing: string;       // o que esse formato é — vai pro modelo junto com a imagem
  boilerplate: string;    // referência + constraints + negative (§5)
};
```

O `briefing` descreve a intenção do formato ("recurring 'find of the day' reveal — energetic and branded, same opening/closing pose every episode"); o modelo escreve a direção dentro dela.

**Provisórios** — os três de hoje. O shape mapeia 1:1 pra uma tabela `formato`, então virar biblioteca editável (dancinhas, movimento, desfilando) é migração pequena, não refatoração. Fica pra depois do MVP rodar.

## 5. O que o modelo de direção faz (e o que não faz)

> **Nota:** este passo rodava no Claude Sonnet e passou para o **Gemini Flash-Lite**.
> Motivo: precisa de **visão** (ler a peça na imagem base), custa ~10x menos, e usa a
> mesma chave da imagem/vídeo — uma credencial só no projeto. A API do DeepSeek foi
> considerada e **descartada: é text-only**, não enxerga a imagem, então produziria
> direção genérica.


O prompt de vídeo tem duas metades: **boilerplate** e **direção**.

**Boilerplate — fica em código, o modelo nunca toca.** É o que é igual em todo vídeo, e é onde um modelo derrapa se deixado solto:

- a linha `[Reference: ...]` + `Same woman and closet as her usual reference`
- `Handheld vertical phone video, soft natural lighting, realistic casual UGC, 9:16, ~8s`
- o `Negative:` completo
- a duração e o aspect ratio

**Direção — o modelo escreve, olhando a imagem base.** É o que muda conforme a peça, e é onde está o valor:

| Campo | Por que é variável |
|---|---|
| `framing` | Close na gola? Corpo inteiro pro caimento? Depende da peça |
| `movement` | *"touches the cutout detail at the chest"* só existe se a peça tiver cutout |
| `destaque` | Qual detalhe vende essa peça específica |
| `speech` | Só nos formatos com fala |
| `copy` | Texto de tela com timings, descrição, hashtags — PT-BR |

Uma chamada, structured output (`responseMimeType: "application/json"` + `responseJsonSchema`), JSON garantido. O worker costura direção + boilerplate e manda pro Veo 3.1.

**A regra:** se o campo seria idêntico entre uma peça e outra, é boilerplate. Se muda com a peça, é direção.

## 6. Telas

| # | Tela | Conteúdo |
|---|---|---|
| 1 | Login | Supabase Auth |
| 2 | Minhas contas | Lista + criar. Vazia → CTA de onboarding |
| 3 | Setup da persona | Wizard: upload da referência → cenário → cabelo/make/unhas → preview |
| 4 | Novo produto | Upload da foto → progresso → **imagem base + Aprovar / Refazer** |
| 5 | Escolher vídeos | Cards dos formatos, checkbox + quantidade → estimativa de custo → Gerar |
| 6 | Biblioteca | Vídeos por produto, status ao vivo, player, download, copy pra colar |

Mobile-first — ela vai usar no celular. Modais de tutorial em 3, 4 e 5.

## 7. Worker

Loop simples: pega job pendente → despacha por tipo → grava resultado → marca ok/erro. Retry com backoff, máx 3 tentativas. `gerar_video` faz polling da operação do Gemini.

`npm run worker` — sem `--watch` (mata o processo no meio da geração).

## 8. Fases

| Fase | Entrega | Pronto quando |
|---|---|---|
| **0** | Setup: Next, Supabase, schema, auth, envs | Login funciona |
| **1** | Contas + persona | Persona salva e renderiza no preview |
| **2** | Produto → imagem base → aprovação | Imagem base sai igual às que você faz no Flow (mesmo modelo, então é conferência, não aposta) |
| **3** | Análise + geração de vídeo + biblioteca | 1 vídeo end-to-end sem tocar no Flow |
| **4** | Polimento: tutoriais, onboarding, responsivo | Sua tia usa sozinha, sem você por perto |
| **5** | Deploy: Vercel + Railway | Funciona com teu PC desligado |
| **6** | TikTok: agendamento + rascunho | 1 toque pra publicar |

Fases 4 e 5 **não são opcionais** — são o motivo do projeto existir. Mas vêm depois do fluxo funcionar.

**Backlog:** biblioteca de formatos (dancinhas, movimento, desfilando).

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Veo 3.1 é `preview` — API pode mudar; e o "Omni Flash" do Flow NÃO gera vídeo pela API (só `generateContent`), por isso usamos Veo | Isolar atrás de `gemini.ts` |
| Imagem base sai errada (rosto muda, roupa muda) | Baixo — é o mesmo Nano Banana Pro, mesmo prompt, mesmas refs. O gate de aprovação já cobre o resto |
| Direção do modelo vira genérica ("natural movement") e perde o que vende | Few-shot: os 3 prompts que o Lucas já validou entram como exemplo na chamada |
| Custo escapa | Estimativa antes de gerar + teto mensal por conta |
| TikTok Direct Post exige auditoria | Fase 6 usa rascunho, que não exige |
