import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useOrgContext } from "../context/OrgContext";

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { refreshOrgs, setActiveOrgId } = useOrgContext();
  const [orgName, setOrgName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleCreateOrg = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const { data, error } = await supabase.rpc("create_org", { org_name: orgName });
    if (error) {
      setMessage(error.message);
      return;
    }

    const newOrgId = typeof data === "string" ? data : null;
    if (newOrgId) {
      setActiveOrgId(newOrgId);
    }

    await refreshOrgs();
    setMessage("Organization created. You can now manage customers and orders.");
    navigate("/orders", { replace: true });
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
