import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

type OrgMembership = {
  org_id: string;
  org_name: string;
  role: string;
};

type OrgContextValue = {
  session: Session | null;
  orgs: OrgMembership[];
  activeOrgId: string | null;
  setActiveOrgId: (orgId: string | null) => void;
  refreshOrgs: () => Promise<void>;
  loading: boolean;
  authError: string | null;
};

const ACTIVE_ORG_STORAGE_KEY = "wq:selectedOrgId";

const OrgContext = createContext<OrgContextValue | undefined>(undefined);

type OrgRow = {
  org_id: string;
  role: string;
  orgs?: { name?: string | null } | { name?: string | null }[] | null;
};

const getOrgName = (orgs: OrgRow["orgs"]) => {
  if (!orgs) {
    return "No name";
  }

  if (Array.isArray(orgs)) {
    return orgs[0]?.name ?? "No name";
  }

  return orgs.name ?? "No name";
};

export const OrgProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [orgs, setOrgs] = useState<OrgMembership[]>([]);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(() =>
    localStorage.getItem(ACTIVE_ORG_STORAGE_KEY)
  );
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const setActiveOrgId = (orgId: string | null) => {
    setActiveOrgIdState(orgId);
    if (orgId) {
      localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, orgId);
    } else {
      localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
    }
  };

  const refreshOrgs = async () => {
    if (!session) {
      setOrgs([]);
      return;
    }

    const { data, error } = await supabase
      .from("org_members")
      .select("org_id, role, orgs(name)")
      .eq("user_id", session.user.id);

    if (error) {
      if ((error as any)?.code === "PGRST301") {
        setAuthError("Insufficient permissions for organization access. Please sign in again.");
      } else {
        setAuthError(error.message);
      }
      setOrgs([]);
      return;
    }

    const normalizedOrgs = ((data ?? []) as OrgRow[]).map((row) => ({
      org_id: row.org_id,
      org_name: getOrgName(row.orgs),
      role: row.role,
    }));

    setAuthError(null);
    setOrgs(normalizedOrgs);
  };

  useEffect(() => {
    let isMounted = true;

    const initSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (error) {
        setAuthError(error.message);
      }
      setSession(data.session ?? null);
      setLoading(false);
    };

    void initSession();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setOrgs([]);
      setActiveOrgId(null);
      setAuthError(null);
      return;
    }

    setLoading(true);
    void refreshOrgs().finally(() => setLoading(false));
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    if (orgs.length === 0) {
      if (activeOrgId !== null) {
        setActiveOrgId(null);
      }
      return;
    }

    const hasActive = activeOrgId && orgs.some((org) => org.org_id === activeOrgId);
    if (hasActive) {
      return;
    }

    if (orgs.length === 1) {
      setActiveOrgId(orgs[0].org_id);
    } else if (activeOrgId !== null) {
      setActiveOrgId(null);
    }
  }, [activeOrgId, orgs, session]);

  const value = useMemo(
    () => ({
      session,
      orgs,
      activeOrgId,
      setActiveOrgId,
      refreshOrgs,
      loading,
      authError,
    }),
    [session, orgs, activeOrgId, loading, authError]
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
};

export const useOrgContext = () => {
  const context = useContext(OrgContext);
  if (!context) {
    throw new Error("useOrgContext must be used within an OrgProvider");
  }
  return context;
};
