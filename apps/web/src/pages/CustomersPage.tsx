const CustomersPage = () => {
  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>Клиенты</h1>
          <p>Учёт клиентов и поиск по имени.</p>
        </div>
        <button className="btn">Новый клиент</button>
      </div>
      <div className="card">
        <label className="field">
          Поиск
          <input placeholder="Поиск по клиентам" />
        </label>
        <div className="empty-state">
          <p>Пока нет клиентов. Создайте первого клиента.</p>
        </div>
      </div>
    </section>
  );
};

export default CustomersPage;
