import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { OrgProvider } from "./context/OrgContext";
import { NotificationsProvider } from "./context/NotificationsContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <NotificationsProvider>
      <OrgProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </OrgProvider>
    </NotificationsProvider>
  </React.StrictMode>
);
