-- Additive migration for an existing RESCUE project.
-- Run this once in the RESCUE-V2 SQL editor.
-- Do not rerun supabase/schema.sql or supabase/chapter-pdf.sql.

alter table public.profiles
  add column if not exists first_name text not null default '',
  add column if not exists last_name text not null default '',
  add column if not exists auto_quiz boolean not null default true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_name_length') then
    alter table public.profiles
      add constraint profiles_name_length
      check (char_length(first_name) <= 40 and char_length(last_name) <= 40);
  end if;
end $$;

create or replace function public.new_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, email, first_name, last_name)
  values (
    new.id,
    coalesce(new.email, ''),
    left(btrim(coalesce(new.raw_user_meta_data->>'first_name', '')), 40),
    left(btrim(coalesce(new.raw_user_meta_data->>'last_name', '')), 40)
  );
  return new;
end $$;

create or replace function public.save_profile(first_name text, last_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active() then raise exception 'Active account required'; end if;
  if char_length(btrim(coalesce(save_profile.first_name, ''))) not between 1 and 40
     or char_length(btrim(coalesce(save_profile.last_name, ''))) not between 1 and 40 then
    raise exception 'Enter a first and last name, up to 40 characters each';
  end if;
  update public.profiles
    set first_name = btrim(save_profile.first_name),
        last_name = btrim(save_profile.last_name)
    where id = auth.uid();
end $$;

create or replace function public.set_auto_quiz(enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active() then raise exception 'Active account required'; end if;
  update public.profiles set auto_quiz = coalesce(set_auto_quiz.enabled, true) where id = auth.uid();
end $$;

alter table public.chapter_documents
  add column if not exists file_hash text not null default '';

create table if not exists public.chapter_jobs (
  resource_id uuid primary key references public.resources on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles on delete cascade,
  status text not null check (status in ('uploaded', 'processing', 'ready', 'failed')),
  page_count int not null default 0 check (page_count between 0 and 2000),
  next_page int not null default 1 check (next_page between 1 and 2001),
  file_hash text not null default '',
  error text not null default '' check (char_length(error) <= 500),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_sets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles on delete cascade,
  resource_id uuid not null references public.resources on delete cascade,
  kind text not null check (kind in ('quiz', 'cards')),
  title text not null check (char_length(title) between 1 and 120),
  topic text not null check (char_length(topic) between 1 and 80),
  options jsonb not null default '{}'::jsonb check (octet_length(options::text) < 8000),
  payload jsonb not null check (octet_length(payload::text) between 2 and 400000),
  created_at timestamptz not null default now()
);
create index if not exists saved_sets_owner_idx on public.saved_sets(owner_id, created_at desc);

alter table public.chapter_jobs enable row level security;
alter table public.saved_sets enable row level security;
revoke all on public.chapter_jobs, public.saved_sets from anon, authenticated;
grant select, insert, update, delete on public.chapter_jobs to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'chapter_jobs_read') then
    create policy chapter_jobs_read on public.chapter_jobs for select to authenticated
      using (public.is_active() and owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'chapter_jobs_add') then
    create policy chapter_jobs_add on public.chapter_jobs for insert to authenticated
      with check (public.is_active() and owner_id = auth.uid() and exists (
        select 1 from public.resources r where r.id = resource_id and r.owner_id = auth.uid() and r.visibility = 'private'
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'chapter_jobs_update') then
    create policy chapter_jobs_update on public.chapter_jobs for update to authenticated
      using (public.is_active() and owner_id = auth.uid())
      with check (public.is_active() and owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'chapter_jobs_remove') then
    create policy chapter_jobs_remove on public.chapter_jobs for delete to authenticated
      using (public.is_active() and owner_id = auth.uid());
  end if;
end $$;

create or replace function public.save_study_set(
  rid uuid, kind text, title text, topic text, options jsonb, payload jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if not public.is_active() then raise exception 'Active account required'; end if;
  if save_study_set.kind not in ('quiz', 'cards') then raise exception 'Invalid study set'; end if;
  if octet_length(coalesce(save_study_set.payload, '{}'::jsonb)::text) > 400000 then raise exception 'Study set is too large'; end if;
  if not exists (
    select 1 from public.resources r
    where r.id = rid and (
      r.owner_id = auth.uid()
      or (r.visibility = 'class' and public.in_class(r.class_id))
    )
  ) then raise exception 'Resource unavailable'; end if;
  insert into public.saved_sets(owner_id, resource_id, kind, title, topic, options, payload)
  values (
    auth.uid(), rid, save_study_set.kind, left(btrim(save_study_set.title), 120), left(btrim(save_study_set.topic), 80),
    coalesce(save_study_set.options, '{}'::jsonb), save_study_set.payload
  )
  returning id into result;
  return result;
end $$;

create or replace function public.list_study_sets()
returns table (
  id uuid, resource_id uuid, kind text, title text, topic text, options jsonb, created_at timestamptz
) language sql security definer set search_path = '' as $$
  select s.id, s.resource_id, s.kind, s.title, s.topic, s.options, s.created_at
  from public.saved_sets s
  where public.is_active() and s.owner_id = auth.uid()
  order by s.created_at desc;
$$;

create or replace function public.has_auto_quiz(rid uuid) returns boolean
language sql security definer set search_path = '' as $$
  select public.is_active() and exists (
    select 1 from public.saved_sets s
    where s.owner_id = auth.uid() and s.resource_id = rid and s.kind = 'quiz'
      and coalesce(s.options->>'origin', '') = 'auto'
  );
$$;

create or replace function public.quiz_prompts(set_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare row public.saved_sets; prompts jsonb;
begin
  if not public.is_active() then raise exception 'Active account required'; end if;
  select * into row from public.saved_sets where id = set_id and owner_id = auth.uid() and kind = 'quiz';
  if not found then raise exception 'Quiz unavailable'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'question', item->>'question',
    'options', item->'options',
    'kind', item->>'kind',
    'source', item->>'source'
  )), '[]'::jsonb) into prompts
  from jsonb_array_elements(row.payload->'questions') item;
  return prompts;
end $$;

create or replace function public.study_cards(set_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare row public.saved_sets;
begin
  if not public.is_active() then raise exception 'Active account required'; end if;
  select * into row from public.saved_sets where id = set_id and owner_id = auth.uid() and kind = 'cards';
  if not found then raise exception 'Flashcards unavailable'; end if;
  return coalesce(row.payload->'cards', '[]'::jsonb);
end $$;

create or replace function public.practice_feedback(set_id uuid, item_index int, choice int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare row public.saved_sets; item jsonb; answer int;
begin
  if not public.is_active() then raise exception 'Active account required'; end if;
  if item_index < 0 or choice < 0 or choice > 3 then raise exception 'Choose one of the four answers'; end if;
  select * into row from public.saved_sets where id = set_id and owner_id = auth.uid() and kind = 'quiz';
  if not found then raise exception 'Quiz unavailable'; end if;
  item := row.payload->'questions'->item_index;
  if item is null or item = 'null'::jsonb then raise exception 'Question unavailable'; end if;
  answer := (item->>'answer')::int;
  return jsonb_build_object(
    'correct', choice = answer,
    'answer', answer,
    'explanation', item->>'explanation',
    'source', item->>'source',
    'evidence', item->>'evidence'
  );
end $$;

create or replace function public.grade_quiz(set_id uuid, choices jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  row public.saved_sets; item jsonb; i int; total int; correct int := 0;
  chosen int; answer int; review jsonb := '[]'::jsonb;
begin
  if not public.is_active() then raise exception 'Active account required'; end if;
  if jsonb_typeof(choices) <> 'array' then raise exception 'Answer every question'; end if;
  select * into row from public.saved_sets where id = set_id and owner_id = auth.uid() and kind = 'quiz';
  if not found then raise exception 'Quiz unavailable'; end if;
  total := coalesce(jsonb_array_length(row.payload->'questions'), 0);
  if jsonb_array_length(choices) <> total or total < 1 then raise exception 'Answer every question'; end if;
  for i in 0..total - 1 loop
    item := row.payload->'questions'->i;
    chosen := (choices->>i)::int;
    answer := (item->>'answer')::int;
    if chosen is null or chosen < 0 or chosen > 3 then chosen := -1; end if;
    if chosen = answer then correct := correct + 1; end if;
    review := review || jsonb_build_array(jsonb_build_object(
      'index', i,
      'chosen', chosen,
      'answer', answer,
      'correct', chosen = answer,
      'question', item->>'question',
      'explanation', item->>'explanation',
      'source', item->>'source',
      'evidence', item->>'evidence'
    ));
  end loop;
  return jsonb_build_object('correct', correct, 'total', total, 'review', review);
end $$;

revoke execute on function
  public.save_profile(text, text),
  public.set_auto_quiz(boolean),
  public.save_study_set(uuid, text, text, text, jsonb, jsonb),
  public.list_study_sets(),
  public.has_auto_quiz(uuid),
  public.quiz_prompts(uuid),
  public.study_cards(uuid),
  public.practice_feedback(uuid, int, int),
  public.grade_quiz(uuid, jsonb)
from public, anon;
grant execute on function
  public.save_profile(text, text),
  public.set_auto_quiz(boolean),
  public.save_study_set(uuid, text, text, text, jsonb, jsonb),
  public.list_study_sets(),
  public.has_auto_quiz(uuid),
  public.quiz_prompts(uuid),
  public.study_cards(uuid),
  public.practice_feedback(uuid, int, int),
  public.grade_quiz(uuid, jsonb)
to authenticated;
