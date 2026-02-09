import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { OrgProvider } from "./context/OrgContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OrgProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </OrgProvider>
  </React.StrictMode>
);
