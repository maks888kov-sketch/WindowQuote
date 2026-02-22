import { getBearerToken, getSupabaseAdmin, jsonResponse } from "../_lib/supabase.js";

/**
 * Generate PDF for a quote (returns URL to stored PDF).
 * POST /api/quote-pdf
 * Body: { quoteId }
 *
 * Uses simple HTML string to generate PDF via external service or returns
 * a client-side printable URL. For serverless, we create a minimal PDF
 * using pdf-lib (no heavy deps). If pdf-lib is not available, we return
 * quote data for client-side PDF generation.
 */
async function generatePdfWithPdfLib(quote, lines, orgName) {
  try {
    const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
    const page = doc.addPage([595, 842]);
    const { width } = page.getSize();
    let y = 800;

    const draw = (text, x, size = 10, bold = false) => {
      const f = bold ? boldFont : font;
      page.drawText(text, { x, y, size, font: f, color: rgb(0, 0, 0) });
      y -= size + 4;
    };

    draw(`Quote - ${orgName}`, 50, 16, true);
    y -= 8;
    draw(`Quote ID: ${quote.id}`, 50);
    draw(`Order: ${quote.order_id}`, 50);
    draw(`Total: $${Number(quote.total_amount).toFixed(2)}`, 50);
    if (quote.discount_percent > 0) {
      draw(`Discount: ${quote.discount_percent}%`, 50);
    }
    y -= 12;

    draw("Line items:", 50, 12, true);
    y -= 8;

    for (const line of lines) {
      if (y < 100) {
        page.addPage([595, 842]);
        y = 800;
      }
      const desc = (line.description || "").slice(0, 50);
      draw(`${desc} | qty: ${line.quantity} | $${Number(line.unit_price).toFixed(2)} = $${Number(line.amount).toFixed(2)}`, 50);
    }

    y -= 20;
    draw(`Total: $${Number(quote.total_amount).toFixed(2)}`, 50, 14, true);

    const pdfBytes = await doc.save();
    return Buffer.from(pdfBytes);
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return jsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    const { quoteId } = req.body ?? {};
    if (!quoteId) {
      return jsonResponse(res, 400, { ok: false, error: "quoteId is required." });
    }

    const { client: supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (adminError) {
      if (adminError.code === "MISSING_ENV") {
        return jsonResponse(res, 500, { ok: false, error: "MISSING_ENV", missing: adminError.missing ?? [] });
      }
      return jsonResponse(res, 500, { ok: false, error: "ADMIN_CLIENT_NOT_CONFIGURED" });
    }

    const token = getBearerToken(req);
    if (!token) {
      return jsonResponse(res, 401, { ok: false, error: "Missing Authorization Bearer token." });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse(res, 401, { ok: false, error: "Invalid or expired access token." });
    }

    const { data: quote, error: quoteErr } = await supabaseAdmin
      .from("quotes")
      .select("id, org_id, order_id, total_amount, discount_percent")
      .eq("id", quoteId)
      .single();

    if (quoteErr || !quote) {
      return jsonResponse(res, 404, { ok: false, error: "Quote not found." });
    }

    const { data: membership } = await supabaseAdmin
      .from("org_members")
      .select("role")
      .eq("org_id", quote.org_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!membership) {
      return jsonResponse(res, 403, { ok: false, error: "Not authorized." });
    }

    const { data: lines } = await supabaseAdmin
      .from("quote_lines")
      .select("description, quantity, unit_price, amount")
      .eq("quote_id", quoteId)
      .order("sort_order");

    const { data: org } = await supabaseAdmin.from("orgs").select("name").eq("id", quote.org_id).single();
    const orgName = org?.name ?? "Organization";

    const pdfBuffer = await generatePdfWithPdfLib(quote, lines ?? [], orgName);

    if (!pdfBuffer) {
      return jsonResponse(res, 200, {
        ok: true,
        pdf_url: null,
        fallback: true,
        quote: { ...quote, lines: lines ?? [] },
        message: "PDF generation skipped. Use client-side print or install pdf-lib.",
      });
    }

    const path = `orgs/${quote.org_id}/quotes/${quoteId}.pdf`;
    const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
      .from("photos")
      .upload(path, pdfBuffer, { contentType: "application/pdf", upsert: true });

    if (uploadErr) {
      return jsonResponse(res, 200, {
        ok: true,
        pdf_url: null,
        quote_id: quoteId,
        message: "PDF generated but upload failed. Use fallback.",
        fallback: true,
        quote: { ...quote, lines: lines ?? [] },
      });
    }

    const { data: urlData } = await supabaseAdmin.storage.from("photos").createSignedUrl(path, 3600);

    const signedUrl = urlData?.signedUrl ?? urlData?.data?.signedUrl ?? null;
    if (signedUrl) {
      await supabaseAdmin.from("quotes").update({ pdf_url: signedUrl }).eq("id", quoteId);
    }

    return jsonResponse(res, 200, {
      ok: true,
      pdf_url: signedUrl,
      quote_id: quoteId,
    });
  } catch (err) {
    return jsonResponse(res, 500, {
      ok: false,
      error: "Internal server error.",
      details: err instanceof Error ? err.message : String(err),
    });
  }
}
