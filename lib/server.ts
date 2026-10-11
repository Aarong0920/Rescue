import { createClient } from "@supabase/supabase-js";
export async function authenticate(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("CONFIG");
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(\S+)\s*$/)?.[1];
  if (!token) throw new Error("AUTH");
  const auth = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const {
    data: { user },
    error,
  } = await auth.auth.getUser(token);
  if (error || !user) {
    console.error(
      "RESCUE auth rejected:",
      error?.name ?? "Error",
      error?.message ?? "no user",
    );
    throw new Error("AUTH");
  }
  const db = createClient(url, key, {
    accessToken: async () => token,
  });
  const { data: active, error: activeError } = await db.rpc("is_active");
  if (activeError) {
    console.error("RESCUE account check failed:", activeError.message);
    throw new Error("VERIFY");
  }
  if (!active) throw new Error("DISABLED");
  return { db, user };
}
export function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "AUTH")
    return Response.json(
      { error: "Sign in with an active account to continue." },
      { status: 401 },
    );
  if (message === "DISABLED")
    return Response.json(
      { error: "Your account is disabled. Contact your class administrator." },
      { status: 403 },
    );
  if (message === "VERIFY")
    return Response.json(
      {
        error:
          "Your session could not be verified. Sign out and sign in again.",
      },
      { status: 401 },
    );
  if (message === "CONFIG")
    return Response.json(
      {
        error:
          "Connect Supabase and OpenAI in the server environment to enable this feature.",
      },
      { status: 503 },
    );
  return Response.json(
    { error: "The request could not be completed. Please try again." },
    { status: 500 },
  );
}
