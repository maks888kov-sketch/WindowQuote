import { createClient } from "@supabase/supabase-js";

let cachedAdminClient = null;

const pickFirstEnv = (keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return "";
};

const readAdminEnv = () => {
  const supabaseUrl = pickFirstEnv(["SUPABASE_URL", "SUPABASE_PROJECT_URL", "VITE_SUPABASE_URL"]);
  const serviceRoleKey = pickFirstEnv(["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE"]);

  const missing = [];
  if (!supabaseUrl) {
    missing.push("SUPABASE_URL (fallbacks: SUPABASE_PROJECT_URL, VITE_SUPABASE_URL)");
  }
  if (!serviceRoleKey) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY (fallback: SUPABASE_SERVICE_ROLE)");
  }

  return { supabaseUrl, serviceRoleKey, missing };
};

const buildMissingEnvError = (missing) => ({
  code: "MISSING_ENV",
  missing,
  where: "vercel_project_env",
  hint: "Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel Project Settings → Environment Variables, then Redeploy",
});

const logAdminEnvDiagnostics = () => {
  const { missing } = readAdminEnv();
  const missingEnv = missing.length > 0 ? missing : ["none"];

  console.info("[admin-env] diagnostics", {
    has_SUPABASE_URL: !missing.some((item) => item.startsWith("SUPABASE_URL")),
    has_SERVICE_ROLE: !missing.some((item) => item.startsWith("SUPABASE_SERVICE_ROLE_KEY")),
    missing: missingEnv,
  });
};

export const getSupabaseAdmin = () => {
  logAdminEnvDiagnostics();

  if (cachedAdminClient) {
    return { client: cachedAdminClient };
  }

  const { supabaseUrl, serviceRoleKey, missing } = readAdminEnv();
  if (missing.length > 0) {
    return {
      error: buildMissingEnvError(missing),
    };
  }

  cachedAdminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return { client: cachedAdminClient };
};

export const getAdminEnvStatus = () => {
  const { missing } = readAdminEnv();
  return {
    has_SUPABASE_URL: !missing.some((item) => item.startsWith("SUPABASE_URL")),
    has_SERVICE_ROLE: !missing.some((item) => item.startsWith("SUPABASE_SERVICE_ROLE_KEY")),
    vercel_env: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
  };
};

export const getBearerToken = (req) => {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== "string" || !header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice(7).trim();
};

export const jsonResponse = (res, status, payload = {}) => {
  const safePayload = payload && typeof payload === "object" ? { ...payload } : { error: String(payload) };
  if (!Object.prototype.hasOwnProperty.call(safePayload, "ok")) {
    safePayload.ok = status < 400;
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).send(JSON.stringify(safePayload));
};

export const verifyOrgAdmin = async (orgId, accessToken, supabaseAdmin) => {
  if (!orgId) {
    return { ok: false, status: 400, error: "orgId is required." };
  }

  if (!accessToken) {
    return { ok: false, status: 401, error: "Missing Authorization Bearer token." };
  }

  if (!supabaseAdmin) {
    return { ok: false, status: 500, error: "Supabase admin client is not configured on server." };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return { ok: false, status: 401, error: "Invalid or expired access token." };
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (membershipError) {
    return { ok: false, status: 500, error: membershipError.message };
  }

  if (!membership || membership.role !== "admin") {
    return { ok: false, status: 403, error: "Only org admins can perform this action." };
  }

  return { ok: true, userId: userData.user.id };
};
