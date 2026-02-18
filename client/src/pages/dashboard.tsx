import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { TrendingUp, DollarSign, Package, Receipt, Boxes, Warehouse, Wallet, BarChart3, AlertTriangle, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/header";
import { useAuth } from "@/components/auth-provider";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface InvoiceMetrics {
  totalSales: number;
  totalItems: number;
  invoiceCount: number;
  avgOrderValue: number;
  byBranch: {
    ALFANI1: { sales: number; count: number; items: number };
    ALFANI2: { sales: number; count: number; items: number };
  };
}

interface FinancialSummary {
  totalSafeBalanceUSD: number;
  totalSafeBalanceLYD: number;
  totalBankBalanceUSD: number;
  totalBankBalanceLYD: number;
  totalCustomerDebt: number;
  totalSupplierDebt: number;
  recentTransactions: Array<{ type: string; amount: number; date: string }>;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  branch: string;
  totalAmount: string;
  createdAt: string;
  items: Array<{ productName: string; quantity: number; unitPrice: string; totalPrice: string }>;
}

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isRTL = i18n.language === "ar";
  const isOwner = user?.role === 'owner';

  const { data: invoiceMetrics, isLoading: metricsLoading } = useQuery<InvoiceMetrics>({
    queryKey: ["/api/invoices/metrics"],
    queryFn: async () => {
      const response = await fetch("/api/invoices/metrics?branch=all", { credentials: 'include' });
      if (!response.ok) return { totalSales: 0, totalItems: 0, invoiceCount: 0, avgOrderValue: 0, byBranch: {} };
      return response.json();
    },
    enabled: isOwner,
  });

  const { data: financialSummary, isLoading: summaryLoading } = useQuery<FinancialSummary>({
    queryKey: ["/api/financial-summary"],
    enabled: isOwner,
  });

  const { data: productStats } = useQuery<{ total: number; active: number; lowStock: number; outOfStock: number }>({
    queryKey: ["/api/products/stats"],
    staleTime: 15000,
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
    enabled: isOwner,
  });

  const { data: expenses = [] } = useQuery<any[]>({
    queryKey: ["/api/expenses"],
    enabled: isOwner,
  });

  const totalProducts = productStats?.total || 0;
  const activeProducts = productStats?.active || 0;
  const lowStockCount = productStats?.lowStock || 0;
  const outOfStockCount = productStats?.outOfStock || 0;

  const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

  const recentInvoices = [...invoices]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const salesData = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(new Date(), i);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const monthSales = invoices
      .filter(inv => {
        const invDate = new Date(inv.createdAt);
        return isWithinInterval(invDate, { start: monthStart, end: monthEnd });
      })
      .reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    salesData.push({
      month: format(monthDate, 'MMM'),
      sales: parseFloat(monthSales.toFixed(2))
    });
  }

  const allMetricCards = [
    {
      id: "total-sales",
      label: t('totalSales') || "Total Sales",
      value: metricsLoading ? null : `${(invoiceMetrics?.totalSales || 0).toFixed(2)} LYD`,
      sub: t('allInvoices') || "All invoices",
      icon: DollarSign,
      color: "emerald",
      gradient: "from-emerald-500/10 to-emerald-600/5",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      valueColor: "text-emerald-700 dark:text-emerald-400",
      ownerOnly: true,
    },
    {
      id: "total-invoices",
      label: t('totalInvoices') || "Total Invoices",
      value: metricsLoading ? null : String(invoiceMetrics?.invoiceCount || 0),
      sub: t('allTime') || "All time",
      icon: Receipt,
      color: "blue",
      gradient: "from-blue-500/10 to-blue-600/5",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600 dark:text-blue-400",
      valueColor: "text-blue-700 dark:text-blue-400",
      ownerOnly: true,
    },
    {
      id: "total-products",
      label: t('totalProducts') || "Total Products",
      value: String(totalProducts),
      sub: `${activeProducts} ${t('active') || "active"}`,
      icon: Boxes,
      color: "violet",
      gradient: "from-violet-500/10 to-violet-600/5",
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-600 dark:text-violet-400",
      valueColor: "text-violet-700 dark:text-violet-400",
      ownerOnly: false,
    },
    {
      id: "items-sold",
      label: t('itemsSold') || "Items Sold",
      value: metricsLoading ? null : String(invoiceMetrics?.totalItems || 0),
      sub: t('allTime') || "All time",
      icon: Package,
      color: "amber",
      gradient: "from-amber-500/10 to-amber-600/5",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-600 dark:text-amber-400",
      valueColor: "text-amber-700 dark:text-amber-400",
      ownerOnly: true,
    },
  ];
  const metricCards = allMetricCards.filter(card => !card.ownerOnly || isOwner);

  return (
    <div className="flex-1 flex flex-col min-h-screen" dir={isRTL ? "rtl" : "ltr"}>
      <Header title={t('dashboard')} description={t('welcomeBack')} />

      <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 bg-background">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metricCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <Card key={card.id} className={`card-hover animate-fade-in stagger-${i + 1} overflow-hidden border-border/50`} data-testid={`card-${card.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</p>
                      {card.value === null ? (
                        <Skeleton className="h-8 w-24" />
                      ) : (
                        <p className={`text-2xl font-bold ${card.valueColor} tracking-tight`} data-testid={`text-${card.id}`}>
                          {card.value}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground/70">{card.sub}</p>
                    </div>
                    <div className={`w-11 h-11 ${card.iconBg} rounded-xl flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${card.iconColor}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {isOwner && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
            <Card className="card-hover border-border/50 overflow-hidden" data-testid="card-safe-balance">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('totalSafeBalance') || "Safe Balance"}</p>
                    {summaryLoading ? (
                      <Skeleton className="h-8 w-24" />
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-foreground tracking-tight" data-testid="text-safe-balance">
                          {(financialSummary?.totalSafeBalanceUSD || 0).toFixed(2)} LYD
                        </p>
                        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                          {(financialSummary?.totalSafeBalanceLYD || 0).toFixed(2)} LYD
                        </p>
                      </>
                    )}
                  </div>
                  <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-hover border-border/50 overflow-hidden" data-testid="card-avg-order">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('avgOrderValue') || "Avg Order Value"}</p>
                    {metricsLoading ? (
                      <Skeleton className="h-8 w-24" />
                    ) : (
                      <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-400 tracking-tight" data-testid="text-avg-order">
                        {(invoiceMetrics?.avgOrderValue || 0).toFixed(2)} LYD
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground/70">{t('perInvoice') || "Per invoice"}</p>
                  </div>
                  <div className="w-11 h-11 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-hover border-border/50 overflow-hidden" data-testid="card-total-expenses">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('totalExpenses') || "Total Expenses"}</p>
                    <p className="text-2xl font-bold text-red-700 dark:text-red-400 tracking-tight" data-testid="text-total-expenses">
                      {totalExpenses.toFixed(2)} LYD
                    </p>
                    <p className="text-[11px] text-muted-foreground/70">{expenses.length} {t('entries') || "entries"}</p>
                  </div>
                  <div className="w-11 h-11 bg-red-500/10 rounded-xl flex items-center justify-center">
                    <ArrowUpRight className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {isOwner && invoiceMetrics?.byBranch && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
            <Card className="card-hover border-border/50 overflow-hidden relative" data-testid="card-branch-alfani1">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600" />
              <CardHeader className="pb-3 pt-5">
                <CardTitle className="text-base font-semibold flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-sm shadow-blue-500/50"></div>
                  ALFANI 1
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-5">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{t('totalSales') || "Sales"}</p>
                    <p className="text-lg font-bold text-blue-700 dark:text-blue-400 mt-0.5">{(invoiceMetrics.byBranch.ALFANI1?.sales || 0).toFixed(2)} LYD</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{t('totalInvoices') || "Invoices"}</p>
                    <p className="text-lg font-bold text-foreground mt-0.5">{invoiceMetrics.byBranch.ALFANI1?.count || 0}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{t('itemsSold') || "Items"}</p>
                    <p className="text-lg font-bold text-foreground mt-0.5">{invoiceMetrics.byBranch.ALFANI1?.items || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-hover border-border/50 overflow-hidden relative" data-testid="card-branch-alfani2">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-600" />
              <CardHeader className="pb-3 pt-5">
                <CardTitle className="text-base font-semibold flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-sm shadow-emerald-500/50"></div>
                  ALFANI 2
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-5">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{t('totalSales') || "Sales"}</p>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{(invoiceMetrics.byBranch.ALFANI2?.sales || 0).toFixed(2)} LYD</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{t('totalInvoices') || "Invoices"}</p>
                    <p className="text-lg font-bold text-foreground mt-0.5">{invoiceMetrics.byBranch.ALFANI2?.count || 0}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{t('itemsSold') || "Items"}</p>
                    <p className="text-lg font-bold text-foreground mt-0.5">{invoiceMetrics.byBranch.ALFANI2?.items || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {isOwner && (
          <Card className="border-border/50 animate-fade-in" data-testid="card-sales-chart">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">{t('salesTrend') || "Sales Trend"}</CardTitle>
              <CardDescription className="text-xs">{t('last6Months') || "Last 6 months"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value) => [`${value} LYD`, t('totalSales') || 'Sales']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="sales" fill="hsl(220, 70%, 50%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          )}

          {(lowStockCount > 0 || outOfStockCount > 0) ? (
            <Card className="border-border/50 animate-fade-in" data-testid="card-stock-alerts">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  {t('stockAlerts') || "Stock Alerts"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {lowStockCount} {t('lowStock') || "low stock"}, {outOfStockCount} {t('outOfStock') || "out of stock"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {outOfStockCount > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-800/30" data-testid="alert-outofstock-summary">
                      <div>
                        <p className="font-medium text-sm">{t('outOfStock') || "Out of Stock"}</p>
                        <p className="text-[11px] text-muted-foreground">{t('productsNeedRestock') || "Products need restocking"}</p>
                      </div>
                      <Badge variant="destructive" className="text-sm font-semibold">{outOfStockCount}</Badge>
                    </div>
                  )}
                  {lowStockCount > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/30" data-testid="alert-lowstock-summary">
                      <div>
                        <p className="font-medium text-sm">{t('lowStock') || "Low Stock"}</p>
                        <p className="text-[11px] text-muted-foreground">{t('productsBelowThreshold') || "Products below threshold"}</p>
                      </div>
                      <Badge variant="outline" className="text-sm font-semibold text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                        {lowStockCount}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : isOwner ? (
            <Card className="border-border/50 animate-fade-in" data-testid="card-recent-invoices">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">{t('recentInvoices') || "Recent Invoices"}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-primary hover:text-primary/80 font-semibold h-8"
                    onClick={() => setLocation("/sales")}
                    data-testid="button-view-all-invoices"
                  >
                    {t('viewAll') || "View All"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentInvoices.length === 0 ? (
                    <div className="text-center py-10">
                      <Receipt className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">{t('noInvoicesYet') || "No invoices yet"}</p>
                    </div>
                  ) : (
                    recentInvoices.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-all duration-150 cursor-pointer" data-testid={`invoice-row-${inv.id}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Receipt className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{inv.invoiceNumber}</p>
                            <p className="text-[11px] text-muted-foreground">{inv.customerName}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">{Number(inv.totalAmount).toFixed(2)} LYD</p>
                          <Badge variant="outline" className="text-[10px] font-medium">{inv.branch}</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card className="border-border/50 animate-fade-in" data-testid="card-quick-actions">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{t('quickActions') || "Quick Actions"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`grid grid-cols-2 ${isOwner ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3`}>
              <Button
                className="h-auto py-5 flex-col gap-2 bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-900 shadow-md shadow-amber-500/20 transition-all duration-200"
                data-testid="button-new-invoice"
                onClick={() => setLocation("/invoice")}
              >
                <Receipt className="w-5 h-5" />
                <span className="font-semibold text-xs">{t('newInvoice') || "New Invoice"}</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-5 flex-col gap-2 border-border/50 hover:bg-muted/50 transition-all duration-200"
                data-testid="button-go-products"
                onClick={() => setLocation("/products")}
              >
                <Boxes className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                <span className="font-semibold text-xs">{t('products') || "Products"}</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-5 flex-col gap-2 border-border/50 hover:bg-muted/50 transition-all duration-200"
                data-testid="button-go-inventory"
                onClick={() => setLocation("/inventory")}
              >
                <Warehouse className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span className="font-semibold text-xs">{t('inventory') || "Inventory"}</span>
              </Button>

              {isOwner && (
                <Button
                  variant="outline"
                  className="h-auto py-5 flex-col gap-2 border-border/50 hover:bg-muted/50 transition-all duration-200"
                  data-testid="button-go-finance"
                  onClick={() => setLocation("/finance")}
                >
                  <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-semibold text-xs">{t('finance') || "Finance"}</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
