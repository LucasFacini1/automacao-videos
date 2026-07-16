-- Schema inicial — ver PLAN.md §3
-- Rodar no SQL Editor do Supabase.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- conta
create table conta (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  handle      text not null,               -- @gabi.modafacil
  nome        text not null,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);
create index conta_user_id_idx on conta(user_id);

-- ---------------------------------------------------------------- persona
-- 1 por conta. ref_image_url é CONGELADA — ver PLAN.md §3.1.
-- Nunca apontar para "a imagem base mais recente": degradação geracional.
create table persona (
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

-- ---------------------------------------------------------------- produto
-- "produto" pode ser uma peça OU um look inteiro (body + saia).
create table produto (
  id             uuid primary key default gen_random_uuid(),
  conta_id       uuid not null references conta(id) on delete cascade,
  nome           text not null,
  image_url      text not null,
  link_afiliado  text,
  preco          numeric(10,2),
  created_at     timestamptz not null default now()
);
create index produto_conta_id_idx on produto(conta_id);

-- ---------------------------------------------------------------- imagem_base
create table imagem_base (
  id            uuid primary key default gen_random_uuid(),
  produto_id    uuid not null references produto(id) on delete cascade,
  image_url     text,
  status        text not null default 'gerando'
                check (status in ('gerando','pronta','aprovada','rejeitada','erro')),
  prompt_usado  text,
  erro          text,
  created_at    timestamptz not null default now()
);
create index imagem_base_produto_id_idx on imagem_base(produto_id);

-- ---------------------------------------------------------------- analise
-- Saída do Claude: direção por peça + copy. Ver PLAN.md §5.
create table analise (
  id               uuid primary key default gen_random_uuid(),
  imagem_base_id   uuid not null unique references imagem_base(id) on delete cascade,
  descricao_roupa  text not null,
  direcao          jsonb not null,   -- { <formato_key>: { framing, movement, destaque, speech? } }
  copy             jsonb not null,   -- { <formato_key>: { texto_tela[], descricao, hashtags[] } }
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------- video
create table video (
  id              uuid primary key default gen_random_uuid(),
  imagem_base_id  uuid not null references imagem_base(id) on delete cascade,
  formato_key     text not null,     -- FK lógica p/ src/lib/formatos.ts
  status          text not null default 'na_fila'
                  check (status in ('na_fila','gerando','pronto','erro')),
  video_url       text,
  duracao_s       int,
  prompt_final    text,
  erro            text,
  created_at      timestamptz not null default now()
);
create index video_imagem_base_id_idx on video(imagem_base_id);

-- ---------------------------------------------------------------- job
-- Fila. Worker consome com FOR UPDATE SKIP LOCKED.
create table job (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null check (tipo in ('gerar_imagem','analisar','gerar_video')),
  ref_id       uuid not null,       -- imagem_base.id | imagem_base.id | video.id
  status       text not null default 'pendente'
               check (status in ('pendente','rodando','ok','erro')),
  tentativas   int not null default 0,
  ultimo_erro  text,
  locked_at    timestamptz,
  created_at   timestamptz not null default now()
);
create index job_fila_idx on job(status, created_at) where status = 'pendente';

-- ---------------------------------------------------------------- RLS
-- Desativado no MVP. Worker usa service_role; dashboard filtra por user_id.
-- LIGAR antes de qualquer usuário além dos três conhecidos (ver PLAN.md §3).
alter table conta        disable row level security;
alter table persona      disable row level security;
alter table produto      disable row level security;
alter table imagem_base  disable row level security;
alter table analise      disable row level security;
alter table video        disable row level security;
alter table job          disable row level security;

-- ---------------------------------------------------------------- GRANTs
-- Com RLS desligado, quem libera o acesso é o GRANT. Sem isto o dashboard
-- (que usa a anon key) recebe erro de permissão ou resultado vazio — e o
-- sintoma não aponta pra cá.
--
-- `anon` fica só com o SELECT do necessário pro fluxo de login; o resto exige
-- sessão. O worker não depende disto: usa service_role, que ignora ambos.
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  conta, persona, produto, imagem_base, analise, video, job
  to authenticated;
