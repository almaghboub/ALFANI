import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DollarSign, ShoppingCart, BarChart3, Package, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/header";
import { useTranslation } from "react-i18next";

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

export default function Profits() {
  const { t, i18n } = useTranslation();
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const isRTL = i18n.language === 'ar';

  const { data: metrics, isLoading } = useQuery<InvoiceMetrics>({
    queryKey: ["/api/invoices/metrics", branchFilter],
    queryFn: async () => {
      const response = await fetch(`/api/invoices/metrics?branch=${branchFilter}`, { credentials: 'include' });
      return response.json();
    },
  });

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  return (
    <div className="min-h-screen bg-background">
      <Header title={t("profitReports")} description={t("viewSalesMetrics")} />
      
      <div className="p-6 space-y-6">
        <Tabs defaultValue="overview" className="w-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <TabsList>
              <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
              <TabsTrigger value="byBranch">{t("byBranch")}</TabsTrigger>
            </TabsList>
            
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-48" data-testid="select-branch-filter">
                <SelectValue placeholder={t("selectBranch")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allBranches")}</SelectItem>
                <SelectItem value="ALFANI1">{t("ALFANI1")}</SelectItem>
                <SelectItem value="ALFANI2">{t("ALFANI2")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t("totalSales")}</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {isLoading ? "..." : formatCurrency(metrics?.totalSales || 0)}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t("totalInvoices")}</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {isLoading ? "..." : metrics?.invoiceCount || 0}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t("itemsSold")}</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {isLoading ? "..." : metrics?.totalItems || 0}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t("avgOrderValue")}</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {isLoading ? "..." : formatCurrency(metrics?.avgOrderValue || 0)}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="byBranch" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-2 border-blue-200 dark:border-blue-800">
                <CardHeader className="bg-blue-50 dark:bg-blue-900/20">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    {t("ALFANI1")}
                  </CardTitle>
                  <CardDescription>{t("branchPerformance")}</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{t("totalSales")}</span>
                      <span className="text-xl font-bold text-green-600">
                        {formatCurrency(metrics?.byBranch?.ALFANI1?.sales || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{t("invoices")}</span>
                      <span className="text-xl font-bold">
                        {metrics?.byBranch?.ALFANI1?.count || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{t("itemsSold")}</span>
                      <span className="text-xl font-bold">
                        {metrics?.byBranch?.ALFANI1?.items || 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-2 border-purple-200 dark:border-purple-800">
                <CardHeader className="bg-purple-50 dark:bg-purple-900/20">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                    {t("ALFANI2")}
                  </CardTitle>
                  <CardDescription>{t("branchPerformance")}</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{t("totalSales")}</span>
                      <span className="text-xl font-bold text-green-600">
                        {formatCurrency(metrics?.byBranch?.ALFANI2?.sales || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{t("invoices")}</span>
                      <span className="text-xl font-bold">
                        {metrics?.byBranch?.ALFANI2?.count || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{t("itemsSold")}</span>
                      <span className="text-xl font-bold">
                        {metrics?.byBranch?.ALFANI2?.items || 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
