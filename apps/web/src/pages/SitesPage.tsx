const SitesPage = () => {
  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>Sites</h1>
          <p>Manage job sites linked to customers.</p>
        </div>
        <button className="btn">New site</button>
      </div>
      <div className="card">
        <div className="empty-state">
          <p>No sites yet. Add a site once a customer is selected.</p>
        </div>
      </div>
    </section>
  );
};

export default SitesPage;
