import { FormEvent, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const OnboardingPage = () => {
  const [orgName, setOrgName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleCreateOrg = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const { error } = await supabase.rpc("create_org", { org_name: orgName });
    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Organization created. You can now manage customers and orders.");
  };

  return (
    <section className="card">
      <h1>Onboarding</h1>
      <p>Create your organization using the secure RPC.</p>
      <form className="stack" onSubmit={handleCreateOrg}>
        <label className="field">
          Organization name
          <input
            value={orgName}
            onChange={(event) => setOrgName(event.target.value)}
            required
          />
        </label>
        <button className="btn" type="submit">
          Create organization
        </button>
      </form>
      {message && <p className="notice">{message}</p>}
    </section>
  );
};

export default OnboardingPage;
