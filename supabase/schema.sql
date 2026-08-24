-- ============================================================================
-- Studio — schema completo e IDEMPOTENTE.
--
-- Cole ESTE arquivo inteiro no SQL Editor do Supabase e rode.
-- Pode rodar quantas vezes quiser: não apaga dados, só garante o estado certo.
-- Não precisa lembrar o que já rodou — este arquivo é a fonte única.
--
-- Cobre: tabelas, índices, constraints (com os status de cancelamento),
-- RLS/grants, funções da fila, e o bucket de storage.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- tabelas
-- (status sem CHECK inline — os checks ficam num bloco só, mais abaixo, pra
--  serem idempotentes e sempre incluírem os status novos)

create table if not exists conta (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  handle      text not null,
  nome        text not null,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists conta_user_id_idx on conta(user_id);

-- persona: 1 por conta. ref_image_url é CONGELADA (ver PLAN.md §3.1).
create table if not exists persona (
  id             uuid primary key default gen_random_uuid(),
  conta_id       uuid not null unique references conta(id) on delete cascade,
  ref_image_url  text not null,
  cenario        text not null default 'modern walk-in closet',
  cabelo         text not null,
  make           text not null,
  unhas          text not null default 'light',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- produto: pode ser uma peça OU um look inteiro.
-- O `nome` é o que está sendo anunciado — quando a foto é um look mas só uma
-- peça está à venda, o nome é a peça (ex.: "saia de couro"), e a legenda sai
-- sobre ela. Ver direcao.ts. (Vazio/genérico = a legenda ancora na foto.)
create table if not exists produto (
  id             uuid primary key default gen_random_uuid(),
  conta_id       uuid not null references conta(id) on delete cascade,
  nome           text not null,
  image_url      text not null,
  -- ajustes: mudança de visual pedida pra ESTE produto (unhas/cabelo/acessório).
  -- Entra na geração da imagem base (promptImagemBase) — é onde funciona, já que
  -- o vídeo só anima a foto pronta. Vazio = mantém como na referência.
  ajustes        text,
  link_afiliado  text,
  preco          numeric(10,2),
  created_at     timestamptz not null default now()
);
create index if not exists produto_conta_id_idx on produto(conta_id);
-- idempotente: garante a coluna mesmo se a tabela nasceu numa versão antiga
alter table produto add column if not exists ajustes text;

create table if not exists imagem_base (
  id            uuid primary key default gen_random_uuid(),
  produto_id    uuid not null references produto(id) on delete cascade,
  image_url     text,
  status        text not null default 'gerando',
  prompt_usado  text,
  erro          text,
  created_at    timestamptz not null default now()
);
create index if not exists imagem_base_produto_id_idx on imagem_base(produto_id);

-- analise: direção por peça + copy (saída do modelo de direção).
create table if not exists analise (
  id               uuid primary key default gen_random_uuid(),
  imagem_base_id   uuid not null unique references imagem_base(id) on delete cascade,
  descricao_roupa  text not null,
  direcao          jsonb not null,
  copy             jsonb not null,
  created_at       timestamptz not null default now()
);

create table if not exists video (
  id              uuid primary key default gen_random_uuid(),
  imagem_base_id  uuid not null references imagem_base(id) on delete cascade,
  formato_key     text not null,
  status          text not null default 'na_fila',
  video_url       text,
  duracao_s       int,
  prompt_final    text,
  erro            text,
  created_at      timestamptz not null default now()
);
create index if not exists video_imagem_base_id_idx on video(imagem_base_id);

-- legenda: UMA POR VÍDEO, não por imagem base. Dois clipes do mesmo produto
-- postados juntos não podem sair com a mesma descrição. (A de `analise` fica
-- como fallback dos vídeos antigos.) Ver escreverLegenda() em direcao.ts.
alter table video add column if not exists legenda jsonb;

-- (a antiga video.ajustes foi movida pra produto.ajustes — o ajuste de visual
--  precisa entrar na GERAÇÃO da imagem, não na animação do vídeo. Ver abaixo.)

-- limite_usuario: teto de gasto mensal POR USUÁRIO (soma todas as contas dele).
-- Antes o teto era por conta e vinha só do env — então 3 contas gastavam 3x, e
-- não dava pra ter limites diferentes por pessoa. Sem linha aqui = usa o env.
create table if not exists limite_usuario (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  limite_mensal  numeric(10,2) not null default 0,   -- 0 = sem teto próprio
  updated_at     timestamptz not null default now()
);

-- custo_evento: ledger de gastos. UMA linha por geração que custou dinheiro
-- (imagem base pronta, vídeo pronto). Só o /admin lê — o usuário final nunca vê.
-- Guarda o custo do momento (numeric) pra não desandar se o preço mudar depois.
create table if not exists custo_evento (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  conta_id     uuid references conta(id) on delete set null,
  produto_id   uuid references produto(id) on delete set null,
  tipo         text not null,                 -- imagem | video
  ref_id       uuid,                          -- imagem_base.id ou video.id
  formato_key  text,                          -- só vídeo
  custo        numeric(10,4) not null default 0,
  status       text not null default 'ok',    -- ok | erro
  detalhe      text,
  created_at   timestamptz not null default now()
);
create index if not exists custo_evento_user_idx  on custo_evento(user_id, created_at desc);
create index if not exists custo_evento_conta_idx on custo_evento(conta_id, created_at desc);

-- job: fila. Worker consome com FOR UPDATE SKIP LOCKED.
create table if not exists job (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null,
  ref_id       uuid not null,
  status       text not null default 'pendente',
  tentativas   int not null default 0,
  ultimo_erro  text,
  locked_at    timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists job_fila_idx on job(status, created_at) where status = 'pendente';

-- ---------------------------------------------------------------- constraints
-- Via drop+add: idempotente, e garante que os status novos (cancelada/cancelado)
-- existam mesmo se a tabela foi criada numa versão antiga do schema.

alter table imagem_base drop constraint if exists imagem_base_status_check;
alter table imagem_base add  constraint imagem_base_status_check
  check (status in ('gerando','pronta','aprovada','rejeitada','erro','cancelada'));

alter table video drop constraint if exists video_status_check;
alter table video add  constraint video_status_check
  check (status in ('na_fila','gerando','pronto','erro','cancelado'));

alter table job drop constraint if exists job_tipo_check;
alter table job add  constraint job_tipo_check
  check (tipo in ('gerar_imagem','analisar','gerar_video'));

alter table job drop constraint if exists job_status_check;
alter table job add  constraint job_status_check
  check (status in ('pendente','rodando','ok','erro'));

alter table custo_evento drop constraint if exists custo_evento_tipo_check;
alter table custo_evento add  constraint custo_evento_tipo_check
  check (tipo in ('imagem','video'));

alter table custo_evento drop constraint if exists custo_evento_status_check;
alter table custo_evento add  constraint custo_evento_status_check
  check (status in ('ok','erro'));

-- ---------------------------------------------------------------- RLS + grants
-- RLS desligada; o worker usa service_role (ignora RLS) e o dashboard filtra
-- por user_id no servidor. GRANT libera o acesso (sem ele, o dashboard recebe
-- erro de permissão). Tudo idempotente.

alter table conta        disable row level security;
alter table persona      disable row level security;
alter table produto      disable row level security;
alter table imagem_base  disable row level security;
alter table analise      disable row level security;
alter table video        disable row level security;
alter table job          disable row level security;
alter table custo_evento   disable row level security;
alter table limite_usuario disable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  conta, persona, produto, imagem_base, analise, video, job, custo_evento, limite_usuario
  to authenticated;

-- ---------------------------------------------------------------- funções fila
-- pegar_job: reivindica UM job atomicamente (SKIP LOCKED deixa vários workers
-- em paralelo sem pegar o mesmo). O client JS do Supabase não roda SQL cru.

create or replace function pegar_job(max_tentativas int default 3)
returns setof job
language plpgsql
as $$
declare
  j job;
begin
  select * into j
  from job
  where status = 'pendente'
    and tentativas < max_tentativas
  order by created_at
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update job
     set status     = 'rodando',
         locked_at  = now(),
         tentativas = tentativas + 1
   where id = j.id
  returning * into j;

  return next j;
end;
$$;

-- destravar_jobs: jobs travados (worker morreu no meio) voltam pra fila depois
-- de 15min. Chamar no boot do worker.
create or replace function destravar_jobs()
returns int
language sql
as $$
  with liberados as (
    update job
       set status = 'pendente', locked_at = null
     where status = 'rodando'
       and locked_at < now() - interval '15 minutes'
    returning 1
  )
  select count(*)::int from liberados;
$$;

revoke all on function pegar_job(int)   from public, anon, authenticated;
revoke all on function destravar_jobs() from public, anon, authenticated;
grant execute on function pegar_job(int)   to service_role;
grant execute on function destravar_jobs() to service_role;

-- ---------------------------------------------------------------- storage
-- Bucket privado 'midia' (rosto da persona + vídeos). O service_role ignora a
-- RLS de storage, então basta o bucket existir. Idempotente.

insert into storage.buckets (id, name, public)
values ('midia', 'midia', false)
on conflict (id) do nothing;
