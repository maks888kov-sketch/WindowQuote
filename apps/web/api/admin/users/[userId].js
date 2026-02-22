import { createClient } from "@supabase/supabase-js";
import { getBearerToken, jsonResponse } from "../../_lib/supabase.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeUserId = (queryUserId) => {
  if (typeof queryUserId === "string") {
    return queryUserId.trim();
  }

  if (Array.isArray(queryUserId) && typeof queryUserId[0] === "string") {
    return queryUserId[0].trim();
  }

  return "";
};

const setCorsHeaders = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
};

const createSupabaseAdmin = () => {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  const missing = [];
  if (!supabaseUrl) {
    missing.push("SUPABASE_URL");
  }
  if (!serviceRoleKey) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (missing.length > 0) {
    return {
      error: {
        code: "MISSING_ENV",
        missing,
        details: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel and redeploy.",
      },
    };
  }

  return {
    client: createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }),
  };
};

const verifyAdminPermission = async (supabaseAdmin, accessToken, userId) => {
  if (!accessToken) {
    return { ok: false, status: 401, error: "Missing Authorization Bearer token." };
  }

  const { data: currentUserData, error: currentUserError } = await supabaseAdmin.auth.getUser(accessToken);
  if (currentUserError || !currentUserData?.user) {
    return {
      ok: false,
      status: 401,
      error: "Invalid or expired access token.",
      details: currentUserError?.message,
    };
  }

  if (currentUserData.user.id === userId) {
    return {
      ok: false,
      status: 400,
      error: "CANNOT_DELETE_SELF",
      details: "Admin cannot delete own account from this screen.",
    };
  }

  const { count, error: adminMembershipError } = await supabaseAdmin
    .from("org_members")
    .select("org_id", { count: "exact", head: true })
    .eq("user_id", currentUserData.user.id)
    .eq("role", "admin");

  if (adminMembershipError) {
    return {
      ok: false,
      status: 500,
      error: "ADMIN_MEMBERSHIPS_FAILED",
      details: adminMembershipError.message,
    };
  }

  if (!count) {
    return { ok: false, status: 403, error: "Only org admins can perform this action." };
  }

  return { ok: true };
};

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE, OPTIONS");
    return jsonResponse(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  let userId = normalizeUserId(req.query?.userId);
  if (!userId && typeof req.url === "string") {
    const match = req.url.match(/\/api\/admin\/users\/([^/?]+)/);
    if (match) userId = match[1].trim();
  }
  if (!userId) {
    return jsonResponse(res, 400, {
      ok: false,
      error: "BAD_REQUEST",
      details: "userId is required.",
    });
  }

  if (!UUID_REGEX.test(userId)) {
    return jsonResponse(res, 400, {
      ok: false,
      error: "BAD_REQUEST",
      details: "userId must be a valid UUID.",
    });
  }

  const { client: supabaseAdmin, error: adminClientError } = createSupabaseAdmin();
  if (adminClientError) {
    return jsonResponse(res, 500, {
      ok: false,
      error: adminClientError.code,
      missing: adminClientError.missing,
      details: adminClientError.details,
    });
  }

  try {
    const accessToken = getBearerToken(req);
    const permissionCheck = await verifyAdminPermission(supabaseAdmin, accessToken, userId);
    if (!permissionCheck.ok) {
      return jsonResponse(res, permissionCheck.status, {
        ok: false,
        error: permissionCheck.error,
        details: permissionCheck.details,
      });
    }

    // Remove org memberships first to avoid FK constraints
    await supabaseAdmin.from("org_members").delete().eq("user_id", userId);
    await supabaseAdmin.from("push_subscriptions").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("user_id", userId);

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      return jsonResponse(res, 500, {
        ok: false,
        error: "DELETE_USER_FAILED",
        details: deleteError.message,
        code: deleteError.code ?? null,
        hint: deleteError.message?.includes("foreign key") ? "User may be referenced elsewhere. Try removing from all orgs first." : undefined,
      });
    }

    return jsonResponse(res, 200, { ok: true });
  } catch (error) {
    return jsonResponse(res, 500, {
      ok: false,
      error: "UNHANDLED",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
