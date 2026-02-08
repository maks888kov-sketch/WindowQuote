import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (mode: "sign-in" | "sign-up") => {
    setMessage(null);
  
    const { error } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
  
    if (error) return setMessage(error.message);
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
