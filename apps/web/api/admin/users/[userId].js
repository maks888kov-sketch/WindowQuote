import { getBearerToken, getSupabaseAdmin, jsonResponse, verifyOrgAdmin } from "../../_lib/supabase.js";

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

export default async function handler(req, res) {
  try {
    if (req.method !== "DELETE") {
      res.setHeader("Allow", "DELETE");
      return jsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    const userId = typeof req.query.userId === "string" ? req.query.userId : "";
    const orgId =
      typeof req.query.orgId === "string"
        ? req.query.orgId
        : typeof req.body?.orgId === "string"
          ? req.body.orgId
          : "";

    if (!userId || !orgId) {
      return jsonResponse(res, 400, {
        ok: false,
        error: "BAD_REQUEST",
        details: "userId and orgId are required.",
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
      });
    }

    const accessToken = getBearerToken(req);
    const adminCheck = await verifyOrgAdmin(orgId, accessToken, supabaseAdmin);
    if (!adminCheck.ok) {
      return jsonResponse(res, adminCheck.status, {
        ok: false,
        error: adminCheck.error,
      });
    }

    if (adminCheck.userId === userId) {
      return jsonResponse(res, 400, {
        ok: false,
        error: "CANNOT_DELETE_SELF",
        details: "Admin cannot delete own account from this screen.",
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

    return jsonResponse(res, 200, { ok: true, userId });
  } catch (error) {
    return jsonResponse(res, 500, {
      ok: false,
      error: "UNHANDLED",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
