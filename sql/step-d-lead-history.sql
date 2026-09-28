-- ─────────────────────────────────────────────────────────────────────────────
-- Step D: lead_history table + triggers
-- Run this once in your Supabase SQL editor (or via psql).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Table -----------------------------------------------------------------
create table if not exists public.lead_history (
  id          uuid primary key default gen_random_uuid(),
  lead_id     bigint not null references public.leads(id) on delete cascade,
  user_id     uuid,                    -- auth.uid() at time of change
  user_email  text,                    -- auth.email() at time of change
  event       text not null,           -- e.g. 'Lead created', 'stage changed'
  field_name  text,                    -- which field changed (null for creation)
  old_value   text,
  new_value   text,
  notes       text,
  created_at  timestamptz not null default now()
);

-- Index for fast lead-scoped queries newest-first
create index if not exists lead_history_lead_id_created_at
  on public.lead_history (lead_id, created_at desc);

-- 2. RLS -------------------------------------------------------------------
alter table public.lead_history enable row level security;

-- Authenticated users can read any history row
create policy "Authenticated users can read lead_history"
  on public.lead_history
  for select
  to authenticated
  using (true);

-- Only the trigger (service role / security definer) should insert;
-- but allow authenticated inserts too so manual note-style rows are possible
create policy "Authenticated users can insert lead_history"
  on public.lead_history
  for insert
  to authenticated
  with check (true);

-- 3. Trigger function — INSERT (lead created) ------------------------------
create or replace function public.trg_lead_history_insert()
returns trigger
language plpgsql
security definer          -- runs as table owner, bypasses RLS
set search_path = public
as $$
begin
  insert into public.lead_history (lead_id, user_id, user_email, event)
  values (
    new.id,
    auth.uid(),
    auth.email(),
    'Lead created'
  );
  return new;
end;
$$;

drop trigger if exists trg_lead_history_insert on public.leads;

create trigger trg_lead_history_insert
  after insert on public.leads
  for each row
  execute function public.trg_lead_history_insert();

-- 4. Trigger function — UPDATE (field-level history) -----------------------
create or replace function public.trg_lead_history_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid   uuid := auth.uid();
  _email text := auth.email();
begin
  -- Track changes to these fields only
  if new.stage is distinct from old.stage then
    insert into public.lead_history (lead_id, user_id, user_email, event, field_name, old_value, new_value)
    values (new.id, _uid, _email, 'stage changed', 'stage', old.stage, new.stage);
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    insert into public.lead_history (lead_id, user_id, user_email, event, field_name, old_value, new_value)
    values (new.id, _uid, _email, 'assigned_to changed', 'assigned_to', old.assigned_to, new.assigned_to);
  end if;

  if new.source is distinct from old.source then
    insert into public.lead_history (lead_id, user_id, user_email, event, field_name, old_value, new_value)
    values (new.id, _uid, _email, 'source changed', 'source', old.source, new.source);
  end if;

  if new.priority is distinct from old.priority then
    insert into public.lead_history (lead_id, user_id, user_email, event, field_name, old_value, new_value)
    values (new.id, _uid, _email, 'priority changed', 'priority', old.priority::text, new.priority::text);
  end if;

  if new.notes is distinct from old.notes then
    insert into public.lead_history (lead_id, user_id, user_email, event, field_name, old_value, new_value)
    values (new.id, _uid, _email, 'notes changed', 'notes', old.notes, new.notes);
  end if;

  if new.description is distinct from old.description then
    insert into public.lead_history (lead_id, user_id, user_email, event, field_name, old_value, new_value)
    values (new.id, _uid, _email, 'description changed', 'description', old.description, new.description);
  end if;

  if new.window_types is distinct from old.window_types then
    insert into public.lead_history (lead_id, user_id, user_email, event, field_name, old_value, new_value)
    values (new.id, _uid, _email, 'window_types changed', 'window_types', old.window_types, new.window_types);
  end if;

  if new.survey_date is distinct from old.survey_date then
    insert into public.lead_history (lead_id, user_id, user_email, event, field_name, old_value, new_value)
    values (new.id, _uid, _email, 'survey_date changed', 'survey_date', old.survey_date::text, new.survey_date::text);
  end if;

  if new.survey_time is distinct from old.survey_time then
    insert into public.lead_history (lead_id, user_id, user_email, event, field_name, old_value, new_value)
    values (new.id, _uid, _email, 'survey_time changed', 'survey_time', old.survey_time, new.survey_time);
  end if;

  if new.surveyor is distinct from old.surveyor then
    insert into public.lead_history (lead_id, user_id, user_email, event, field_name, old_value, new_value)
    values (new.id, _uid, _email, 'surveyor changed', 'surveyor', old.surveyor, new.surveyor);
  end if;

  if new.lead_tags is distinct from old.lead_tags then
    insert into public.lead_history (lead_id, user_id, user_email, event, field_name, old_value, new_value)
    values (new.id, _uid, _email, 'lead_tags changed', 'lead_tags', old.lead_tags, new.lead_tags);
  end if;

  if new.sector is distinct from old.sector then
    insert into public.lead_history (lead_id, user_id, user_email, event, field_name, old_value, new_value)
    values (new.id, _uid, _email, 'sector changed', 'sector', old.sector, new.sector);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_lead_history_update on public.leads;

create trigger trg_lead_history_update
  after update on public.leads
  for each row
  execute function public.trg_lead_history_update();
