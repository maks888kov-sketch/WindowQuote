import { useParams } from "react-router-dom";

const NewMeasurementPage = () => {
  const { id } = useParams();

  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>New Measurement</h1>
          <p>Create a new measurement version for order {id}.</p>
        </div>
        <button className="btn">Save draft</button>
      </div>
      <div className="card stack">
        <h2>Measurement items</h2>
        <div className="grid">
          <label className="field">
            Item type
            <select>
              <option>Window</option>
              <option>Door</option>
              <option>Hardware</option>
            </select>
          </label>
          <label className="field">
            Width (mm)
            <input type="number" placeholder="0" />
          </label>
          <label className="field">
            Height (mm)
            <input type="number" placeholder="0" />
          </label>
          <label className="field">
            Quantity
            <input type="number" placeholder="1" />
          </label>
        </div>
        <label className="field">
          Params (JSON)
          <textarea rows={4} placeholder='{"color":"white"}' />
        </label>
        <button className="btn secondary">Add item</button>
      </div>
      <div className="card stack">
        <h2>Photos</h2>
        <p>Upload photos to the private “photos” storage bucket.</p>
        <input type="file" multiple />
      </div>
    </section>
  );
};

export default NewMeasurementPage;
