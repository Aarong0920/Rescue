-- Additive migration for an existing RESCUE project.
-- Run this once in the SQL editor. Do not rerun schema.sql.
update storage.buckets set file_size_limit=52428800 where id='private-materials';
create table if not exists public.chapter_documents(resource_id uuid primary key references public.resources on delete cascade,owner_id uuid not null default auth.uid() references public.profiles on delete cascade,page_count int not null check(page_count between 1 and 2000),extracted_characters int not null check(extracted_characters>=0),chapter_title text not null check(length(chapter_title) between 1 and 120));
create table if not exists public.chapter_chunks(id uuid primary key default gen_random_uuid(),resource_id uuid not null references public.resources on delete cascade,owner_id uuid not null default auth.uid() references public.profiles on delete cascade,chunk_index int not null check(chunk_index>=0),page_start int not null check(page_start between 1 and 2000),page_end int not null check(page_end between 1 and 2000 and page_end>=page_start),content text not null check(length(content) between 1 and 12000),unique(resource_id,chunk_index));
create index if not exists chapter_chunks_resource_idx on public.chapter_chunks(resource_id,chunk_index);
alter table public.chapter_documents enable row level security;
alter table public.chapter_chunks enable row level security;
revoke all on public.chapter_documents,public.chapter_chunks from anon,authenticated;
grant select,insert,update,delete on public.chapter_documents to authenticated;
grant select,insert,delete on public.chapter_chunks to authenticated;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and policyname='chapter_documents_read') then
    create policy chapter_documents_read on public.chapter_documents for select to authenticated using(public.is_active() and owner_id=auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and policyname='chapter_documents_add') then
    create policy chapter_documents_add on public.chapter_documents for insert to authenticated with check(public.is_active() and owner_id=auth.uid() and exists(select 1 from public.resources r where r.id=resource_id and r.owner_id=auth.uid() and r.visibility='private'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and policyname='chapter_documents_update') then
    create policy chapter_documents_update on public.chapter_documents for update to authenticated using(public.is_active() and owner_id=auth.uid()) with check(public.is_active() and owner_id=auth.uid() and exists(select 1 from public.resources r where r.id=resource_id and r.owner_id=auth.uid() and r.visibility='private'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and policyname='chapter_documents_remove') then
    create policy chapter_documents_remove on public.chapter_documents for delete to authenticated using(public.is_active() and owner_id=auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and policyname='chapter_chunks_read') then
    create policy chapter_chunks_read on public.chapter_chunks for select to authenticated using(public.is_active() and owner_id=auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and policyname='chapter_chunks_add') then
    create policy chapter_chunks_add on public.chapter_chunks for insert to authenticated with check(public.is_active() and owner_id=auth.uid() and exists(select 1 from public.resources r where r.id=resource_id and r.owner_id=auth.uid() and r.visibility='private'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and policyname='chapter_chunks_remove') then
    create policy chapter_chunks_remove on public.chapter_chunks for delete to authenticated using(public.is_active() and owner_id=auth.uid());
  end if;
end $$;
