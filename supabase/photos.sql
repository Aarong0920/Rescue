-- Additive migration. Run once in the RESCUE-V2 SQL editor.
-- Do not rerun schema.sql, chapter-pdf.sql, or phase1.sql.

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'text/plain',
  'text/markdown',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif'
]
where id = 'private-materials';

create table if not exists public.resource_pages (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles on delete cascade,
  page_index int not null check (page_index between 0 and 39),
  storage_path text not null check (char_length(storage_path) between 1 and 300),
  ocr_text text not null default '' check (char_length(ocr_text) <= 12000),
  uncertain boolean not null default false,
  confidence real,
  unique (resource_id, page_index)
);

alter table public.resource_pages enable row level security;
revoke all on public.resource_pages from anon, authenticated;
grant select, insert, delete on public.resource_pages to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'resource_pages_read') then
    create policy resource_pages_read on public.resource_pages for select to authenticated
      using (public.is_active() and owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'resource_pages_add') then
    create policy resource_pages_add on public.resource_pages for insert to authenticated
      with check (
        public.is_active()
        and owner_id = auth.uid()
        and split_part(storage_path, '/', 1) = auth.uid()::text
        and exists (
          select 1 from public.resources r
          where r.id = resource_id and r.owner_id = auth.uid() and r.visibility = 'private'
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'resource_pages_remove') then
    create policy resource_pages_remove on public.resource_pages for delete to authenticated
      using (public.is_active() and owner_id = auth.uid());
  end if;
end $$;

create or replace function public.record_page_reading(
  page_id uuid, body text, is_uncertain boolean, score real
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active() then raise exception 'Active account required'; end if;
  if char_length(coalesce(record_page_reading.body, '')) > 12000 then
    raise exception 'Recognized text is too long';
  end if;
  update public.resource_pages
    set ocr_text = coalesce(record_page_reading.body, ''),
        uncertain = coalesce(record_page_reading.is_uncertain, true),
        confidence = record_page_reading.score
    where id = record_page_reading.page_id and owner_id = auth.uid();
  if not found then raise exception 'Photo page not found'; end if;
end $$;

revoke execute on function public.record_page_reading(uuid, text, boolean, real) from public, anon;
grant execute on function public.record_page_reading(uuid, text, boolean, real) to authenticated;

create or replace function public.save_page_text(page_id uuid, body text)
returns void language plpgsql security definer set search_path = '' as $$
declare page public.resource_pages;
begin
  if not public.is_active() then raise exception 'Active account required'; end if;
  if char_length(btrim(coalesce(save_page_text.body, ''))) not between 1 and 12000 then
    raise exception 'Enter the corrected text, up to 12,000 characters';
  end if;
  select * into page from public.resource_pages
    where id = save_page_text.page_id and owner_id = auth.uid();
  if not found then raise exception 'Photo page not found'; end if;
  update public.resource_pages
    set ocr_text = btrim(save_page_text.body),
        uncertain = position('[unclear]' in lower(btrim(save_page_text.body))) > 0
            or position('uncertain reading' in lower(btrim(save_page_text.body))) > 0
    where id = page.id;
  delete from public.chapter_chunks
    where resource_id = page.resource_id
      and owner_id = auth.uid()
      and page_start = page.page_index + 1;
  insert into public.chapter_chunks(
    resource_id, owner_id, chunk_index, page_start, page_end, content
  ) values (
    page.resource_id,
    auth.uid(),
    page.page_index,
    page.page_index + 1,
    page.page_index + 1,
    btrim(save_page_text.body)
  );
end $$;

revoke execute on function public.save_page_text(uuid, text) from public, anon;
grant execute on function public.save_page_text(uuid, text) to authenticated;
