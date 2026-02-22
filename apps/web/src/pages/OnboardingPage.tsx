import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrgContext } from "../context/OrgContext";
import { useNotifications } from "../context/NotificationsContext";
import { supabase } from "../lib/supabaseClient";

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { refreshOrgs, setActiveOrgId, session } = useOrgContext();
  const { notify } = useNotifications();
  const [orgName, setOrgName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleCreateOrg = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const { data, error } = await supabase.rpc("create_org", { org_name: orgName });
    if (error) {
      const errorText = `Ошибка создания организации: ${error.message}`;
      setMessage(errorText);
      notify({ type: "error", message: errorText });
      return;
    }

    const newOrgId = typeof data === "string" ? data : null;
    if (newOrgId) {
      setActiveOrgId(newOrgId);
    }

    await refreshOrgs();
    const userLabel = session?.user?.email ?? session?.user?.id ?? "unknown user";
    const successText = `Организация ${orgName} создана пользователем ${userLabel}`;
    setMessage("Организация создана. Можно управлять клиентами и заказами.");
    notify({ type: "success", message: successText });
    navigate("/orders", { replace: true });
  };

  return (
    <section className="card">
      <h1>Создание организации</h1>
      <p>Создайте организацию для работы с заказами и замерами.</p>
      <form className="stack" onSubmit={handleCreateOrg}>
        <label className="field">
          Название организации
          <input
            value={orgName}
            onChange={(event) => setOrgName(event.target.value)}
            required
          />
        </label>
        <button className="btn" type="submit">
          Создать организацию
        </button>
      </form>
      {message && <p className="notice">{message}</p>}
    </section>
  );
};

export default OnboardingPage;
