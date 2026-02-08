import { Link, useParams } from "react-router-dom";

const OrderDetailPage = () => {
  const { id } = useParams();

  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>Order {id}</h1>
          <p>Status history and measurements for this order.</p>
        </div>
        <Link className="btn" to={`/orders/${id}/measurements/new`}>
          New measurement
        </Link>
      </div>
      <div className="card">
        <h2>Status history</h2>
        <ul className="timeline">
          <li>Draft · Created today</li>
        </ul>
      </div>
      <div className="card">
        <div className="row">
          <h2>Measurements</h2>
          <Link className="btn secondary" to={`/orders/${id}/measurements`}>
            View all versions
          </Link>
        </div>
        <div className="empty-state">
          <p>No measurements yet. Add your first measurement version.</p>
        </div>
      </div>
    </section>
  );
};

export default OrderDetailPage;
