import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let cachedAdminClient = null;

export const getSupabaseAdmin = () => {
  if (cachedAdminClient) {
    return { client: cachedAdminClient, error: null };
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      client: null,
      error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for admin API routes.",
    };
  }

  cachedAdminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return { client: cachedAdminClient, error: null };
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
