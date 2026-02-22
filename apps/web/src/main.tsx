import React from "react";
import ReactDOM from "react-dom/client";
import { registerServiceWorker } from "./lib/swRegistration";

registerServiceWorker();
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { OrgProvider } from "./context/OrgContext";
import { NotificationsProvider } from "./context/NotificationsContext";
import { PushNotificationsProvider } from "./context/PushNotificationsContext";
import { OfflineProvider } from "./context/OfflineContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <NotificationsProvider>
      <OfflineProvider>
      <PushNotificationsProvider>
      <OrgProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </OrgProvider>
      </PushNotificationsProvider>
      </OfflineProvider>
    </NotificationsProvider>
  </React.StrictMode>
);
