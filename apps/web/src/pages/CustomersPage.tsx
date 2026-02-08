const CustomersPage = () => {
  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>Customers</h1>
          <p>Capture customer details and search by name.</p>
        </div>
        <button className="btn">New customer</button>
      </div>
      <div className="card">
        <label className="field">
          Search
          <input placeholder="Search customers" />
        </label>
        <div className="empty-state">
          <p>No customers yet. Create your first customer to get started.</p>
        </div>
      </div>
    </section>
  );
};

export default CustomersPage;
