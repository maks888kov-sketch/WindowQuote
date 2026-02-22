import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { cacheOrders, getCachedOrders, isOnline } from "../lib/offlineCache";

type OfflineContextValue = {
  online: boolean;
  getCachedOrdersForOrg: (orgId: string) => Promise<unknown[]>;
  registerRetry: (fn: () => void) => () => void;
};

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(isOnline());
  const retryRef = useRef<Set<() => void>>(new Set());

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      retryRef.current.forEach((fn) => {
        try { fn(); } catch { /* ignore */ }
      });
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const getCachedOrdersForOrg = useCallback(async (orgId: string) => {
    return getCachedOrders(orgId);
  }, []);

  const registerRetry = useCallback((fn: () => void) => {
    retryRef.current.add(fn);
    return () => { retryRef.current.delete(fn); };
  }, []);

  const value: OfflineContextValue = { online, getCachedOrdersForOrg, registerRetry };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  return ctx ?? {
    online: true,
    getCachedOrdersForOrg: async () => [],
    registerRetry: () => () => {},
  };
}

export { cacheOrders };
