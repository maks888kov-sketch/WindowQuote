import { createContext, useCallback, useContext, useMemo, useState } from "react";

type NotificationType = "success" | "error" | "info";

type Notification = {
  id: number;
  type: NotificationType;
  message: string;
};

type NotifyInput = {
  type?: NotificationType;
  message: string;
  durationMs?: number;
};

type NotificationsContextValue = {
  notify: (input: NotifyInput) => void;
};

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export const NotificationsProvider = ({ children }: { children: React.ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notify = useCallback(({ type = "info", message, durationMs = 3500 }: NotifyInput) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setNotifications((prev) => [...prev, { id, type, message }]);

    window.setTimeout(() => {
      setNotifications((prev) => prev.filter((notification) => notification.id !== id));
    }, durationMs);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {notifications.map((notification) => (
          <div key={notification.id} className={`toast toast-${notification.type}`}>
            {notification.message}
          </div>
        ))}
      </div>
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return context;
};
