import { getBearerToken, getSupabaseAdmin, jsonResponse, verifyOrgAdmin } from "../../_lib/supabase.js";

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

const resolveOrgId = (req) => {
  if (typeof req.query?.orgId === "string" && req.query.orgId.trim()) {
    return req.query.orgId.trim();
  }

  if (typeof req.body?.orgId === "string" && req.body.orgId.trim()) {
    return req.body.orgId.trim();
  }

  return "";
};

const cleanUserRelations = async (supabaseAdmin, userId) => {
  const relationTables = ["org_members", "profiles"];

  for (const table of relationTables) {
    const { error } = await supabaseAdmin.from(table).delete().eq("user_id", userId);
    if (error) {
      return {
        ok: false,
        table,
        error,
      };
    }
  }

  return { ok: true };
};

const verifyAdminPermission = async (req, supabaseAdmin, accessToken, userId) => {
  const orgId = resolveOrgId(req);

  if (orgId) {
    const adminCheck = await verifyOrgAdmin(orgId, accessToken, supabaseAdmin);
    if (!adminCheck.ok) {
      return { ok: false, status: adminCheck.status, error: adminCheck.error };
    }

    if (adminCheck.userId === userId) {
      return {
        ok: false,
        status: 400,
        error: "CANNOT_DELETE_SELF",
        details: "Admin cannot delete own account from this screen.",
      };
    }

    return { ok: true };
  }

  if (!accessToken) {
    return { ok: false, status: 401, error: "Missing Authorization Bearer token." };
  }

  const { data: currentUserData, error: currentUserError } = await supabaseAdmin.auth.getUser(accessToken);
  if (currentUserError || !currentUserData?.user) {
    return { ok: false, status: 401, error: "Invalid or expired access token.", details: currentUserError?.message };
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
  try {
    if (req.method !== "DELETE") {
      res.setHeader("Allow", "DELETE");
      return jsonResponse(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    const userId = normalizeUserId(req.query?.userId);
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

    const { client: supabaseAdmin, error: adminClientError } = getSupabaseAdmin();
    if (adminClientError) {
      if (adminClientError.code === "MISSING_ENV") {
        return jsonResponse(res, 500, {
          ok: false,
          error: "MISSING_ENV",
          missing: adminClientError.missing ?? [],
          details: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel and redeploy.",
        });
      }

      return jsonResponse(res, 500, {
        ok: false,
        error: "ADMIN_CLIENT_NOT_CONFIGURED",
        details: "Supabase admin client is not configured on server.",
      });
    }

    const accessToken = getBearerToken(req);
    const permissionCheck = await verifyAdminPermission(req, supabaseAdmin, accessToken, userId);
    if (!permissionCheck.ok) {
      return jsonResponse(res, permissionCheck.status, {
        ok: false,
        error: permissionCheck.error,
        details: permissionCheck.details,
      });
    }

    const relationCleanup = await cleanUserRelations(supabaseAdmin, userId);
    if (!relationCleanup.ok) {
      return jsonResponse(res, 500, {
        ok: false,
        error: "RELATION_CLEANUP_FAILED",
        details: `${relationCleanup.table}: ${relationCleanup.error.message}`,
      });
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      const status = deleteError.status && Number.isInteger(deleteError.status) ? deleteError.status : 500;
      return jsonResponse(res, status, {
        ok: false,
        error: "DELETE_USER_FAILED",
        details: deleteError.message,
        code: deleteError.code ?? null,
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
