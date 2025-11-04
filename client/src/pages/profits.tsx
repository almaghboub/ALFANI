import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, DollarSign, Calculator, FileText, Printer, Filter, Package, ShoppingCart, BarChart3, Calendar, Percent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Header } from "@/components/header";
import { analyticsApi } from "@/lib/api";
import { SalesReport } from "@/components/sales-report";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useLydExchangeRate } from "@/hooks/use-lyd-exchange-rate";
import type { OrderWithCustomer } from "@shared/schema";

type TimeRange = 'daily' | 'weekly' | 'monthly';

interface PerformanceMetrics {
  totalOrders: number;
  totalSales: string;
  totalProfit: string;
  discountedOrders: number;
  avgOrderValue: string;
  avgProfitPerOrder: string;
  avgExchangeRate: string;
  orderGrowth: string;
  salesGrowth: string;
  profitGrowth: string;
}

interface PerformanceData {
  range: string;
  period: {
    start: string;
    end: string;
  };
  previousPeriod: {
    start: string;
    end: string;
  };
  metrics: PerformanceMetrics;
  previousMetrics: {
    totalOrders: number;
    totalSales: string;
    totalProfit: string;
  };
}

export default function Profits() {
  const { t, i18n } = useTranslation();
  const { exchangeRate, convertToLYD } = useLydExchangeRate();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<"profit" | "financial">("profit");
  const [reportData, setReportData] = useState<any>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('daily');
  const [performanceCountryFilters, setPerformanceCountryFilters] = useState<string[]>([]);
  const [performanceDateFrom, setPerformanceDateFrom] = useState<string>('');
  const [performanceDateTo, setPerformanceDateTo] = useState<string>('');
  const [isPerformanceFilterOpen, setIsPerformanceFilterOpen] = useState(false);
  const { toast } = useToast();
  const currency = exchangeRate > 0 ? "LYD" : "USD";
  const isRTL = i18n.language === 'ar';

  const { data: orders = [], isLoading: isLoadingOrders } = useQuery({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/orders");
      return response.json() as Promise<OrderWithCustomer[]>;
    },
  });

  const { data: shippingCountries = [] } = useQuery({
    queryKey: ["/api/shipping-countries"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/shipping-countries");
      return response.json() as Promise<string[]>;
    },
  });

  const { data: settings = [] } = useQuery<Array<{ id: string; key: string; value: string }>>({
    queryKey: ["/api/settings"],
  });

  const lydExchangeRate = parseFloat(settings.find(s => s.key === 'lyd_exchange_rate')?.value || '0');
  const lydPurchaseExchangeRate = parseFloat(settings.find(s => s.key === 'lyd_purchase_exchange_rate')?.value || '0');

  const toggleCountryFilter = (country: string) => {
    setPerformanceCountryFilters((prev: string[]) =>
      prev.includes(country)
        ? prev.filter((c: string) => c !== country)
        : [...prev, country]
    );
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Country filter
      const matchesCountry = performanceCountryFilters.length === 0 || performanceCountryFilters.includes(order.shippingCountry || "");
      
      // Date range filter
      let matchesDateRange = true;
      if (performanceDateFrom || performanceDateTo) {
        const orderDate = new Date(order.createdAt);
        if (performanceDateFrom) {
          const fromDate = new Date(performanceDateFrom);
          matchesDateRange = matchesDateRange && orderDate >= fromDate;
        }
        if (performanceDateTo) {
          const toDate = new Date(performanceDateTo);
          toDate.setHours(23, 59, 59, 999); // Include the entire end date
          matchesDateRange = matchesDateRange && orderDate <= toDate;
        }
      }
      
      return matchesCountry && matchesDateRange;
    });
  }, [orders, performanceCountryFilters, performanceDateFrom, performanceDateTo]);

  const metrics = useMemo(() => {
    const orderCount = filteredOrders.length;
    const totalRevenueUSD = filteredOrders.reduce((sum, order) => sum + parseFloat(order.totalAmount), 0);
    const totalItemsProfitUSD = filteredOrders.reduce((sum, order) => sum + parseFloat(order.itemsProfit || "0"), 0);
    const totalShippingProfitUSD = filteredOrders.reduce((sum, order) => sum + parseFloat(order.shippingProfit || "0"), 0);
    const totalProfitUSD = filteredOrders.reduce((sum, order) => sum + parseFloat(order.totalProfit || "0"), 0);
    const averageOrderValueUSD = orderCount > 0 ? totalRevenueUSD / orderCount : 0;
    
    // Calculate exchange rate profit in LYD using PER-ORDER exchange rates
    const exchangeRateProfitLYD = filteredOrders.reduce((sum, order) => {
      const orderSaleRate = parseFloat(order.lydExchangeRate || "0");
      const orderPurchaseRate = parseFloat(order.lydPurchaseExchangeRate || "0");
      const orderTotal = parseFloat(order.totalAmount || "0");
      
      // Calculate exchange profit for this order if both rates exist
      if (orderSaleRate > 0 && orderPurchaseRate > 0) {
        return sum + ((orderSaleRate - orderPurchaseRate) * orderTotal);
      }
      return sum;
    }, 0);
    
    // Convert to display currency
    const totalRevenue = exchangeRate > 0 ? parseFloat(convertToLYD(totalRevenueUSD)) : totalRevenueUSD;
    const totalItemsProfit = exchangeRate > 0 ? parseFloat(convertToLYD(totalItemsProfitUSD)) : totalItemsProfitUSD;
    const totalShippingProfit = exchangeRate > 0 ? parseFloat(convertToLYD(totalShippingProfitUSD)) : totalShippingProfitUSD;
    const totalProfit = exchangeRate > 0 ? parseFloat(convertToLYD(totalProfitUSD)) : totalProfitUSD;
    
    // Exchange rate profit is ONLY added when viewing in LYD (since it's calculated in LYD)
    // When viewing in USD, exchangeRateProfit is not applicable
    const exchangeRateProfit = (exchangeRate > 0) ? exchangeRateProfitLYD : 0;
    const totalProfitWithExchange = totalProfit + exchangeRateProfit; // Both in same currency now (LYD or USD=0)
    
    const averageOrderValue = exchangeRate > 0 ? parseFloat(convertToLYD(averageOrderValueUSD)) : averageOrderValueUSD;
    const profitMargin = totalRevenue > 0 ? (totalProfitWithExchange / totalRevenue) * 100 : 0;

    return {
      orderCount,
      totalRevenue,
      totalItemsProfit,
      totalShippingProfit,
      exchangeRateProfit,
      totalProfit,
      totalProfitWithExchange,
      averageOrderValue,
      profitMargin,
    };
  }, [filteredOrders, exchangeRate, convertToLYD, lydExchangeRate, lydPurchaseExchangeRate]);

  const isLoading = isLoadingOrders;

  const generateReport = async (reportType: "profit" | "financial") => {
    setIsGeneratingReport(true);
    setSelectedReportType(reportType);
    
    try {
      // Fetch detailed data for reports
      const requests = [
        apiRequest("GET", "/api/orders"),
        apiRequest("GET", "/api/customers")
      ];
      
      const responses = await Promise.all(requests);
      
      const orders = await responses[0].json();
      const customers = await responses[1].json();
      
      // Create customer lookup map
      const customerMap = customers.reduce((acc: any, customer: any) => {
        acc[customer.id] = customer;
        return acc;
      }, {});
      
      // Process orders data
      const orderSummaries = orders.map((order: any) => {
        const customer = customerMap[order.customerId];
        return {
          id: order.id,
          orderNumber: order.orderNumber,
          shippingCode: customer?.shippingCode || order.orderNumber,
          customerName: customer ? `${customer.firstName} ${customer.lastName}` : t('unknown'),
          totalAmount: order.totalAmount,
          profit: order.totalProfit || order.profit || "0",
          itemsProfit: order.itemsProfit || "0",
          shippingProfit: order.shippingProfit || "0",
          country: customer?.country || t('unknown'),
          createdAt: order.createdAt
        };
      });
      
      // Calculate totals in USD
      const totalRevenueUSD = orders.reduce((sum: number, order: any) => sum + parseFloat(order.totalAmount), 0);
      const totalProfitUSD = orders.reduce((sum: number, order: any) => sum + parseFloat(order.totalProfit || order.profit || "0"), 0);
      const totalItemsProfitUSD = orders.reduce((sum: number, order: any) => sum + parseFloat(order.itemsProfit || "0"), 0);
      const totalShippingProfitUSD = orders.reduce((sum: number, order: any) => sum + parseFloat(order.shippingProfit || "0"), 0);
      
      // Calculate exchange rate profit in LYD using PER-ORDER exchange rates
      const exchangeRateProfitLYD = orders.reduce((sum: number, order: any) => {
        const orderSaleRate = parseFloat(order.lydExchangeRate || "0");
        const orderPurchaseRate = parseFloat(order.lydPurchaseExchangeRate || "0");
        const orderTotal = parseFloat(order.total || order.totalAmount || "0");
        
        // Calculate exchange profit for this order if both rates exist
        if (orderSaleRate > 0 && orderPurchaseRate > 0) {
          return sum + ((orderSaleRate - orderPurchaseRate) * orderTotal);
        }
        return sum;
      }, 0);
      
      // Convert to display currency (LYD or USD)
      const totalRevenue = exchangeRate > 0 ? totalRevenueUSD * exchangeRate : totalRevenueUSD;
      const totalProfit = exchangeRate > 0 ? totalProfitUSD * exchangeRate : totalProfitUSD;
      const totalItemsProfit = exchangeRate > 0 ? totalItemsProfitUSD * exchangeRate : totalItemsProfitUSD;
      const totalShippingProfit = exchangeRate > 0 ? totalShippingProfitUSD * exchangeRate : totalShippingProfitUSD;
      
      // Exchange rate profit is ONLY added when viewing in LYD (since it's calculated in LYD)
      const exchangeRateProfit = (exchangeRate > 0) ? exchangeRateProfitLYD : 0;
      const totalProfitWithExchange = totalProfit + exchangeRateProfit; // Both in same currency now
      
      const profitMargin = totalRevenue > 0 ? (totalProfitWithExchange / totalRevenue) * 100 : 0;
      
      const reportData = {
        totalRevenue,
        totalProfit,
        totalItemsProfit,
        totalShippingProfit,
        exchangeRateProfit,
        totalProfitWithExchange,
        profitMargin,
        orderCount: orders.length,
        orders: reportType === "profit" ? orderSummaries : undefined,
        periodStart: orders.length > 0 ? orders[orders.length - 1].createdAt : undefined,
        periodEnd: orders.length > 0 ? orders[0].createdAt : undefined,
        exchangeRate,
        currency,
        saleExchangeRate: lydExchangeRate,
        purchaseExchangeRate: lydPurchaseExchangeRate
      };
      
      setReportData(reportData);
      setIsReportModalOpen(true);
      
    } catch (error) {
      toast({
        title: t('errorGeneratingReport'),
        description: t('failedToFetchReportData'),
        variant: "destructive",
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatPerformanceDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatPerformanceCurrency = (amount: string) => {
    return `$${parseFloat(amount).toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatGrowth = (growth: string) => {
    const value = parseFloat(growth);
    const isPositive = value >= 0;
    return {
      value: Math.abs(value),
      isPositive,
      text: `${isPositive ? '+' : '-'}${Math.abs(value).toFixed(2)}%`,
    };
  };

  return (
    <div className="flex-1 flex flex-col">
      <Header 
        title={t('profitReports')} 
        description={t('profitReportsDescription')} 
      />
      
      <div className="flex-1 p-6 space-y-8 bg-gradient-to-br from-background via-background to-muted/20">
        {/* Header Section with Filter */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {t('profitMetrics')}
            </h2>
            <p className="text-muted-foreground mt-1">{t('basedOnOrders', { count: filteredOrders.length })}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Unified Filter Button */}
            <Popover open={isPerformanceFilterOpen} onOpenChange={setIsPerformanceFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="shadow-sm hover:shadow-md transition-shadow" data-testid="button-filter-profits">
                  <Filter className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                  {t("filter")}
                  {(performanceCountryFilters.length > 0 || performanceDateFrom || performanceDateTo) && (
                    <Badge variant="default" className="ltr:ml-2 rtl:mr-2">
                      {performanceCountryFilters.length + (performanceDateFrom || performanceDateTo ? 1 : 0)}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" data-testid="popover-filter-profits">
                <div className="space-y-4">
                  {/* Country Filter */}
                  <div>
                    <h4 className="font-semibold mb-3">{t("filterByCountry")}</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {shippingCountries.length > 0 ? (
                        shippingCountries.map((country) => (
                          <div key={country} className="flex items-center space-x-2 rtl:space-x-reverse">
                            <Checkbox
                              id={`filter-${country}`}
                              checked={performanceCountryFilters.includes(country)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setPerformanceCountryFilters(prev => [...prev, country]);
                                } else {
                                  setPerformanceCountryFilters(prev => prev.filter(c => c !== country));
                                }
                              }}
                              data-testid={`checkbox-filter-${country}`}
                            />
                            <Label htmlFor={`filter-${country}`} className="cursor-pointer flex-1">
                              {country}
                            </Label>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">{t("noCountriesAvailable")}</p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Date Range Filter */}
                  <div>
                    <h4 className="font-semibold mb-3">{t("filterByDate")}</h4>
                    <div className="space-y-2">
                      <div>
                        <Label htmlFor="date-from" className="text-sm">{t("from")}</Label>
                        <input
                          id="date-from"
                          type="date"
                          value={performanceDateFrom}
                          onChange={(e) => setPerformanceDateFrom(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                          data-testid="input-date-from"
                        />
                      </div>
                      <div>
                        <Label htmlFor="date-to" className="text-sm">{t("to")}</Label>
                        <input
                          id="date-to"
                          type="date"
                          value={performanceDateTo}
                          onChange={(e) => setPerformanceDateTo(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                          data-testid="input-date-to"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPerformanceCountryFilters([]);
                        setPerformanceDateFrom('');
                        setPerformanceDateTo('');
                      }}
                      data-testid="button-clear-filters"
                    >
                      {t("clearFilters")}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setIsPerformanceFilterOpen(false)}
                      data-testid="button-apply-filters"
                    >
                      {t("apply")}
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Time Range Selector */}
            <div className="w-[200px]">
              <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
                <SelectTrigger data-testid="select-time-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{isRTL ? 'يومي' : 'Daily'}</SelectItem>
                  <SelectItem value="weekly">{isRTL ? 'أسبوعي' : 'Weekly'}</SelectItem>
                  <SelectItem value="monthly">{isRTL ? 'شهري' : 'Monthly'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Key Metrics - First Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card data-testid="card-order-count" className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{t('numberOfOrders')}</p>
                  {isLoading ? (
                    <Skeleton className="h-10 w-28 mt-2" />
                  ) : (
                    <p className="text-4xl font-extrabold text-blue-600 dark:text-blue-400 mt-2" data-testid="text-order-count">
                      {metrics.orderCount}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">{t('totalOrders')}</p>
                </div>
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <ShoppingCart className="w-8 h-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-average-order-value" className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{t('averageOrderValue')}</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-24 mt-1" />
                  ) : (
                    <p className="text-3xl font-bold text-blue-600" data-testid="text-average-order-value">
                      {metrics.averageOrderValue.toFixed(2)} {currency}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">{t('perOrder')}</p>
                </div>
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Calculator className="w-8 h-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-total-revenue" className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-background">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{t('totalRevenue')}</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-24 mt-1" />
                  ) : (
                    <p className="text-3xl font-bold text-blue-600" data-testid="text-total-revenue">
                      {metrics.totalRevenue.toFixed(2)} {currency}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">{t('fromAllOrders')}</p>
                </div>
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <DollarSign className="w-8 h-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profit Breakdown - Second Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card data-testid="card-items-profit">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('profitFromOrders')}</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-24 mt-1" />
                  ) : (
                    <p className="text-3xl font-bold text-blue-600" data-testid="text-items-profit">
                      {metrics.totalItemsProfit.toFixed(2)} {currency}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{t('orderValueMinusCost')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-shipping-profit">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('profitFromShipping')}</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-24 mt-1" />
                  ) : (
                    <p className="text-3xl font-bold text-blue-600" data-testid="text-shipping-profit">
                      {metrics.totalShippingProfit.toFixed(2)} {currency}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{t('shippingFeeMinusCost')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-total-profit">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('totalProfit')}</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-24 mt-1" />
                  ) : (
                    <p className="text-3xl font-bold text-green-600" data-testid="text-total-profit">
                      {metrics.totalProfit.toFixed(2)} {currency}
                    </p>
                  )}
                </div>
                  <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl flex items-center justify-center shadow-2xl">
                    <DollarSign className="w-10 h-10 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Profit Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="card-profit-trend">
            <CardHeader>
              <CardTitle>{t('profitTrendAnalysis')}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <Skeleton className="h-full w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('totalProfit')}</p>
                      <p className="text-2xl font-bold text-green-600">
                        {currency} {metrics.totalProfit.toFixed(2)}
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-600" />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-blue-600" />
                        <span className="text-sm">{t('profitFromOrders')}</span>
                      </div>
                      <span className="font-semibold text-blue-600">
                        {currency} {metrics.totalItemsProfit.toFixed(2)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-orange-600" />
                        <span className="text-sm">{t('profitFromShipping')}</span>
                      </div>
                      <span className="font-semibold text-orange-600">
                        {currency} {metrics.totalShippingProfit.toFixed(2)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-primary/5">
                      <div className="flex items-center gap-2">
                        <Percent className="w-5 h-5 text-primary" />
                        <span className="text-sm font-medium">{t('profitMargin')}</span>
                      </div>
                      <span className="font-bold text-primary">
                        {metrics.profitMargin.toFixed(1)}%
                      </span>
                    </div>
                    
                    <div className="pt-2 text-center">
                      <p className="text-xs text-muted-foreground">
                        {t('basedOnOrders', { count: metrics.orderCount })}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Report Actions */}
        <Card className="border-0 shadow-xl bg-gradient-to-br from-slate-50 to-white dark:from-slate-950/50 dark:to-background" data-testid="card-report-actions">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/60 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">{t('generateReports')}</CardTitle>
                <p className="text-sm text-muted-foreground">Export detailed analytics reports</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                className="h-auto p-6 flex-col gap-3 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all duration-300" 
                onClick={() => generateReport("profit")}
                disabled={isGeneratingReport}
                data-testid="button-profit-report"
              >
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <span className="font-semibold text-lg text-white">{t('profitReportTitle')}</span>
                <span className="text-xs text-blue-100">{t('orderWiseProfitAnalysis')}</span>
              </Button>

<Button 
                variant="secondary" 
                className="h-auto p-4 flex-col" 
                onClick={() => generateReport("financial")}
                disabled={isGeneratingReport}
                data-testid="button-financial-summary"
              >
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <span className="font-semibold text-lg">{t('financialSummaryTitle')}</span>
                <span className="text-xs text-muted-foreground">{t('completeFinancialOverview')}</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Financial Details */}
        <Card data-testid="card-financial-details">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              {t('financialBreakdown')}
            </CardTitle>
            <CardDescription>{t('detailedFinancialAnalysis')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Revenue Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b">
                  <span className="text-sm font-semibold text-muted-foreground">{t('revenue')}</span>
                  <span className="text-lg font-bold text-foreground">
                    {metrics.totalRevenue.toFixed(2)} {currency}
                  </span>
                </div>
              </div>

              {/* Costs Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b">
                  <span className="text-sm font-semibold text-muted-foreground">{t('totalCosts')}</span>
                  <span className="text-lg font-bold text-red-600">
                    {(metrics.totalRevenue - metrics.totalProfit).toFixed(2)} {currency}
                  </span>
                </div>
              </div>

              {/* Profit Breakdown */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">{t('profitBreakdown')}</h4>
                
                <div className="flex items-center justify-between pl-4">
                  <span className="text-sm text-muted-foreground">{t('itemsProfit')}</span>
                  <span className="font-semibold text-green-600">
                    {metrics.totalItemsProfit.toFixed(2)} {currency}
                  </span>
                </div>

                <div className="flex items-center justify-between pl-4">
                  <span className="text-sm text-muted-foreground">{t('profitFromShipping')}</span>
                  <span className="font-semibold text-green-600">
                    {metrics.totalShippingProfit.toFixed(2)} {currency}
                  </span>
                </div>

                {lydExchangeRate > 0 && lydPurchaseExchangeRate > 0 && metrics.exchangeRateProfit > 0 && (
                  <div className="flex items-center justify-between pl-4">
                    <span className="text-sm text-muted-foreground">{t('exchangeRateProfit')}</span>
                    <span className="font-semibold text-amber-600">
                      {metrics.exchangeRateProfit.toFixed(2)} LYD
                    </span>
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-semibold text-foreground">{t('totalProfit')}</span>
                  <span className="text-xl font-bold text-green-600">
                    {lydExchangeRate > 0 && lydPurchaseExchangeRate > 0 && metrics.exchangeRateProfit > 0
                      ? metrics.totalProfitWithExchange.toFixed(2)
                      : metrics.totalProfit.toFixed(2)
                    } {currency}
                  </span>
                </div>
              </div>

              {/* Profit Margin */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">{t('profitMargin')}</span>
                  <span className="text-lg font-bold text-blue-600">
                    {metrics.profitMargin.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Average Order Value */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">{t('averageOrderValue')}</span>
                  <span className="text-lg font-bold text-purple-600">
                    {metrics.averageOrderValue.toFixed(2)} {currency}
                  </span>
                </div>
              </div>

              {/* Total Orders */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('numberOfOrders')}</span>
                  <span className="font-semibold">{metrics.orderCount}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Analytics - Temporarily Disabled */}

        {/* Sales Report Modal */}
        <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
          <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto" data-testid="modal-sales-report">
            <DialogHeader>
              <div className="flex justify-between items-center">
                <DialogTitle>{t('salesReportPreview')}</DialogTitle>
                <div className="flex space-x-2">
                  <Button onClick={handlePrint} data-testid="button-print-report">
                    <Printer className="w-4 h-4 mr-2" />
                    {t('printReport')}
                  </Button>
                  <Button variant="outline" onClick={() => setIsReportModalOpen(false)}>
                    {t('close')}
                  </Button>
                </div>
              </div>
            </DialogHeader>
            {isGeneratingReport ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-2">{t('generatingReport')}</p>
              </div>
            ) : reportData ? (
              <SalesReport 
                reportType={selectedReportType} 
                data={reportData} 
                onPrint={handlePrint} 
              />
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">{t('failedToGenerateReport')}</p>
              </div>
            )}
          </DialogContent>
        </Dialog>
    </div>
  );
}
