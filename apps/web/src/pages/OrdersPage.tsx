import { Link } from "react-router-dom";

const OrdersPage = () => {
  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>Orders</h1>
          <p>Track orders, statuses, and measurements.</p>
        </div>
        <button className="btn">New order</button>
      </div>
      <div className="card">
        <div className="empty-state">
          <p>No orders yet. Create your first order from a customer site.</p>
        </div>
        <div className="list">
          <div className="list-row">
            <div>
              <strong>Order #1001</strong>
              <p>Draft · Example Site</p>
            </div>
            <Link className="btn secondary" to="/orders/1001">
              View
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OrdersPage;
