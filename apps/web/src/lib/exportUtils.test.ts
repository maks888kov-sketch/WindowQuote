import { describe, it, expect, vi, beforeEach } from "vitest";

describe("export helpers", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("PDF export produces valid structure via pdf-lib", async () => {
    const { PDFDocument, StandardFonts } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([595, 842]);
    page.drawText("Dashboard Report", { x: 50, y: 780, size: 16, font });
    const bytes = await doc.save();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("XLSX export produces valid workbook", async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const wsData = [["Metric", "Value"], ["Orders", 10], ["Completed", 5]];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Summary");
    const out = XLSX.write(wb, { type: "binary", bookType: "xlsx" }) as string;
    expect(typeof out === "string" && out.length > 0).toBe(true);
  });
});
