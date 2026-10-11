-- Run once in a NEW Supabase project's SQL editor.
-- An existing project should run supabase/chapter-pdf.sql once instead of running this file again.
create table public.profiles (id uuid primary key references auth.users on delete cascade, email text not null, enabled boolean not null default true);
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$ select coalesce((select raw_app_meta_data->>'rescue_admin' = 'true' from auth.users where id=auth.uid()),false) $$;
create function public.is_active() returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.profiles where id=auth.uid() and enabled) $$;
create function public.new_profile() returns trigger language plpgsql security definer set search_path = '' as $$ begin insert into public.profiles(id,email) values(new.id,coalesce(new.email,'')); return new; end $$;
create trigger rescue_new_user after insert on auth.users for each row execute function public.new_profile();
insert into public.profiles(id,email) select id,coalesce(email,'') from auth.users on conflict do nothing;
create table public.classes(id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 100));
create table public.memberships(class_id uuid references public.classes on delete cascade,user_id uuid references public.profiles on delete cascade,primary key(class_id,user_id));
create function public.in_class(cid uuid) returns boolean language sql stable security definer set search_path = '' as $$ select public.is_active() and exists(select 1 from public.memberships where class_id=cid and user_id=auth.uid()) $$;
create table public.resources(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null default auth.uid() references public.profiles on delete cascade,
 title text not null check(length(title) between 1 and 120),topic text not null check(length(topic) between 1 and 80),
 content text not null default '' check(length(content)<=30000),file_path text,
 visibility text not null default 'private' check(visibility in ('private','pending','class')),
 rights text not null default 'private' check(rights in ('private','original','authorized')),
 class_id uuid references public.classes on delete cascade,created_at timestamptz not null default now(),
 check(visibility='private' or (rights<>'private' and class_id is not null and file_path is null)),
 check(file_path is null or split_part(file_path,'/',1)=owner_id::text)
);
create table public.study_state(user_id uuid primary key default auth.uid() references public.profiles on delete cascade,data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<1000000),updated_at timestamptz not null default now());
create table public.ai_usage(user_id uuid references public.profiles on delete cascade,day date,requests int not null,primary key(user_id,day));
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.memberships enable row level security;
alter table public.resources enable row level security;
alter table public.study_state enable row level security;
alter table public.ai_usage enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
create policy classes_read on public.classes for select to authenticated using(public.in_class(id) or public.is_admin());
create policy classes_add on public.classes for insert to authenticated with check(public.is_admin() and public.is_active());
create policy members_read on public.memberships for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy members_add on public.memberships for insert to authenticated with check(public.is_admin() and public.is_active());
create policy members_remove on public.memberships for delete to authenticated using(public.is_admin() and public.is_active());
create policy resource_read on public.resources for select to authenticated using(public.is_active() and (owner_id=auth.uid() or (visibility='class' and public.in_class(class_id)) or (visibility<>'private' and public.is_admin())));
create policy resource_add on public.resources for insert to authenticated with check(public.is_active() and owner_id=auth.uid() and visibility='private' and class_id is null);
create policy resource_remove on public.resources for delete to authenticated using(public.is_active() and (owner_id=auth.uid() or (visibility<>'private' and public.is_admin())));
create policy state_read on public.study_state for select to authenticated using(public.is_active() and user_id=auth.uid());
create policy state_add on public.study_state for insert to authenticated with check(public.is_active() and user_id=auth.uid());
create policy state_update on public.study_state for update to authenticated using(public.is_active() and user_id=auth.uid()) with check(public.is_active() and user_id=auth.uid());
-- Explicit privileges: no client can update resource approval, role, or quota tables.
revoke all on public.profiles,public.classes,public.memberships,public.resources,public.study_state,public.ai_usage from anon,authenticated;
grant select on public.profiles to authenticated;
grant select,insert on public.classes to authenticated;
grant select,insert,delete on public.memberships,public.resources to authenticated;
grant select,insert,update on public.study_state to authenticated;
create function public.submit_resource(rid uuid,cid uuid,declared_rights text) returns uuid language plpgsql security definer set search_path = '' as $$
declare r public.resources; result uuid;
begin
 if not public.in_class(cid) then raise exception 'Class membership required'; end if;
 if declared_rights not in ('original','authorized') then raise exception 'Sharing permission required'; end if;
 select * into r from public.resources where id=rid and owner_id=auth.uid() and visibility='private';
 if not found or length(trim(r.content))<20 then raise exception 'Private text notes required'; end if;
 insert into public.resources(owner_id,title,topic,content,visibility,rights,class_id) values(auth.uid(),r.title,r.topic,r.content,'pending',declared_rights,cid) returning id into result;
 return result;
end $$;
create function public.review_resource(rid uuid,approve boolean) returns void language plpgsql security definer set search_path = '' as $$ begin
 if not public.is_admin() or not public.is_active() then raise exception 'Admin required'; end if;
 if approve then update public.resources set visibility='class' where id=rid and visibility='pending' and rights<>'private' and file_path is null;
 else delete from public.resources where id=rid and visibility in ('pending','class'); end if;
end $$;
create function public.set_member_enabled(uid uuid,active boolean) returns void language plpgsql security definer set search_path = '' as $$ begin
 if not public.is_admin() or not public.is_active() or uid=auth.uid() then raise exception 'Admin required; cannot disable yourself'; end if;
 update public.profiles set enabled=active where id=uid;
end $$;
-- Atomic, database-backed daily limit, shared across server instances. Failures count.
create function public.consume_ai_quota() returns boolean language plpgsql security definer set search_path = '' as $$ declare used int; begin
 if not public.is_active() then return false; end if;
 insert into public.ai_usage as usage(user_id,day,requests) values(auth.uid(),(now() at time zone 'utc')::date,1)
 on conflict(user_id,day) do update set requests=usage.requests+1 where usage.requests<30 returning requests into used;
 return used is not null;
end $$;
revoke execute on all functions in schema public from public,anon;
grant execute on function public.is_admin(),public.is_active(),public.in_class(uuid),public.submit_resource(uuid,uuid,text),public.review_resource(uuid,boolean),public.set_member_enabled(uuid,boolean),public.consume_ai_quota() to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('private-materials','private-materials',false,52428800,array['application/pdf','text/plain','text/markdown']);
create policy private_files_read on storage.objects for select to authenticated using(bucket_id='private-materials' and (storage.foldername(name))[1]=auth.uid()::text and public.is_active());
create policy private_files_add on storage.objects for insert to authenticated with check(bucket_id='private-materials' and (storage.foldername(name))[1]=auth.uid()::text and public.is_active());
create policy private_files_remove on storage.objects for delete to authenticated using(bucket_id='private-materials' and (storage.foldername(name))[1]=auth.uid()::text and public.is_active());
-- Private chapter text. Never visible to classmates or admins. Class copies still use typed notes only.
create table public.chapter_documents(resource_id uuid primary key references public.resources on delete cascade,owner_id uuid not null default auth.uid() references public.profiles on delete cascade,page_count int not null check(page_count between 1 and 2000),extracted_characters int not null check(extracted_characters>=0),chapter_title text not null check(length(chapter_title) between 1 and 120));
create table public.chapter_chunks(id uuid primary key default gen_random_uuid(),resource_id uuid not null references public.resources on delete cascade,owner_id uuid not null default auth.uid() references public.profiles on delete cascade,chunk_index int not null check(chunk_index>=0),page_start int not null check(page_start between 1 and 2000),page_end int not null check(page_end between 1 and 2000 and page_end>=page_start),content text not null check(length(content) between 1 and 12000),unique(resource_id,chunk_index));
create index chapter_chunks_resource_idx on public.chapter_chunks(resource_id,chunk_index);
alter table public.chapter_documents enable row level security;
alter table public.chapter_chunks enable row level security;
revoke all on public.chapter_documents,public.chapter_chunks from anon,authenticated;
grant select,insert,update,delete on public.chapter_documents to authenticated;
grant select,insert,delete on public.chapter_chunks to authenticated;
create policy chapter_documents_read on public.chapter_documents for select to authenticated using(public.is_active() and owner_id=auth.uid());
create policy chapter_documents_add on public.chapter_documents for insert to authenticated with check(public.is_active() and owner_id=auth.uid() and exists(select 1 from public.resources r where r.id=resource_id and r.owner_id=auth.uid() and r.visibility='private'));
create policy chapter_documents_update on public.chapter_documents for update to authenticated using(public.is_active() and owner_id=auth.uid()) with check(public.is_active() and owner_id=auth.uid() and exists(select 1 from public.resources r where r.id=resource_id and r.owner_id=auth.uid() and r.visibility='private'));
create policy chapter_documents_remove on public.chapter_documents for delete to authenticated using(public.is_active() and owner_id=auth.uid());
create policy chapter_chunks_read on public.chapter_chunks for select to authenticated using(public.is_active() and owner_id=auth.uid());
create policy chapter_chunks_add on public.chapter_chunks for insert to authenticated with check(public.is_active() and owner_id=auth.uid() and exists(select 1 from public.resources r where r.id=resource_id and r.owner_id=auth.uid() and r.visibility='private'));
create policy chapter_chunks_remove on public.chapter_chunks for delete to authenticated using(public.is_active() and owner_id=auth.uid());
