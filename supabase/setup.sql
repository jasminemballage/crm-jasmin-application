-- Installation initiale Jasmin CRM. Exécuter une fois dans le SQL Editor du projet dédié.
-- Généré depuis supabase/migrations : conserver ces migrations comme source.
begin;

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

-- Server-only records. A durable pending claim can never expire into permission to resend.
create table public.crm_chronopost_labels (
  shipment_id text primary key check (shipment_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  attempt_id uuid not null,
  status text not null check (status in ('pending','uncertain','rejected','created')),
  created_at timestamptz not null default now(),
  fingerprint text not null,
  tracking_number text,
  message text,
  diagnostic jsonb,
  response_path text,
  pdf_path text,
  check (status <> 'created' or tracking_number is not null)
);
alter table public.crm_chronopost_labels enable row level security;
revoke all on public.crm_chronopost_labels from anon, authenticated;
grant all on public.crm_chronopost_labels to service_role;

create function public.crm_claim_chronopost(p_shipment_id text, p_fingerprint text, p_attempt_id uuid, p_revision bigint)
returns setof public.crm_chronopost_labels
language plpgsql security invoker set search_path = '' as $$
declare current_payload jsonb; current_revision bigint; shipment jsonb; customer_order jsonb; existing public.crm_chronopost_labels;
begin
  -- The same lock is acquired by state CAS, including at first insertion.
  select payload, revision into current_payload, current_revision from public.crm_state where id = 1 for update;
  if not found then raise exception 'State not initialized'; end if;
  select * into existing from public.crm_chronopost_labels where shipment_id = p_shipment_id for update;
  if found and existing.status <> 'rejected' then return next existing; return; end if;
  if current_revision <> p_revision then raise exception 'Stale state'; end if;
  select value into shipment from pg_catalog.jsonb_array_elements(current_payload->'shipments') where value->>'id' = p_shipment_id;
  if shipment is null or shipment->>'status' <> 'prepared' then raise exception 'Shipment unavailable'; end if;
  select value into customer_order from pg_catalog.jsonb_array_elements(current_payload->'orders') where value->>'id' = shipment->>'orderId';
  if customer_order is null or customer_order->>'status' in ('cancelled','shipped') then raise exception 'Order unavailable'; end if;
  insert into public.crm_chronopost_labels(shipment_id,attempt_id,status,fingerprint)
  values(p_shipment_id,p_attempt_id,'pending',p_fingerprint)
  on conflict (shipment_id) do update set attempt_id=excluded.attempt_id,status='pending',fingerprint=excluded.fingerprint,
    created_at=now(),tracking_number=null,message=null,diagnostic=null,response_path=null,pdf_path=null
  where public.crm_chronopost_labels.status='rejected';
  return query select * from public.crm_chronopost_labels where shipment_id=p_shipment_id;
end;
$$;
revoke all on function public.crm_claim_chronopost(text,text,uuid,bigint) from public,anon,authenticated;
grant execute on function public.crm_claim_chronopost(text,text,uuid,bigint) to service_role;

create function public.crm_finish_chronopost(p_shipment_id text,p_attempt_id uuid,p_status text,p_tracking_number text,p_message text,p_diagnostic jsonb,p_response_path text,p_pdf_path text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if p_status not in ('created','uncertain','rejected') then raise exception 'Invalid result'; end if;
  update public.crm_chronopost_labels set status=p_status,tracking_number=p_tracking_number,message=p_message,
    diagnostic=p_diagnostic,response_path=p_response_path,pdf_path=p_pdf_path
  where shipment_id=p_shipment_id and attempt_id=p_attempt_id and status='pending';
  return found;
end;
$$;
revoke all on function public.crm_finish_chronopost(text,uuid,text,text,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.crm_finish_chronopost(text,uuid,text,text,text,jsonb,text,text) to service_role;

create function public.crm_protect_carrier_shipments() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare label public.crm_chronopost_labels; before_shipment jsonb; after_shipment jsonb; after_order jsonb;
begin
  for label in select * from public.crm_chronopost_labels where status in ('pending','uncertain','created') loop
    select value into before_shipment from pg_catalog.jsonb_array_elements(old.payload->'shipments') where value->>'id'=label.shipment_id;
    select value into after_shipment from pg_catalog.jsonb_array_elements(new.payload->'shipments') where value->>'id'=label.shipment_id;
    if before_shipment is null then continue; end if;
    if after_shipment is null or (before_shipment - 'status' - 'dispatchedAt') is distinct from (after_shipment - 'status' - 'dispatchedAt') then raise exception 'Carrier shipment protected'; end if;
    if label.status in ('pending','uncertain') and after_shipment is distinct from before_shipment then raise exception 'Carrier shipment unresolved'; end if;
    if after_shipment->>'status' = 'cancelled' then raise exception 'Carrier shipment protected'; end if;
    select value into after_order from pg_catalog.jsonb_array_elements(new.payload->'orders') where value->>'id'=before_shipment->>'orderId';
    if after_order is null or after_order->>'status'='cancelled' then raise exception 'Carrier order protected'; end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.crm_protect_carrier_shipments() from public,anon,authenticated;
grant execute on function public.crm_protect_carrier_shipments() to service_role;
create trigger crm_protect_carrier_shipments before update of payload on public.crm_state for each row execute function public.crm_protect_carrier_shipments();

commit;
