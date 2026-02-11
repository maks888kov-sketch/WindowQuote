import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useOrgContext } from "../context/OrgContext";

const OrgSelectPage = () => {
  const navigate = useNavigate();
  const { orgs, activeOrgId, setActiveOrgId } = useOrgContext();
  const [selectedOrgId, setSelectedOrgId] = useState("");

  useEffect(() => {
    if (activeOrgId) {
      setSelectedOrgId(activeOrgId);
      return;
    }

    if (orgs.length === 1) {
      setSelectedOrgId(orgs[0].org_id);
    }
  }, [activeOrgId, orgs]);

  if (orgs.length === 0) {
    return (
      <section className="card stack">
        <h1>Нет организаций</h1>
        <p>У вашего пользователя пока нет доступа ни к одной организации.</p>
        <div className="row">
          <NavLink className="btn" to="/onboarding">
            Create Org
          </NavLink>
        </div>
      </section>
    );
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedOrgId) {
      return;
    }

    setActiveOrgId(selectedOrgId);
    navigate("/orders", { replace: true });
  };

  return (
    <section className="card">
      <h1>Выберите организацию</h1>
      <p>У аккаунта есть доступ к нескольким организациям.</p>
      <form className="stack" onSubmit={handleSubmit}>
        <label className="field">
          Организация
          <select
            value={selectedOrgId}
            onChange={(event) => setSelectedOrgId(event.target.value)}
            required
          >
            <option value="" disabled>
              Выберите организацию
            </option>
            {orgs.map((org) => (
              <option key={org.org_id} value={org.org_id}>
                {org.orgs?.[0]?.name ?? "Без названия"}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" type="submit">
          Продолжить
        </button>
      </form>
    </section>
  );
};

export default OrgSelectPage;
