import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useOrgContext } from "../context/OrgContext";
import { supabase } from "../lib/supabaseClient";

type Stat = {
  totalOrders: number;
  totalQuoted: number;
  totalCompleted: number;
  totalAmount: number;
  byStatus: Record<string, number>;
  dailyData: { date: string; orders: number; amount: number }[];
  prevPeriodOrders: number;
  prevPeriodAmount: number;
  recentOrders: { id: string; order_number?: string | null; title: string; status: string; created_at: string }[];
};

const COLORS = ["#0f172a", "#334155", "#64748b", "#94a3b8", "#cbd5e1", "#e2e8f0"];

const DashboardPage = () => {
  const { activeOrgId } = useOrgContext();
  const [stats, setStats] = useState<Stat | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);

  const load = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    try {
      const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
      const since = new Date();
      since.setDate(since.getDate() - days);
      const prevSince = new Date(since);
      prevSince.setDate(prevSince.getDate() - days);

      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number, title, status, created_at")
        .eq("org_id", activeOrgId)
        .gte("created_at", since.toISOString());

      const { data: prevOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("org_id", activeOrgId)
        .gte("created_at", prevSince.toISOString())
        .lt("created_at", since.toISOString());

      const byStatus: Record<string, number> = {};
      let totalAmount = 0;
      const dailyMap: Record<string, { orders: number; amount: number }> = {};
      (orders ?? []).forEach((o) => {
        byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
        const d = o.created_at.slice(0, 10);
        if (!dailyMap[d]) dailyMap[d] = { orders: 0, amount: 0 };
        dailyMap[d].orders += 1;
      });

      const orderIds = (orders ?? []).map((o) => o.id);
      if (orderIds.length > 0) {
        const { data: quotes } = await supabase
          .from("quotes")
          .select("order_id, total_amount, created_at")
          .in("order_id", orderIds);
        (quotes ?? []).forEach((q) => {
          const amt = Number(q.total_amount) || 0;
          totalAmount += amt;
          const d = (q.created_at as string).slice(0, 10);
          if (dailyMap[d]) dailyMap[d].amount += amt;
        });
      }

      const dailyData = Object.entries(dailyMap)
        .map(([date, v]) => ({ date, orders: v.orders, amount: v.amount }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const prevOrderIds = (prevOrders ?? []).map((o: { id: string }) => o.id);
      let prevAmount = 0;
      if (prevOrderIds.length > 0) {
        const { data: prevQuotes } = await supabase
          .from("quotes")
          .select("total_amount")
          .in("order_id", prevOrderIds);
        prevAmount = (prevQuotes ?? []).reduce((s, q) => s + (Number(q.total_amount) || 0), 0);
      }

      setStats({
        totalOrders: orders?.length ?? 0,
        totalQuoted: byStatus["quoted"] ?? 0,
        totalCompleted: byStatus["completed"] ?? 0,
        totalAmount,
        byStatus,
        dailyData,
        prevPeriodOrders: prevOrders?.length ?? 0,
        prevPeriodAmount: prevAmount,
        recentOrders: (orders ?? []).slice(0, 10),
      });
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, period]);

  useEffect(() => {
    void load();
  }, [load]);

  const conversion = stats && stats.totalOrders > 0
    ? ((stats.totalCompleted / stats.totalOrders) * 100).toFixed(1)
    : "0";

  const ordersTrend = stats && stats.prevPeriodOrders > 0
    ? (((stats.totalOrders - stats.prevPeriodOrders) / stats.prevPeriodOrders) * 100).toFixed(0)
    : null;
  const amountTrend = stats && stats.prevPeriodAmount > 0
    ? (((stats.totalAmount - stats.prevPeriodAmount) / stats.prevPeriodAmount) * 100).toFixed(0)
    : null;

  const exportPdf = async () => {
    setExporting("pdf");
    try {
      const { PDFDocument, StandardFonts } = await import("pdf-lib");
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const page = doc.addPage([595, 842]);
      let y = 780;
      const add = (text: string, size = 10) => {
        page.drawText(text, { x: 50, y, size, font });
        y -= size + 4;
      };
      add("Dashboard Report", 16);
      add(`Period: ${period === "7d" ? "7" : period === "30d" ? "30" : "90"} days`);
      add(`Orders: ${stats?.totalOrders ?? 0}`);
      add(`Completed: ${stats?.totalCompleted ?? 0}`);
      add(`Total amount: $${stats?.totalAmount.toFixed(0) ?? "0"}`);
      add(`Conversion: ${conversion}%`);
      const bytes = await doc.save();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dashboard-${period}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setExporting(null);
    }
  };

  const exportExcel = async () => {
    setExporting("xlsx");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const wsData = [
        ["Metric", "Value"],
        ["Orders", stats?.totalOrders ?? 0],
        ["Quoted", stats?.totalQuoted ?? 0],
        ["Completed", stats?.totalCompleted ?? 0],
        ["Conversion %", conversion],
        ["Total amount", stats?.totalAmount ?? 0],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Summary");
      if (stats && stats.recentOrders.length > 0) {
        const ordersData = [
          ["Order", "Title", "Status", "Date"],
          ...stats.recentOrders.map((o) => [
            o.order_number ?? o.id,
            o.title,
            o.status,
            new Date(o.created_at).toLocaleDateString(),
          ]),
        ];
        const ws2 = XLSX.utils.aoa_to_sheet(ordersData);
        XLSX.utils.book_append_sheet(wb, ws2, "Recent orders");
      }
      XLSX.writeFile(wb, `dashboard-${period}.xlsx`);
    } catch {
      // ignore
    } finally {
      setExporting(null);
    }
  };

  const pieData = stats
    ? Object.entries(stats.byStatus).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <section className="stack">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Analytics and overview.</p>
      </div>
      <div className="row" style={{ gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {(["7d", "30d", "90d"] as const).map((p) => (
          <button
            key={p}
            className={`btn ${period === p ? "" : "secondary"}`}
            onClick={() => setPeriod(p)}
          >
            {p === "7d" ? "7 days" : p === "30d" ? "30 days" : "90 days"}
          </button>
        ))}
        <button className="btn secondary" onClick={exportPdf} disabled={exporting !== null || !stats}>
          {exporting === "pdf" ? "…" : "Export PDF"}
        </button>
        <button className="btn secondary" onClick={exportExcel} disabled={exporting !== null || !stats}>
          {exporting === "xlsx" ? "…" : "Export Excel"}
        </button>
      </div>
      {loading ? (
        <p>Loading...</p>
      ) : stats ? (
        <>
          <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "1rem" }}>
            <div>
              <p className="app-subtitle">Orders {ordersTrend != null && <span style={{ color: Number(ordersTrend) >= 0 ? "green" : "red" }}>({ordersTrend}%)</span>}</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats.totalOrders}</p>
            </div>
            <div>
              <p className="app-subtitle">Quoted</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats.totalQuoted}</p>
            </div>
            <div>
              <p className="app-subtitle">Completed</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats.totalCompleted}</p>
            </div>
            <div>
              <p className="app-subtitle">Conversion</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>{conversion}%</p>
            </div>
            <div>
              <p className="app-subtitle">Total amount {amountTrend != null && <span style={{ color: Number(amountTrend) >= 0 ? "green" : "red" }}>({amountTrend}%)</span>}</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>${stats.totalAmount.toFixed(0)}</p>
            </div>
          </div>

          {stats.dailyData.length > 0 && (
            <div className="card">
              <h2>Orders & amount by day</h2>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area yAxisId="left" type="monotone" dataKey="orders" stroke="#0f172a" fill="#0f172a" fillOpacity={0.3} name="Orders" />
                    <Area yAxisId="right" type="monotone" dataKey="amount" stroke="#334155" fill="#334155" fillOpacity={0.2} name="Amount" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {pieData.length > 0 && (
            <div className="card">
              <h2>By status</h2>
              <div style={{ height: 220, display: "flex", alignItems: "center" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="card">
            <h2>Recent orders</h2>
            {stats.recentOrders.length === 0 ? (
              <p className="empty-state">No orders in this period.</p>
            ) : (
              <ul>
                {stats.recentOrders.map((o) => (
                  <li key={o.id}>
                    <Link to={`/orders/${o.id}`}>{o.order_number ? `${o.order_number} · ` : ""}{o.title}</Link>
                    {" · "}
                    <span className="badge">{o.status}</span>
                    {" · "}
                    {new Date(o.created_at).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <p className="notice">Failed to load analytics.</p>
      )}
    </section>
  );
};

export default DashboardPage;
