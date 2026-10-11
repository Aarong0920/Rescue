-- Additive Phase 2 migration for RESCUE-V2.
-- Run this once in the Supabase SQL editor after phase1.sql and photos.sql.
-- Do not rerun schema.sql, chapter-pdf.sql, phase1.sql, or photos.sql.
-- pgvector is included with Supabase. This does not add a new vendor.
-- Ask RESCUE still works before this file is run. After it runs, specific
-- questions can use semantic search. Each tutor question indexes up to 8
-- chunks with text-embedding-3-small on the existing OpenAI key.

create extension if not exists vector;

create table if not exists public.chapter_chunk_embeddings (
  chunk_id uuid primary key references public.chapter_chunks(id) on delete cascade,
  resource_id uuid not null,
  owner_id uuid not null,
  embedding vector(1536) not null
);

alter table public.chapter_chunk_embeddings enable row level security;
revoke all on public.chapter_chunk_embeddings from public, anon, authenticated;

create or replace function public.chunks_without_embeddings(rid uuid)
returns table (id uuid, content text)
language sql security definer set search_path = '' as $$
  select c.id, left(c.content, 2000)
  from public.chapter_chunks c
  where public.is_active()
    and c.resource_id = chunks_without_embeddings.rid
    and c.owner_id = auth.uid()
    and not exists (
      select 1 from public.chapter_chunk_embeddings e where e.chunk_id = c.id
    )
  order by c.chunk_index
  limit 8;
$$;

create or replace function public.save_chunk_embedding(chunk_id uuid, embedding text)
returns void language plpgsql security definer set search_path = '' as $$
declare dims int;
begin
  if not public.is_active() then raise exception 'Active account required'; end if;
  if save_chunk_embedding.embedding !~ '^\[[0-9eE+.,[:space:]-]+\]$' then
    raise exception 'Invalid embedding';
  end if;
  dims := length(save_chunk_embedding.embedding)
    - length(replace(save_chunk_embedding.embedding, ',', '')) + 1;
  if dims <> 1536 then raise exception 'Unexpected embedding size'; end if;
  if not exists (
    select 1 from public.chapter_chunks c
    where c.id = save_chunk_embedding.chunk_id and c.owner_id = auth.uid()
  ) then
    raise exception 'Chunk unavailable';
  end if;
  insert into public.chapter_chunk_embeddings (chunk_id, resource_id, owner_id, embedding)
  select c.id, c.resource_id, c.owner_id, save_chunk_embedding.embedding::vector(1536)
  from public.chapter_chunks c
  where c.id = save_chunk_embedding.chunk_id and c.owner_id = auth.uid()
  on conflict (chunk_id) do update set embedding = excluded.embedding;
end $$;

create or replace function public.match_chapter_passages(
  rid uuid, query text, match_count int
) returns table (
  chunk_index int, page_start int, page_end int, content text, similarity float
) language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active() then raise exception 'Active account required'; end if;
  if match_chapter_passages.query !~ '^\[[0-9eE+.,[:space:]-]+\]$' then
    raise exception 'Invalid embedding';
  end if;
  if match_count < 1 or match_count > 8 then raise exception 'Invalid match count'; end if;
  return query
  select c.chunk_index, c.page_start, c.page_end, c.content,
    (1 - (e.embedding <=> match_chapter_passages.query::vector(1536)))::float
  from public.chapter_chunk_embeddings e
  join public.chapter_chunks c on c.id = e.chunk_id
  where e.owner_id = auth.uid()
    and c.owner_id = auth.uid()
    and e.resource_id = match_chapter_passages.rid
  order by e.embedding <=> match_chapter_passages.query::vector(1536)
  limit match_count;
end $$;

revoke execute on function
  public.chunks_without_embeddings(uuid),
  public.save_chunk_embedding(uuid, text),
  public.match_chapter_passages(uuid, text, int)
from public, anon;
grant execute on function
  public.chunks_without_embeddings(uuid),
  public.save_chunk_embedding(uuid, text),
  public.match_chapter_passages(uuid, text, int)
to authenticated;
