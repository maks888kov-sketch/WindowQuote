import { useParams } from "react-router-dom";

const MeasurementHistoryPage = () => {
  const { id } = useParams();

  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>Measurement history</h1>
          <p>Read-only versions for order {id}.</p>
        </div>
      </div>
      <div className="card">
        <div className="list">
          <div className="list-row">
            <div>
              <strong>Version 1</strong>
              <p>Draft · 0 items</p>
            </div>
            <button className="btn secondary">View</button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MeasurementHistoryPage;
