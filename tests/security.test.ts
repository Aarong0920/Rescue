import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const A = "00000000-0000-4000-8000-000000000001",
  B = "00000000-0000-4000-8000-000000000002",
  C = "00000000-0000-4000-8000-000000000003",
  ADMIN = "00000000-0000-4000-8000-000000000004",
  CLASS = "00000000-0000-4000-8000-000000000005",
  RESOURCE = "00000000-0000-4000-8000-000000000006";
test("database enforces user isolation, class approval, storage privacy, admin roles, and durable quotas", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
 alter table storage.objects enable row level security;
 grant usage on schema public,auth,storage to authenticated,anon;
 grant execute on function auth.uid(),storage.foldername(text) to authenticated;
 grant select,insert,delete on storage.objects to authenticated;`);
    await db.exec(
      readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
    );
    await db.exec(
      readFileSync(
        new URL("../supabase/chapter-pdf.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      readFileSync(new URL("../supabase/phase1.sql", import.meta.url), "utf8"),
    );
    await db.exec(
      readFileSync(new URL("../supabase/photos.sql", import.meta.url), "utf8"),
    );
    await db.exec(
      `insert into auth.users(id,email) values ('${A}','a@test.invalid'),('${B}','b@test.invalid'),('${C}','c@test.invalid');insert into auth.users(id,email,raw_app_meta_data) values('${ADMIN}','admin@test.invalid','{"rescue_admin":true}');insert into public.classes(id,name) values('${CLASS}','EMT class');insert into public.memberships values('${CLASS}','${A}'),('${CLASS}','${B}');`,
    );
    async function as(id: string) {
      await db.exec(
        `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
      );
    }
    async function rows(sql: string) {
      return (await db.query(sql)).rows as Record<string, unknown>[];
    }
    assert.equal(
      Number(
        (
          await rows(
            "select file_size_limit from storage.buckets where id='private-materials'",
          )
        )[0].file_size_limit,
      ),
      52428800,
    );
    await as(A);
    await db.exec(
      `insert into public.resources(id,title,topic,content) values('${RESOURCE}','Original notes','Assessment','These original notes are long enough to study.');insert into public.study_state(data) values('{"sets":[]}');insert into storage.objects(bucket_id,name) values('private-materials','${A}/notes.pdf');insert into public.chapter_chunks(resource_id,owner_id,chunk_index,page_start,page_end,content) values('${RESOURCE}','${A}',0,1,1,'Airway assessment begins with looking for chest rise.');insert into public.chapter_documents(resource_id,owner_id,page_count,extracted_characters,chapter_title) values('${RESOURCE}','${A}',1,52,'Original notes');`,
    );
    assert.equal((await rows("select * from resources")).length, 1);
    await assert.rejects(() =>
      db.exec(`update resources set visibility='class' where id='${RESOURCE}'`),
    );
    await assert.rejects(() => db.exec(`update profiles set enabled=false`));
    await assert.rejects(() =>
      db.exec(`select review_resource('${RESOURCE}',true)`),
    );
    await as(B);
    assert.equal(
      (await rows("select * from resources")).length,
      0,
      "other user cannot read private text",
    );
    assert.equal(
      (await rows("select * from study_state")).length,
      0,
      "other user cannot read progress",
    );
    assert.equal(
      (await rows("select * from storage.objects")).length,
      0,
      "other user cannot read private files",
    );
    assert.equal(
      (await rows("select * from chapter_chunks")).length,
      0,
      "other user cannot read private chapter text",
    );
    await assert.rejects(() =>
      db.exec(
        `insert into chapter_chunks(resource_id,owner_id,chunk_index,page_start,page_end,content) values('${RESOURCE}','${B}',1,1,1,'Trying to save notes into someone else''s chapter.')`,
      ),
    );
    await assert.rejects(() =>
      db.exec(`insert into study_state(user_id,data) values('${A}','{}')`),
    );
    await assert.rejects(() =>
      db.exec(
        `insert into storage.objects(bucket_id,name) values('private-materials','${A}/stolen.pdf')`,
      ),
    );
    await assert.rejects(() =>
      db.exec(`select submit_resource('${RESOURCE}','${CLASS}','original')`),
    );
    await as(A);
    await assert.rejects(() =>
      db.exec(`select submit_resource('${RESOURCE}','${CLASS}','private')`),
    );
    const submitted = (
      await rows(
        `select submit_resource('${RESOURCE}','${CLASS}','original') as id`,
      )
    )[0].id;
    await as(B);
    assert.equal(
      (await rows("select * from resources")).length,
      0,
      "pending copies not visible to classmates",
    );
    await as(ADMIN);
    assert.equal(
      (await rows("select * from resources")).length,
      1,
      "admin sees submission, not private source",
    );
    assert.equal(
      (await rows("select * from study_state")).length,
      0,
      "admin does not read private progress",
    );
    assert.equal(
      (await rows("select * from storage.objects")).length,
      0,
      "admin does not read private uploads",
    );
    assert.equal(
      (await rows("select * from chapter_chunks")).length,
      0,
      "admin does not read private chapter text",
    );
    await db.exec(`select review_resource('${submitted}',true)`);
    await as(A);
    await assert.rejects(
      () =>
        db.exec(
          `insert into chapter_chunks(resource_id,owner_id,chunk_index,page_start,page_end,content) values('${submitted}','${A}',0,1,1,'Shared copies cannot store extracted chapter text.')`,
        ),
      /new row violates row-level security|violates row-level security policy/,
    );
    await as(B);
    assert.equal(
      (await rows("select * from resources")).length,
      1,
      "classmate reads approved text",
    );
    assert.equal(
      (await rows("select * from chapter_chunks")).length,
      0,
      "classmate cannot read extracted chapter text",
    );
    await as(C);
    assert.equal(
      (await rows("select * from resources")).length,
      0,
      "outsider cannot read approved class text",
    );
    await as(A);
    await db.exec(`select save_profile('Aar','On')`);
    assert.equal(
      (await rows("select first_name,last_name from profiles"))[0].first_name,
      "Aar",
    );
    const quizId = (
      await rows(
        `select save_study_set('${RESOURCE}'::uuid,'quiz','Airway quiz','Airway','{"origin":"auto"}'::jsonb,'{"questions":[{"question":"What comes first?","options":["Scene safety","Billing","Insurance","Parking"],"answer":0,"explanation":"Scene safety is stated first.","source":"Original notes","evidence":"Scene safety comes first.","kind":"terminology"}]}'::jsonb) as id`,
      )
    )[0].id;
    assert.equal((await rows(`select has_auto_quiz('${RESOURCE}') as yes`))[0].yes, true);
    const promptValue = (
      await rows(`select quiz_prompts('${quizId}') as prompts`)
    )[0].prompts as { answer?: number }[] | string;
    const prompts = (
      typeof promptValue === "string" ? JSON.parse(promptValue) : promptValue
    ) as { answer?: number }[];
    assert.equal("answer" in prompts[0], false);
    const gradeValue = (
      await rows(`select grade_quiz('${quizId}','[0]'::jsonb) as result`)
    )[0].result as { correct: number } | string;
    const graded = (
      typeof gradeValue === "string" ? JSON.parse(gradeValue) : gradeValue
    ) as { correct: number };
    assert.equal(graded.correct, 1);
    await as(B);
    await assert.rejects(() => db.exec(`select quiz_prompts('${quizId}')`));
    await assert.rejects(() =>
      db.exec(`select grade_quiz('${quizId}','[0]'::jsonb)`),
    );
    assert.equal((await rows("select * from chapter_jobs")).length, 0);
    await as(A);
    await db.exec(
      `insert into chapter_jobs(resource_id,owner_id,status,file_hash) values('${RESOURCE}','${A}','processing','abc')`,
    );
    await as(B);
    assert.equal(
      (await rows("select * from chapter_jobs")).length,
      0,
      "another student cannot read processing status",
    );
    await as(ADMIN);
    assert.equal(
      (await rows("select * from chapter_jobs")).length,
      0,
      "admin cannot read private processing",
    );
    await as(A);
    await db.exec(
      `insert into public.resource_pages(id,resource_id,owner_id,page_index,storage_path,ocr_text) values('00000000-0000-4000-8000-000000000099','${RESOURCE}','${A}',0,'${A}/photo.jpg','Primary assessment looks for life threats.')`,
    );
    await as(B);
    assert.equal(
      (await rows("select * from resource_pages")).length,
      0,
      "another student cannot read private photos",
    );
    await assert.rejects(() =>
      db.exec(
        `select save_page_text('00000000-0000-4000-8000-000000000099','rewritten')`,
      ),
    );
    await as(A);
    for (let i = 0; i < 30; i++)
      assert.equal(
        (await rows("select consume_ai_quota() as allowed"))[0].allowed,
        true,
      );
    assert.equal(
      (await rows("select consume_ai_quota() as allowed"))[0].allowed,
      false,
    );
    await assert.rejects(() => db.exec("delete from ai_usage"));
    await as(B);
    assert.equal(
      (await rows("select consume_ai_quota() as allowed"))[0].allowed,
      true,
      "limits are per user",
    );
    await as(ADMIN);
    await db.exec(`delete from memberships where user_id='${B}';`);
    await as(B);
    assert.equal(
      (await rows("select * from resources")).length,
      0,
      "removing membership revokes shared access",
    );
    await as(ADMIN);
    await db.exec(`select set_member_enabled('${A}',false)`);
    await as(A);
    assert.equal(
      (await rows("select * from resources")).length,
      0,
      "disabled account cannot access text",
    );
    assert.equal(
      (await rows("select * from storage.objects")).length,
      0,
      "disabled account cannot access uploads",
    );
    assert.equal(
      (await rows("select * from chapter_chunks")).length,
      0,
      "disabled account cannot read chapter text",
    );
    assert.equal(
      (await rows("select consume_ai_quota() as allowed"))[0].allowed,
      false,
    );
  } finally {
    await db.close();
  }
});
