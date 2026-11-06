-- Single Jasmin workspace. Business data is accessed through authorized server routes.
create table public.crm_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true
);
create table public.crm_state (
  id integer primary key default 1 check (id = 1),
  revision bigint not null check (revision >= 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and (payload->>'revision')::bigint = revision),
  updated_at timestamptz not null default now()
);
create table public.crm_settings (
  id text primary key check (id in ('ai','chronopost')),
  revision bigint not null check (revision > 0),
  payload text not null,
  updated_at timestamptz not null default now()
);
alter table public.crm_members enable row level security;
alter table public.crm_state enable row level security;
alter table public.crm_settings enable row level security;
revoke all on public.crm_members, public.crm_state, public.crm_settings from anon, authenticated;
grant all on public.crm_members, public.crm_state, public.crm_settings to service_role;

create function public.crm_commit_state(p_revision bigint, p_payload jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare affected integer;
begin
  if p_payload->>'revision' is null or (p_payload->>'revision')::bigint <> p_revision + 1 then
    raise exception 'Invalid state revision';
  end if;
  update public.crm_state set payload=p_payload, revision=p_revision+1, updated_at=now()
    where id=1 and revision=p_revision;
  get diagnostics affected = row_count;
  return affected=1;
end;
$$;
revoke all on function public.crm_commit_state(bigint,jsonb) from public, anon, authenticated;
grant execute on function public.crm_commit_state(bigint,jsonb) to service_role;

create function public.crm_commit_settings(p_id text, p_revision bigint, p_payload text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare affected integer;
begin
  if p_revision=0 then
    insert into public.crm_settings(id,revision,payload) values(p_id,1,p_payload) on conflict(id) do nothing;
  else
    update public.crm_settings set payload=p_payload, revision=p_revision+1, updated_at=now()
      where id=p_id and revision=p_revision;
  end if;
  get diagnostics affected = row_count;
  return affected=1;
end;
$$;
revoke all on function public.crm_commit_settings(text,bigint,text) from public, anon, authenticated;
grant execute on function public.crm_commit_settings(text,bigint,text) to service_role;

insert into storage.buckets(id,name,public,file_size_limit)
values('crm-private','crm-private',false,16777216) on conflict(id) do nothing;
do $$ begin
  if exists(select 1 from storage.buckets where id='crm-private' and public) then
    raise exception 'crm-private must be a private bucket';
  end if;
end $$;
-- No storage policies for anon/authenticated: all files are read through guarded routes.
