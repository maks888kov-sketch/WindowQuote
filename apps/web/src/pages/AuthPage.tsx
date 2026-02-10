import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

const ACTIVE_ORG_STORAGE_KEY = "activeOrgId";
const LOGIN_TOAST_FLAG_KEY = "windowquote-login-toast";

const AuthPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (mode: "sign-in" | "sign-up") => {
    setMessage(null);

    const response =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    const { data, error } = response;

    if (error) {
      return setMessage(error.message);
    }

    if (mode === "sign-in") {
      const rememberedOrgId = localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
      const { data: memberships } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", data.user?.id ?? "");

      const availableOrgIds = (memberships ?? []).map((membership) => membership.org_id);
      const orgIdForLog = rememberedOrgId && availableOrgIds.includes(rememberedOrgId)
        ? rememberedOrgId
        : availableOrgIds[0];

      if (orgIdForLog) {
        await supabase.rpc("log_auth_event", { p_org_id: orgIdForLog, p_event: "login" });
      }

      sessionStorage.setItem(LOGIN_TOAST_FLAG_KEY, "1");
    }

    setMessage(mode === "sign-in" ? "Signed in." : "Check your email to confirm sign up.");
  };

  return (
    <section className="card">
      <h1>Sign in or create an account</h1>
      <p>Use Supabase Auth to access your organization workspace.</p>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          void handleAuth("sign-in");
        }}
      >
        <label className="field">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <div className="row">
          <button className="btn" type="submit">
            Sign in
          </button>
          <button
            className="btn secondary"
            type="button"
            onClick={() => void handleAuth("sign-up")}
          >
            Sign up
          </button>
        </div>
      </form>
      {message && <p className="notice">{message}</p>}
    </section>
  );
};

export default AuthPage;
