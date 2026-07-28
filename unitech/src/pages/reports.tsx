import { useState, useMemo } from "react";
import {
  useGetDailyReport,
  useGetWeeklyReport,
  useGetMonthlyReport,
  useGetInventoryReport,
  useGetLowStockReport,
  useGetOutOfStockReport
} from "@/lib/api";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Printer, Download, FileText, CalendarDays, CalendarRange, Calendar,
  Package, AlertTriangle, XCircle, TrendingUp, ShoppingBag, BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
} from "recharts";

function formatCurrency(amount: number) {
  return "KSh " + new Intl.NumberFormat('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function exportToCsv(filename: string, rows: any[][]) {
  const csvContent = rows.map(e => e.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Consistent palette used across every chart on this page
const CHART_COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0d9488", "#db2777", "#4f46e5"];

const TAB_DEFS = [
  { label: "Daily Sales", icon: Calendar, color: "blue" as const },
  { label: "Weekly Sales", icon: CalendarDays, color: "indigo" as const },
  { label: "Monthly Sales", icon: CalendarRange, color: "purple" as const },
  { label: "Inventory Value", icon: Package, color: "emerald" as const },
  { label: "Low Stock", icon: AlertTriangle, color: "amber" as const },
  { label: "Out of Stock", icon: XCircle, color: "red" as const },
];

const TABS = TAB_DEFS.map(t => t.label);

export default function Reports() {
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const activeDef = TAB_DEFS.find(t => t.label === activeTab)!;

  return (
    <Layout title="Reports">
      <div className="flex flex-col gap-5 max-w-6xl mx-auto w-full">

        {/* Tab selector — icon pills, wraps/scrolls cleanly on mobile */}
        <div className="flex flex-wrap gap-2 no-print">
          {TAB_DEFS.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.label;
            return (
              <button
                key={t.label}
                onClick={() => setActiveTab(t.label)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium border transition-all whitespace-nowrap ${
                  active
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-sm"
                    : "bg-white text-muted-foreground border-border hover:border-blue-300 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="print-container bg-white border border-border p-3.5 sm:p-6 rounded-2xl shadow-sm">
          <div className="hidden print:block mb-8 text-center pb-6 border-b">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">UNITECH Inventory</h1>
            <p className="text-muted-foreground">{activeTab} Report</p>
            <p className="text-xs text-muted-foreground mt-1">Generated: {new Date().toLocaleString()}</p>
          </div>

          {activeTab === "Daily Sales" && <DailyReport />}
          {activeTab === "Weekly Sales" && <WeeklyReport />}
          {activeTab === "Monthly Sales" && <MonthlyReport />}
          {activeTab === "Inventory Value" && <InventoryReport />}
          {activeTab === "Low Stock" && <LowStockReport />}
          {activeTab === "Out of Stock" && <OutOfStockReport />}
        </div>
      </div>
    </Layout>
  );
}

// ─── Shared bits ─────────────────────────────────────────────────────────

const ICON_STYLE: Record<string, string> = {
  blue: "bg-blue-100 text-blue-600",
  indigo: "bg-indigo-100 text-indigo-600",
  purple: "bg-purple-100 text-purple-600",
  emerald: "bg-emerald-100 text-emerald-600",
  amber: "bg-amber-100 text-amber-600",
  red: "bg-red-100 text-red-600",
};

function ReportHeader({ title, color = "blue", onPrint, onExport }: { title: string; color?: string; onPrint: () => void; onExport: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 no-print">
      <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2 min-w-0">
        <span className={`p-1.5 rounded-lg shrink-0 ${ICON_STYLE[color]}`}>
          <FileText className="h-4 w-4" />
        </span>
        <span className="truncate">{title}</span>
      </h2>
      <div className="flex gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={onExport} className="gap-1.5 flex-1 sm:flex-none">
          <Download className="h-4 w-4" /> <span className="hidden xs:inline">Export</span> CSV
        </Button>
        <Button variant="default" size="sm" onClick={onPrint} className="gap-1.5 flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700">
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="p-4 border border-border rounded-xl bg-white flex items-center gap-3 shadow-sm">
      <div className={`p-2.5 rounded-lg shrink-0 ${ICON_STYLE[color]}`}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-lg sm:text-2xl font-bold tracking-tight truncate">{value}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, icon: Icon = BarChart3, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-xl bg-white p-3 sm:p-4 mb-6">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" /> {title}
      </p>
      <div className="w-full h-56 sm:h-72">
        {children}
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="w-full h-56 sm:h-72 flex flex-col items-center justify-center text-center text-muted-foreground gap-2 border border-dashed border-border rounded-xl mb-6">
      <BarChart3 className="h-6 w-6 opacity-30" />
      <p className="text-xs">{label}</p>
    </div>
  );
}

// Compact currency tick for Y axes so mobile charts don't get crowded
const kshTick = (v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`;

// ─── Daily ──────────────────────────────────────────────────────────────

function DailyReport() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const { data, isLoading } = useGetDailyReport({ date });

  const handleExport = () => {
    if (!data) return;
    const rows = [
      ["Date", "Total Amount", "Items Sold"],
      ...(data.items || []).map(i => [i.date, i.totalAmount, i.itemCount]),
      ["TOTAL", data.totalAmount, data.totalItems]
    ];
    exportToCsv(`daily_report_${date}.csv`, rows);
  };

  return (
    <div>
      <div className="flex gap-4 mb-5 no-print items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium">Select Date</label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full sm:w-48 bg-white" />
        </div>
      </div>

      <ReportHeader title={`Daily Report: ${date}`} color="blue" onPrint={() => window.print()} onExport={handleExport} />

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
            <StatCard icon={TrendingUp} label="Total Sales" value={formatCurrency(data?.totalAmount || 0)} color="blue" />
            <StatCard icon={ShoppingBag} label="Items Sold" value={data?.totalItems || 0} color="emerald" />
          </div>

          {data?.items && data.items.length > 0 ? (
            <ChartCard title="Sales Breakdown" icon={Calendar}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.items} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={kshTick} width={40} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="totalAmount" fill="#2563eb" radius={[4, 4, 0, 0]} name="Sales" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : (
            <EmptyChart label="No breakdown data for this date" />
          )}
        </>
      )}
    </div>
  );
}

// ─── Weekly ─────────────────────────────────────────────────────────────

function WeeklyReport() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const { data, isLoading } = useGetWeeklyReport({ startDate: date });

  const handleExport = () => {
    if (!data) return;
    const rows = [
      ["Date", "Total Amount", "Items Sold"],
      ...(data.items || []).map(i => [i.date, i.totalAmount, i.itemCount]),
      ["TOTAL", data.totalAmount, data.totalItems]
    ];
    exportToCsv(`weekly_report_${date}.csv`, rows);
  };

  return (
    <div>
      <div className="flex gap-4 mb-5 no-print items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium">Week Start Date</label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full sm:w-48 bg-white" />
        </div>
      </div>

      <ReportHeader title="Weekly Report" color="indigo" onPrint={() => window.print()} onExport={handleExport} />

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
            <StatCard icon={TrendingUp} label="Weekly Total Sales" value={formatCurrency(data?.totalAmount || 0)} color="indigo" />
            <StatCard icon={ShoppingBag} label="Items Sold" value={data?.totalItems || 0} color="emerald" />
          </div>

          {data?.items && data.items.length > 0 ? (
            <ChartCard title="Daily Trend" icon={CalendarDays}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.items} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={45} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={kshTick} width={40} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="totalAmount" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Sales" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : (
            <EmptyChart label="No daily breakdown available for this week" />
          )}

          <div className="overflow-x-auto">
            <table className="sheets-table mt-2 w-full min-w-[420px]">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="text-right">Items Sold</th>
                  <th className="text-right">Sales Amount</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map(item => (
                  <tr key={item.date}>
                    <td>{item.date}</td>
                    <td className="text-right">{item.itemCount}</td>
                    <td className="text-right">{formatCurrency(item.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Monthly ────────────────────────────────────────────────────────────

function MonthlyReport() {
  const d = new Date();
  const [month, setMonth] = useState(d.getMonth() + 1);
  const [year, setYear] = useState(d.getFullYear());

  const { data, isLoading } = useGetMonthlyReport({ month, year });

  const handleExport = () => {
    if (!data) return;
    const rows = [
      ["Date", "Total Amount", "Items Sold"],
      ...(data.items || []).map(i => [i.date, i.totalAmount, i.itemCount]),
      ["TOTAL", data.totalAmount, data.totalItems]
    ];
    exportToCsv(`monthly_report_${year}_${month}.csv`, rows);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3 sm:gap-4 mb-5 no-print items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium">Month</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-32 h-9 border border-input rounded-lg px-2 bg-white text-sm">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Year</label>
          <Input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-24 bg-white" />
        </div>
      </div>

      <ReportHeader
        title={`Monthly Report: ${new Date(0, month - 1).toLocaleString('default', { month: 'long' })} ${year}`}
        color="purple"
        onPrint={() => window.print()}
        onExport={handleExport}
      />

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
            <StatCard icon={TrendingUp} label="Monthly Total Sales" value={formatCurrency(data?.totalAmount || 0)} color="purple" />
            <StatCard icon={ShoppingBag} label="Items Sold" value={data?.totalItems || 0} color="emerald" />
          </div>

          {data?.items && data.items.length > 0 ? (
            <ChartCard title="Sales Across the Month" icon={CalendarRange}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.items} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={kshTick} width={40} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="totalAmount" fill="#7c3aed" radius={[3, 3, 0, 0]} name="Sales" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : (
            <EmptyChart label="No daily breakdown available for this month" />
          )}
        </>
      )}
    </div>
  );
}

// ─── Inventory Value ────────────────────────────────────────────────────

function InventoryReport() {
  const { data, isLoading } = useGetInventoryReport();

  const topByValue = useMemo(() => {
    return [...(data?.products ?? [])]
      .map(p => ({ name: p.name.length > 14 ? p.name.slice(0, 13) + "…" : p.name, value: p.costPrice * p.quantity }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [data]);

  const handleExport = () => {
    if (!data) return;
    const rows = [
      ["Barcode", "Product", "Cost Price", "Selling Price", "Quantity", "Total Value"],
      ...(data.products || []).map(p => [
        p.barcode,
        p.name,
        p.costPrice,
        p.sellingPrice,
        p.quantity,
        p.costPrice * p.quantity
      ])
    ];
    exportToCsv(`inventory_report.csv`, rows);
  };

  return (
    <div>
      <ReportHeader title="Inventory Value Report" color="emerald" onPrint={() => window.print()} onExport={handleExport} />

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
            <StatCard icon={Package} label="Total Stock Items" value={data?.totalProducts || 0} color="emerald" />
            <StatCard icon={TrendingUp} label="Total Inventory Value" value={formatCurrency(data?.totalValue || 0)} color="blue" />
          </div>

          {topByValue.length > 0 ? (
            <ChartCard title="Top Products by Stock Value" icon={Package}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topByValue} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={kshTick} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="value" fill="#059669" radius={[0, 4, 4, 0]} name="Stock value" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : (
            <EmptyChart label="No products to chart yet" />
          )}

          <div className="overflow-x-auto">
            <table className="sheets-table w-full min-w-[500px]">
              <thead>
                <tr>
                  <th>Barcode</th>
                  <th>Product</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Cost Price</th>
                  <th className="text-right">Total Value</th>
                </tr>
              </thead>
              <tbody>
                {data?.products.map(p => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.barcode}</td>
                    <td>{p.name}</td>
                    <td className="text-right">{p.quantity}</td>
                    <td className="text-right">{formatCurrency(p.costPrice)}</td>
                    <td className="text-right font-medium">{formatCurrency(p.costPrice * p.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Low Stock ──────────────────────────────────────────────────────────

function LowStockReport() {
  const { data, isLoading } = useGetLowStockReport();

  const chartData = useMemo(() => {
    return [...(data?.products ?? [])]
      .sort((a, b) => (a.quantity - a.minStockLevel) - (b.quantity - b.minStockLevel))
      .slice(0, 8)
      .map(p => ({ name: p.name.length > 14 ? p.name.slice(0, 13) + "…" : p.name, Current: p.quantity, "Min Level": p.minStockLevel }));
  }, [data]);

  const handleExport = () => {
    if (!data) return;
    const rows = [
      ["Barcode", "Product", "Brand", "Quantity", "Min Stock"],
      ...(data.products || []).map(p => [p.barcode, p.name, p.brandName || "", p.quantity, p.minStockLevel])
    ];
    exportToCsv(`low_stock_report.csv`, rows);
  };

  return (
    <div>
      <ReportHeader title="Low Stock Products" color="amber" onPrint={() => window.print()} onExport={handleExport} />

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
        <>
          <div className="mb-5 flex items-center gap-2 text-amber-700 bg-amber-50 p-3 rounded-xl font-medium border border-amber-200 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Found {data?.count || 0} products running low.
          </div>

          {chartData.length > 0 ? (
            <ChartCard title="Current Stock vs Minimum Level" icon={AlertTriangle}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 45 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} width={30} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Current" fill="#d97706" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Min Level" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : (
            <EmptyChart label="Nothing running low right now" />
          )}

          <div className="overflow-x-auto">
            <table className="sheets-table w-full min-w-[500px]">
              <thead>
                <tr>
                  <th>Barcode</th>
                  <th>Product</th>
                  <th>Brand</th>
                  <th className="text-right">Min Level</th>
                  <th className="text-right">Current Stock</th>
                </tr>
              </thead>
              <tbody>
                {data?.products.map(p => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.barcode}</td>
                    <td>{p.name}</td>
                    <td>{p.brandName || '-'}</td>
                    <td className="text-right">{p.minStockLevel}</td>
                    <td className="text-right font-bold text-amber-600">{p.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Out of Stock ───────────────────────────────────────────────────────

function OutOfStockReport() {
  const { data, isLoading } = useGetOutOfStockReport();

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    (data?.products ?? []).forEach(p => {
      const key = p.categoryName || "Uncategorized";
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [data]);

  const handleExport = () => {
    if (!data) return;
    const rows = [
      ["Barcode", "Product", "Brand", "Category"],
      ...(data.products || []).map(p => [p.barcode, p.name, p.brandName || "", p.categoryName || ""])
    ];
    exportToCsv(`out_of_stock_report.csv`, rows);
  };

  return (
    <div>
      <ReportHeader title="Out of Stock Products" color="red" onPrint={() => window.print()} onExport={handleExport} />

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
        <>
          <div className="mb-5 flex items-center gap-2 text-red-700 bg-red-50 p-3 rounded-xl font-medium border border-red-200 text-sm">
            <XCircle className="h-4 w-4 shrink-0" />
            Found {data?.count || 0} products completely out of stock.
          </div>

          {byCategory.length > 0 ? (
            <ChartCard title="Out of Stock by Category" icon={XCircle}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius="75%"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : (
            <EmptyChart label="Nothing out of stock right now" />
          )}

          <div className="overflow-x-auto">
            <table className="sheets-table w-full min-w-[500px]">
              <thead>
                <tr>
                  <th>Barcode</th>
                  <th>Product</th>
                  <th>Brand</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {data?.products.map(p => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.barcode}</td>
                    <td>{p.name}</td>
                    <td>{p.brandName || '-'}</td>
                    <td>{p.categoryName || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
