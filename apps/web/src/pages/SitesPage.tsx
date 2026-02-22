const SitesPage = () => {
  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>Объекты</h1>
          <p>Объекты (адреса) по клиентам.</p>
        </div>
        <button className="btn">Новый объект</button>
      </div>
      <div className="card">
        <div className="empty-state">
          <p>Пока нет объектов. Добавьте объект после выбора клиента.</p>
        </div>
      </div>
    </section>
  );
};

export default SitesPage;
