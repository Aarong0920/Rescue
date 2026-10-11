# RESCUE

**Study smarter. Respond better.** A standalone Next.js EMT study MVP with a dark navy/red responsive interface. This project is separate from STRIQ and contains no STRIQ code, credentials, or data.

## Try it now

Requires Node.js 22 or newer and npm. From this `rescue` folder:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:3000**. No credentials are required for the clearly labeled demo. It includes original sample notes, flashcards, a three-question quiz, private text-note creation, and browser-local progress. AI is not simulated. Demo files and progress do not migrate into real accounts.

To run the production build:

```sh
npm run build
npm start
```

Development uses Webpack with polling to avoid macOS sandbox file-watcher restrictions. Production builds use the normal Next.js build.

## Connect real accounts, storage, and AI

### 1. Create a separate Supabase project

Do not use STRIQ's database. In the new project's SQL editor, run **supabase/schema.sql** once. It creates profiles, classes, memberships, resources, private study state, an atomic AI quota, and a private Storage bucket. The migration assumes a new project and is not a repeatable migration for an existing application.

Copy `.env.example` to `.env.local`, then fill it locally:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PROJECT_PUBLIC_ANON_OR_PUBLISHABLE_KEY
OPENAI_API_KEY=YOUR_SERVER_SIDE_OPENAI_KEY
OPENAI_MODEL=gpt-4.1-mini
```

The Supabase public key is intended for browsers; row-level security protects the data. **Never put a Supabase service-role key or OpenAI key in a NEXT_PUBLIC variable.** No Supabase service-role key is required by this app. `.env.local` is ignored by Git. Use a model available to your OpenAI API project that supports Responses structured outputs; the model is configurable.

Restart Next.js after changing environment variables. With Supabase configured, the app presents sign-in/sign-up instead of automatically entering demo mode. The demo remains available from the sign-in page.

### 2. Configure authentication

In Supabase Authentication:

- Enable email/password authentication and email confirmation.
- Set the site URL to your application URL.
- Add `http://127.0.0.1:3000/reset-password` for development and `https://YOUR_DOMAIN/reset-password` for production to the redirect allowlist.
- Set the password minimum to at least 10 characters. Configure production SMTP before inviting classmates; the default email service is limited.
- Create your own account through RESCUE and confirm your email. The app includes email/password sign-in, sign-up, sign-out, and password reset.

This app uses the Supabase browser session and sends a bearer token to its API routes. Each route validates the token with Supabase Auth. It does not use server-rendered cookie authentication.

### 3. Make yourself an administrator

After signing up, run this in your new Supabase project's SQL editor, replacing the email with your account email:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"rescue_admin":true}'::jsonb
where lower(email) = lower('YOUR_EMAIL');
```

Sign out and sign back in. The **Admin** menu appears. Admin status is read from server-controlled `raw_app_meta_data`, not user-editable metadata.

From Admin:

1. Create a class.
2. Add registered students to the class. Add your own account too if you want to submit resources.
3. Review the submitted text and rights declaration, then approve or reject it.
4. Remove memberships, unpublish shared resources, or disable a student's application access when needed.

Students must create accounts first; this MVP does not send class invitation emails. Admins can see registered emails, memberships, and submitted shared resources. The app does **not** give admins access to other users' private uploads, study progress, or tutor history. Project owners still have administrative database access through Supabase.

### 4. Use the study workflow

- **My library → Add material:** save private text notes and optional PDF/TXT/Markdown files (10 MB max). TXT/Markdown text is imported. Text notes are limited to 30,000 characters per resource.
- **Create study set:** generates flashcards and a balanced mix of terminology and scenario questions strictly from the selected text. Each answer requires a short verbatim supporting passage. The server checks that every passage exists in the selected material and rejects the entire set if evidence is missing, fabricated, or the mix is unbalanced. Insufficient notes produce a request for more text instead of a general-knowledge quiz. The set stays private to the generating user.
- **Flashcards:** reveal answers and mark/unmark mastery.
- **Practice quizzes:** select every answer, finish, review explanations and expandable supporting passages, and save the score. Attempts drive topic performance and recommended review areas.
- **AI tutor:** ask a question grounded in one selected text resource. The selected notes and current question are sent to OpenAI; prior chat messages are saved for review but are not sent as conversation context.
- **Submit to class:** explicitly attest original authorship or distribution permission and choose a class. This creates a separate text-only copy for admin review. It never shares the private uploaded file.

No AAOS chapters, publisher illustrations, or publisher question banks are bundled. Uploading a file does not automatically grant sharing permission. Keep copyrighted chapters private unless you have the necessary rights; do not submit them to the class library without permission. Do not upload patient information.

## Deploy to Vercel

1. Create a new private Git repository from this folder, separate from STRIQ. Commit the source and `package-lock.json`; do not commit `.env.local`, `node_modules`, or `.next`.
2. Import the new repository into Vercel as a **Next.js** project. Use the `rescue` directory as the root only if it is nested in your repository.
3. Set all four environment values above in Vercel for the desired environment. The public Supabase values are baked into the browser build, so rebuild after changing them.
4. Deploy with the default Next.js build (`npm run build`). Use a Node.js runtime supported by Vercel and the installed Next.js version. AI routes use Node and declare a 60-second maximum duration; check the allowance on your hosting plan.
5. Update Supabase's site URL and reset-password redirect allowlist to the actual deployment domain, then test sign-up, confirmation, reset, uploads, and AI generation using two student accounts and one admin.
6. Set an OpenAI project budget/alerts and appropriate model limits before opening registration broadly. RESCUE permits **30 AI requests per user per UTC day**, atomically enforced in Postgres. Failed provider calls also consume quota. This is not a global spending cap and does not prevent multi-account abuse.

No live Supabase project, OpenAI credential, remote repository, or hosting deployment was created during this build. Do not treat a local demo as a live class service.

## Architecture and privacy

- `app/` — Next.js App Router, root UI, reset-password page, and server API routes.
- `components/rescue.tsx` — responsive dashboard and study/admin workflows.
- `lib/domain.ts` — typed domain, scoring, and backward-compatible saved sets.
- `lib/grounding.ts` — structured generation, terminology/scenario balance, exact source-passage checks, and source-controlled attribution.
- `lib/server.ts` — bearer-token validation; user-scoped Supabase client.
- `app/api/ai/route.ts` — server-only OpenAI Responses calls, structured generation, input limits, quota enforcement, and error handling. Uses `store: false`; this does not override the API provider's other retention policies.
- `supabase/schema.sql` — database/storage row-level security, restricted grants, and secured admin functions.
- `tests/` — domain checks and executable database security tests using PGlite. The security test runs the real schema against a local PostgreSQL-compatible engine with mocked Supabase auth/storage schemas; it is not a hosted Supabase integration test.

Private files are downloaded using 60-second signed URLs. File paths are restricted to the authenticated user's UUID folder. Shared text is accessible only to active class members (and administrators reviewing it). Removing access prevents future reads; it cannot retract copies someone already downloaded. Rendered content is plain React text; no uploaded HTML is executed. API errors do not expose provider responses, secrets, or note contents.

## Validation completed

```sh
npm test
npm run typecheck
npm run build
npm audit --omit=dev
```

Verified during development:

- Domain tests: weighted quiz accuracy, unanswered questions, sharing eligibility, request limits, and generated answer validation.
- Grounding tests: terminology/scenario balance, fabricated or wrong-source evidence rejection, whitespace normalization, insufficient-source refusal, mandatory flashcard evidence, duplicate answer rejection, and server-controlled source titles.
- Database tests: private text/progress/file isolation; prevention of role/approval/quota tampering; pending/approved class visibility; outsider exclusion; admin limits; member removal; disabled accounts; daily per-user quotas.
- Browser: dashboard, flashcard reveal/mastery, quiz scoring (2/3 → 67%), persisted progress after reload, and private text-note creation.
- Production home returns HTTP 200. Unconfigured AI routes fail closed with HTTP 503. Production dependency audit reported zero known vulnerabilities at build time.

## Remaining MVP limits

- **No PDF extraction or OCR.** PDFs can be privately stored/downloaded. Paste the relevant text or upload TXT/Markdown to generate study material.
- **Live auth/storage/AI needs configuration and an integration test.** No real provider credentials were available in this task. AI quality, email delivery, signed downloads, and hosted behavior need a real-project smoke test before classmates rely on them.
- **AI output is unreviewed educational material.** New flashcard and quiz source titles come from the selected resource, and quoted passages are matched to its text. Matching proves passage presence, not that the passage logically supports the answer or that the source is medically correct. No page citations are invented. Tutor references remain model-generated. Existing older quizzes remain readable but are labeled as lacking checked passages; regenerate them for the new format. This is not an endorsed NREMT question bank or clinical decision tool. Review medical accuracy with your instructor and local protocols.
- **Simple progress storage.** One private JSON document per account (under 1 MB), serialized writes in a tab. Simultaneous edits from multiple tabs/devices can overwrite each other. No spaced-repetition scheduling, individual missed-question history, or timed exams yet.
- **Simple tutor.** Single-turn answers grounded in the selected notes; last 40 messages are saved. No streaming, vector search, multi-file retrieval, or conversational memory in the AI request.
- **Class controls are MVP scope.** Global app admins; no per-class instructor roles, invitation emails, moderation audit trail, or automated rights verification. Rejected submissions are removed. Class copies are separate snapshots; deleting the private source does not delete an approved copy.
- **Production hardening remains.** Add global cost controls, signup abuse prevention, monitoring, a strict Content Security Policy, malware scanning if expanding file types, backup/recovery drills, and a retention/account-deletion workflow before a broad public launch. No offline mode or installable PWA.
- Google Fonts is used for typography with system fallbacks; a production privacy-sensitive deployment can self-host the fonts.

## Official implementation references

- [Next.js installation and runtime requirements](https://nextjs.org/docs/app/getting-started/installation)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
- [Supabase storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase email/password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
