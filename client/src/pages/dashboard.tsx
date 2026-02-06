import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { TrendingUp, DollarSign, Package, Receipt, Plus, Boxes, Warehouse, Wallet, BarChart3, AlertTriangle, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/header";
import { apiRequest } from "@/lib/queryClient";
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

interface ProductWithInventory {
  id: string;
  name: string;
  sku: string;
  price: string;
  costPrice: string;
  isActive: boolean;
  branchInventory?: Array<{ branch: string; quantity: number; lowStockThreshold: number }>;
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

  const { data: invoiceMetrics, isLoading: metricsLoading } = useQuery<InvoiceMetrics>({
    queryKey: ["/api/invoices/metrics"],
    queryFn: async () => {
      const response = await fetch("/api/invoices/metrics?branch=all", { credentials: 'include' });
      return response.json();
    },
  });

  const { data: financialSummary, isLoading: summaryLoading } = useQuery<FinancialSummary>({
    queryKey: ["/api/financial-summary"],
  });

  const { data: products = [] } = useQuery<ProductWithInventory[]>({
    queryKey: ["/api/products/with-inventory"],
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: expenses = [] } = useQuery<any[]>({
    queryKey: ["/api/expenses"],
  });

  const totalProducts = products.length;
  const activeProducts = products.filter(p => p.isActive).length;
  const lowStockProducts = products.filter(p => {
    const totalQty = p.branchInventory?.reduce((sum, bi) => sum + bi.quantity, 0) || 0;
    const threshold = p.branchInventory?.[0]?.lowStockThreshold || 5;
    return totalQty > 0 && totalQty <= threshold;
  });
  const outOfStockProducts = products.filter(p => {
    const totalQty = p.branchInventory?.reduce((sum, bi) => sum + bi.quantity, 0) || 0;
    return totalQty === 0;
  });

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

  return (
    <div className="flex-1 flex flex-col min-h-screen" dir={isRTL ? "rtl" : "ltr"}>
      <Header
        title={t('dashboard')}
        description={t('welcomeBack')}
      />

      <div className="flex-1 p-6 space-y-6 bg-muted/20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="card-total-sales">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('totalSales') || "Total Sales"}</p>
                  {metricsLoading ? (
                    <Skeleton className="h-8 w-24 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-green-600" data-testid="text-total-sales">
                      ${(invoiceMetrics?.totalSales || 0).toFixed(2)}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{t('allInvoices') || "All invoices"}</p>
                </div>
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-total-invoices">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('totalInvoices') || "Total Invoices"}</p>
                  {metricsLoading ? (
                    <Skeleton className="h-8 w-24 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-blue-600" data-testid="text-total-invoices">
                      {invoiceMetrics?.invoiceCount || 0}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{t('allTime') || "All time"}</p>
                </div>
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-total-products">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('totalProducts') || "Total Products"}</p>
                  <p className="text-2xl font-bold text-purple-600" data-testid="text-total-products">
                    {totalProducts}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{activeProducts} {t('active') || "active"}</p>
                </div>
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <Boxes className="w-5 h-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-items-sold">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('itemsSold') || "Items Sold"}</p>
                  {metricsLoading ? (
                    <Skeleton className="h-8 w-24 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-orange-600" data-testid="text-items-sold">
                      {invoiceMetrics?.totalItems || 0}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{t('allTime') || "All time"}</p>
                </div>
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {user?.role === 'owner' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card data-testid="card-safe-balance">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('totalSafeBalance') || "Safe Balance"}</p>
                    {summaryLoading ? (
                      <Skeleton className="h-8 w-24 mt-1" />
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-primary" data-testid="text-safe-balance">
                          ${(financialSummary?.totalSafeBalanceUSD || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-blue-600 font-semibold">
                          {(financialSummary?.totalSafeBalanceLYD || 0).toFixed(2)} LYD
                        </p>
                      </>
                    )}
                  </div>
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-avg-order">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('avgOrderValue') || "Avg Order Value"}</p>
                    {metricsLoading ? (
                      <Skeleton className="h-8 w-24 mt-1" />
                    ) : (
                      <p className="text-2xl font-bold text-cyan-600" data-testid="text-avg-order">
                        ${(invoiceMetrics?.avgOrderValue || 0).toFixed(2)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{t('perInvoice') || "Per invoice"}</p>
                  </div>
                  <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-cyan-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-total-expenses">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('totalExpenses') || "Total Expenses"}</p>
                    <p className="text-2xl font-bold text-red-600" data-testid="text-total-expenses">
                      ${totalExpenses.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{expenses.length} {t('entries') || "entries"}</p>
                  </div>
                  <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                    <ArrowUpRight className="w-5 h-5 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {user?.role === 'owner' && invoiceMetrics?.byBranch && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-2 border-blue-200 dark:border-blue-800" data-testid="card-branch-alfani1">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  ALFANI 1
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('totalSales') || "Sales"}</p>
                    <p className="text-lg font-bold text-blue-600">${(invoiceMetrics.byBranch.ALFANI1?.sales || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('totalInvoices') || "Invoices"}</p>
                    <p className="text-lg font-bold">{invoiceMetrics.byBranch.ALFANI1?.count || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('itemsSold') || "Items"}</p>
                    <p className="text-lg font-bold">{invoiceMetrics.byBranch.ALFANI1?.items || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-emerald-200 dark:border-emerald-800" data-testid="card-branch-alfani2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                  ALFANI 2
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('totalSales') || "Sales"}</p>
                    <p className="text-lg font-bold text-emerald-600">${(invoiceMetrics.byBranch.ALFANI2?.sales || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('totalInvoices') || "Invoices"}</p>
                    <p className="text-lg font-bold">{invoiceMetrics.byBranch.ALFANI2?.count || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('itemsSold') || "Items"}</p>
                    <p className="text-lg font-bold">{invoiceMetrics.byBranch.ALFANI2?.items || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="card-sales-chart">
            <CardHeader>
              <CardTitle>{t('salesTrend') || "Sales Trend"}</CardTitle>
              <CardDescription>{t('last6Months') || "Last 6 months"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) => [`$${value}`, t('totalSales') || 'Sales']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                    />
                    <Bar dataKey="sales" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {lowStockProducts.length > 0 || outOfStockProducts.length > 0 ? (
            <Card data-testid="card-stock-alerts">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  {t('stockAlerts') || "Stock Alerts"}
                </CardTitle>
                <CardDescription>
                  {lowStockProducts.length} {t('lowStock') || "low stock"}, {outOfStockProducts.length} {t('outOfStock') || "out of stock"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {outOfStockProducts.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800" data-testid={`alert-outofstock-${p.id}`}>
                      <div>
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.sku}</p>
                      </div>
                      <Badge variant="destructive">{t('outOfStock') || "Out of Stock"}</Badge>
                    </div>
                  ))}
                  {lowStockProducts.map(p => {
                    const qty = p.branchInventory?.reduce((s, bi) => s + bi.quantity, 0) || 0;
                    return (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800" data-testid={`alert-lowstock-${p.id}`}>
                        <div>
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.sku}</p>
                        </div>
                        <Badge variant="outline" className="text-amber-600 border-amber-400">
                          {qty} {t('remaining') || "remaining"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card data-testid="card-recent-invoices">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('recentInvoices') || "Recent Invoices"}</CardTitle>
                  <Button
                    variant="link"
                    className="text-primary hover:text-primary/80 text-sm font-medium"
                    onClick={() => setLocation("/sales")}
                    data-testid="button-view-all-invoices"
                  >
                    {t('viewAll') || "View All"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentInvoices.length === 0 ? (
                    <div className="text-center py-8">
                      <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">{t('noInvoicesYet') || "No invoices yet"}</p>
                    </div>
                  ) : (
                    recentInvoices.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors" data-testid={`invoice-row-${inv.id}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Receipt className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{inv.invoiceNumber}</p>
                            <p className="text-sm text-muted-foreground">{inv.customerName}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">${Number(inv.totalAmount).toFixed(2)}</p>
                          <Badge variant="outline" className="text-xs">{inv.branch}</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {user?.role !== 'shipping_staff' && (
          <Card data-testid="card-quick-actions">
            <CardHeader>
              <CardTitle>{t('quickActions') || "Quick Actions"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button
                  className="p-4 h-auto flex-col"
                  data-testid="button-new-invoice"
                  onClick={() => setLocation("/invoice")}
                >
                  <Receipt className="w-6 h-6 mb-2" />
                  <span className="font-medium text-sm">{t('newInvoice') || "New Invoice"}</span>
                </Button>

                <Button
                  variant="secondary"
                  className="p-4 h-auto flex-col"
                  data-testid="button-go-products"
                  onClick={() => setLocation("/products")}
                >
                  <Boxes className="w-6 h-6 mb-2" />
                  <span className="font-medium text-sm">{t('products') || "Products"}</span>
                </Button>

                <Button
                  variant="outline"
                  className="p-4 h-auto flex-col"
                  data-testid="button-go-inventory"
                  onClick={() => setLocation("/inventory")}
                >
                  <Warehouse className="w-6 h-6 mb-2" />
                  <span className="font-medium text-sm">{t('inventory') || "Inventory"}</span>
                </Button>

                {user?.role === 'owner' && (
                  <Button
                    variant="outline"
                    className="p-4 h-auto flex-col"
                    data-testid="button-go-finance"
                    onClick={() => setLocation("/finance")}
                  >
                    <Wallet className="w-6 h-6 mb-2" />
                    <span className="font-medium text-sm">{t('finance') || "Finance"}</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
