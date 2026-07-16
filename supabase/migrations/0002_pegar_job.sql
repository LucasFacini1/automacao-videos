-- Fila: o worker reivindica UM job atomicamente.
-- SKIP LOCKED deixa vários workers rodarem em paralelo sem pegar o mesmo job.
-- O client JS do Supabase não roda SQL cru, então isso vira RPC.

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

-- Jobs que travaram (worker morreu no meio) voltam pra fila depois de 15min.
-- Chamar no boot do worker.
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

-- Só o worker chama estas. O dashboard não tem o que fazer com elas.
revoke all on function pegar_job(int)   from public, anon, authenticated;
revoke all on function destravar_jobs() from public, anon, authenticated;
grant execute on function pegar_job(int)   to service_role;
grant execute on function destravar_jobs() to service_role;
