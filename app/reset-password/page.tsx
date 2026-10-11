"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
export default function Reset() {
  const [message, setMessage] = useState(""),
    [tone, setTone] = useState<"success" | "error">("success"),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth
      .getSession()
      .then(({ data }) => setReady(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setReady(!!s));
    return () => data.subscription.unsubscribe();
  }, []);
  return (
    <main className="reset-page">
      <section className="panel">
        <h1>Set a new password.</h1>
        <p>
          {ready
            ? "Choose a strong password for your RESCUE account."
            : "Open the password reset link from your email."}
        </p>
        {ready && (
          <form
            className="stack-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const password = String(
                new FormData(e.currentTarget).get("password"),
              );
              const { error } = await supabase!.auth.updateUser({ password });
              setTone(error ? "error" : "success");
              setMessage(
                error
                  ? error.message
                  : "Password updated. You can return to RESCUE.",
              );
              setBusy(false);
            }}
          >
            <label className="field">
              New password
              <input
                type="password"
                name="password"
                required
                minLength={10}
                autoComplete="new-password"
              />
            </label>
            <button className="button primary" disabled={busy}>
              Update password
            </button>
          </form>
        )}
        {message && (
          <p role={tone === "error" ? "alert" : "status"} className={`notice ${tone}`}>
            {message}
          </p>
        )}
        <a href="/">Return to RESCUE →</a>
      </section>
    </main>
  );
}
