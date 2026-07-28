import { useGetDashboardStats, useGetRecentProducts, useGetRecentSales } from "@/lib/api";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Tags, AlertTriangle, AlertCircle, ShoppingCart, DollarSign, ArrowUpRight } from "lucide-react";

function formatCurrency(amount: number) {
  return "KSh " + new Intl.NumberFormat('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export default function Dashboard() {
  const { data: stats } = useGetDashboardStats();
  const { data: recentProducts } = useGetRecentProducts();
  const { data: recentSales } = useGetRecentSales();

  const statCards = [
    {
      title: "Total Products",
      value: stats?.totalProducts || 0,
      icon: Package,
      color: "text-blue-700",
      iconBg: "bg-blue-200",
      cardBg: "bg-blue-50",
      border: "border-blue-200",
    },
    {
      title: "Total Categories",
      value: stats?.totalCategories || 0,
      icon: Tags,
      color: "text-indigo-700",
      iconBg: "bg-indigo-200",
      cardBg: "bg-indigo-50",
      border: "border-indigo-200",
    },
    {
      title: "Total Stock",
      value: stats?.totalStock || 0,
      icon: ArrowUpRight,
      color: "text-emerald-700",
      iconBg: "bg-emerald-200",
      cardBg: "bg-emerald-50",
      border: "border-emerald-200",
    },
    {
      title: "Today's Sales",
      value: formatCurrency(stats?.todaySales || 0),
      icon: DollarSign,
      color: "text-green-700",
      iconBg: "bg-green-200",
      cardBg: "bg-green-50",
      border: "border-green-200",
    },
    {
      title: "Month's Sales",
      value: formatCurrency(stats?.monthSales || 0),
      icon: ShoppingCart,
      color: "text-teal-700",
      iconBg: "bg-teal-200",
      cardBg: "bg-teal-50",
      border: "border-teal-200",
    },
    {
      title: "Low Stock",
      value: stats?.lowStockCount || 0,
      icon: AlertTriangle,
      color: "text-amber-700",
      iconBg: "bg-amber-200",
      cardBg: "bg-amber-50",
      border: "border-amber-200",
    },
    {
      title: "Out of Stock",
      value: stats?.outOfStockCount || 0,
      icon: AlertCircle,
      color: "text-red-700",
      iconBg: "bg-red-200",
      cardBg: "bg-red-50",
      border: "border-red-200",
    },
  ];

  return (
    <Layout title="Dashboard">
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card
              key={i}
              className={`shadow-none border ${stat.border} ${stat.cardBg} transition-transform hover:-translate-y-0.5`}
            >
              <CardContent className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                <div className={`p-2 sm:p-3 rounded-md ${stat.iconBg} shrink-0`}>
                  <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{stat.title}</p>
                  <p className={`text-lg sm:text-2xl font-bold tracking-tight ${stat.color}`}>{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-none border-border">
          <CardHeader className="pb-3 border-b bg-blue-50/50">
            <CardTitle className="text-base font-semibold text-blue-900">Recently Added Products</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="sheets-table min-w-[480px]">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Stock</th>
                </tr>
              </thead>
              <tbody>
                {recentProducts?.slice(0, 5).map(p => (
                  <tr key={p.id}>
                    <td className="font-medium text-foreground">{p.name}</td>
                    <td>{p.categoryName || '-'}</td>
                    <td className="text-right">{formatCurrency(p.sellingPrice)}</td>
                    <td className="text-right">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        p.status === 'in_stock' ? 'bg-green-100 text-green-700' :
                        p.status === 'low_stock' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {p.quantity}
                      </span>
                    </td>
                  </tr>
                ))}
                {!recentProducts?.length && (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-muted-foreground">No recent products found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader className="pb-3 border-b bg-teal-50/50">
            <CardTitle className="text-base font-semibold text-teal-900">Recent Sales</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="sheets-table min-w-[360px]">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="text-right">Items</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentSales?.slice(0, 5).map(s => (
                  <tr key={s.id}>
                    <td>{new Date(s.saleDate).toLocaleDateString()}</td>
                    <td className="text-right">{s.itemCount}</td>
                    <td className="text-right font-medium text-teal-700">{formatCurrency(s.totalAmount)}</td>
                  </tr>
                ))}
                {!recentSales?.length && (
                  <tr>
                    <td colSpan={3} className="text-center py-6 text-muted-foreground">No recent sales found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
