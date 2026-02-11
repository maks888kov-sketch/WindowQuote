import { useState } from "react";
import { useNotifications } from "../context/NotificationsContext";
import { supabase } from "../lib/supabaseClient";

const ACTIVE_ORG_STORAGE_KEY = "activeOrgId";

const AuthPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { notify } = useNotifications();

  const handleAuth = async (mode: "sign-in" | "sign-up") => {
    const response =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    const { data, error } = response;

    if (error) {
      notify({
        type: "error",
        message:
          mode === "sign-in"
            ? `Ошибка входа: ${error.message}`
            : `Ошибка регистрации: ${error.message}`,
      });
      return;
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

      notify({ type: "success", message: `Вход выполнен: ${data.user?.email ?? email}` });
      return;
    }

    const needsEmailConfirmation = !data.session;
    notify({
      type: "success",
      message: needsEmailConfirmation
        ? `Регистрация успешна: письмо отправлено на ${email}`
        : `Аккаунт создан: ${data.user?.email ?? email}`,
    });
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
    </section>
  );
};

export default AuthPage;
