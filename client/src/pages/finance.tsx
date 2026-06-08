import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  Wallet, Landmark, Receipt, Package,
  Plus, ArrowUpRight, ArrowDownLeft, RefreshCw, TrendingUp, TrendingDown,
  DollarSign, Banknote, Scale, UserCircle, History, Search, Trash2, AlertTriangle, ChevronDown, ChevronRight, Pencil,
  RotateCcw, ShoppingCart
} from "lucide-react";
import { format } from "date-fns";

type CurrencyMode = "USD" | "LYD";

interface RecentTransaction {
  type: string;
  amount: number;
  date: Date | string;
}

interface FinancialSummary {
  totalSafeBalanceUSD: number;
  totalSafeBalanceLYD: number;
  totalBankBalanceUSD: number;
  totalBankBalanceLYD: number;
  totalCustomerDebt: number;
  totalSupplierDebt: number;
  goodsCapitalLYD: number;
  goodsCapitalUSD: number;
  recentTransactions: RecentTransaction[];
}

interface Safe {
  id: string;
  name: string;
  code: string;
  balanceUSD: number | string;
  balanceLYD: number | string;
  parentSafeId: string | null;
  isActive: boolean;
}

interface Bank {
  id: string;
  name: string;
  code: string;
  accountNumber: string | null;
  balanceUSD: number | string;
  balanceLYD: number | string;
  linkedSafeId: string | null;
  isActive: boolean;
}

interface SafeTransaction {
  id: string;
  safeId: string;
  type: string;
  amountUSD: string;
  amountLYD: string;
  exchangeRate: string | null;
  description: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdByUserId: string;
  createdAt: string;
}

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

export default function Finance() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const isRTL = i18n.language === "ar";
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>("USD");
  const [activeTab, setActiveTab] = useState("safes");
  
  const [newSafeDialogOpen, setNewSafeDialogOpen] = useState(false);
  const [newBankDialogOpen, setNewBankDialogOpen] = useState(false);
  const [safeTransactionDialogOpen, setSafeTransactionDialogOpen] = useState(false);
  const [bankTransactionDialogOpen, setBankTransactionDialogOpen] = useState(false);
  const [selectedSafe, setSelectedSafe] = useState<Safe | null>(null);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [reconciliationDialogOpen, setReconciliationDialogOpen] = useState(false);
  const [selectedReconcileSafe, setSelectedReconcileSafe] = useState<string>("");
  const [editSafeDialogOpen, setEditSafeDialogOpen] = useState(false);
  const [safeToEdit, setSafeToEdit] = useState<Safe | null>(null);
  const [editSafeName, setEditSafeName] = useState("");
  const [editSafeCode, setEditSafeCode] = useState("");
  const [deleteSafeConfirmOpen, setDeleteSafeConfirmOpen] = useState(false);
  const [safeToDelete, setSafeToDelete] = useState<Safe | null>(null);
  const [ownerAccountDialogOpen, setOwnerAccountDialogOpen] = useState(false);
  const [capitalTxDialogOpen, setCapitalTxDialogOpen] = useState(false);
  const [selectedOwnerAccount, setSelectedOwnerAccount] = useState<string>("");
  const [transactionSearchQuery, setTransactionSearchQuery] = useState("");
  const [safeTxType, setSafeTxType] = useState("deposit");
  const [safeTxAmountUSD, setSafeTxAmountUSD] = useState("");
  const [safeTxAmountLYD, setSafeTxAmountLYD] = useState("");
  const [safeTxDescription, setSafeTxDescription] = useState("");
  const [bankTxType, setBankTxType] = useState("deposit");
  const [bankTxAmountUSD, setBankTxAmountUSD] = useState("");
  const [bankTxAmountLYD, setBankTxAmountLYD] = useState("");
  const [bankTxDescription, setBankTxDescription] = useState("");
  const [expandedPartner, setExpandedPartner] = useState<string | null>(null);

  const { data: summary, isLoading: summaryLoading } = useQuery<FinancialSummary>({
    queryKey: ["/api/financial-summary"],
  });

  interface GoodsCapitalItem {
    productId: string;
    productName: string;
    costPrice: number;
    sellPrice: number;
    branch: string;
    quantity: number;
    totalValue: number;
    totalSellValue: number;
  }
  interface MissingCostItem {
    productId: string;
    productName: string;
    sellPrice: number;
    branch: string;
    quantity: number;
  }
  const { data: goodsCapitalDetails } = useQuery<{
    items: GoodsCapitalItem[];
    missingCostPrice: MissingCostItem[];
    totalCapital: number;
    totalSellValue: number;
  }>({
    queryKey: ["/api/goods-capital-details"],
  });

  const { data: safes = [], isLoading: safesLoading } = useQuery<Safe[]>({
    queryKey: ["/api/safes"],
  });

  const { data: banks = [], isLoading: banksLoading } = useQuery<Bank[]>({
    queryKey: ["/api/banks"],
  });

  const { data: invoiceMetrics } = useQuery<InvoiceMetrics>({
    queryKey: ["/api/invoices/metrics"],
    queryFn: async () => {
      const response = await fetch("/api/invoices/metrics?branch=all", { credentials: 'include' });
      return response.json();
    },
  });

  const { data: reconciliations = [] } = useQuery<any[]>({
    queryKey: ["/api/reconciliations"],
  });

  const { data: ownerAccounts = [] } = useQuery<any[]>({
    queryKey: ["/api/owner-accounts"],
  });

  const { data: allTransactions = [] } = useQuery<SafeTransaction[]>({
    queryKey: ["/api/safe-transactions"],
  });

  const createReconciliationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/reconciliations", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reconciliations"] });
      setReconciliationDialogOpen(false);
      toast({ title: t("success") || "Success", description: t("reconciliationCreated") || "Reconciliation recorded" });
    },
    onError: () => {
      toast({ title: t("error") || "Error", variant: "destructive" });
    },
  });

  const createOwnerAccountMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/owner-accounts", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner-accounts"] });
      setOwnerAccountDialogOpen(false);
      toast({ title: t("success") || "Success" });
    },
    onError: () => {
      toast({ title: t("error") || "Error", variant: "destructive" });
    },
  });

  const { data: allCapitalTransactions = [] } = useQuery<any[]>({
    queryKey: ["/api/capital-transactions"],
  });

  const createCapitalTxMutation = useMutation({
    mutationFn: async (data: any) => {
      const { ownerAccountId, ...txData } = data;
      const response = await apiRequest("POST", `/api/owner-accounts/${ownerAccountId}/transactions`, txData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/capital-transactions"] });
      setCapitalTxDialogOpen(false);
      toast({ title: t("success") || "Success" });
    },
    onError: () => {
      toast({ title: t("error") || "Error", variant: "destructive" });
    },
  });

  const deleteCapitalTxMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/capital-transactions/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/capital-transactions"] });
      toast({ title: t("deleted") || "Deleted", description: t("transactionDeleted") || "Transaction removed and balance updated" });
    },
    onError: () => {
      toast({ title: t("error") || "Error", variant: "destructive" });
    },
  });

  const deleteOwnerAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/owner-accounts/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/capital-transactions"] });
      toast({ title: t("deleted") || "Deleted", description: t("partnerDeleted") || "Partner and all their transactions removed" });
    },
    onError: () => {
      toast({ title: t("error") || "Error", variant: "destructive" });
    },
  });

  const createSafeMutation = useMutation({
    mutationFn: async (data: { name: string; code: string; parentSafeId?: string }) => {
      const response = await apiRequest("POST", "/api/safes", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/safes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      setNewSafeDialogOpen(false);
      toast({ title: t("safeCreated") || "Safe created successfully" });
    },
    onError: (error: any) => {
      let msg = t("failedToCreateSafe") || "Failed to create safe";
      try {
        const parsed = JSON.parse(error?.message?.split(": ").slice(1).join(": ") || "{}");
        if (parsed.message) msg = parsed.message;
      } catch {}
      toast({ title: t("error") || "Error", description: msg, variant: "destructive" });
    },
  });

  const updateSafeMutation = useMutation({
    mutationFn: async ({ id, name, code }: { id: string; name: string; code: string }) => {
      const response = await apiRequest("PATCH", `/api/safes/${id}`, { name, code });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/safes"] });
      setEditSafeDialogOpen(false);
      setSafeToEdit(null);
      toast({ title: t("updated") || "Updated", description: t("safeUpdated") || "Safe updated successfully" });
    },
    onError: () => {
      toast({ title: t("error") || "Error", description: t("failedToUpdateSafe") || "Failed to update safe", variant: "destructive" });
    },
  });

  const deleteSafeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/safes/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/safes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      setDeleteSafeConfirmOpen(false);
      setSafeToDelete(null);
      toast({ title: t("deleted") || "Deleted", description: t("safeDeleted") || "Safe deleted successfully" });
    },
    onError: () => {
      toast({ title: t("error") || "Error", description: t("failedToDeleteSafe") || "Failed to delete safe", variant: "destructive" });
    },
  });

  const createBankMutation = useMutation({
    mutationFn: async (data: { name: string; code: string; accountNumber?: string; linkedSafeId?: string }) => {
      const response = await apiRequest("POST", "/api/banks", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/banks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      setNewBankDialogOpen(false);
      toast({ title: t("bankCreated") || "Bank created successfully" });
    },
    onError: () => {
      toast({ title: t("error") || "Error", description: t("failedToCreateBank") || "Failed to create bank", variant: "destructive" });
    },
  });

  const createSafeTransactionMutation = useMutation({
    mutationFn: async (data: { safeId: string; type: string; amountUSD?: string; amountLYD?: string; description?: string }) => {
      const { safeId, ...transactionData } = data;
      const response = await apiRequest("POST", `/api/safes/${safeId}/transactions`, transactionData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/safes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      setSafeTransactionDialogOpen(false);
      setSelectedSafe(null);
      toast({ title: t("transactionCreated") || "Transaction recorded successfully" });
    },
    onError: () => {
      toast({ title: t("error") || "Error", description: t("failedToCreateTransaction") || "Failed to record transaction", variant: "destructive" });
    },
  });

  const createBankTransactionMutation = useMutation({
    mutationFn: async (data: { bankId: string; type: string; amountUSD?: string; amountLYD?: string; description?: string }) => {
      const { bankId, ...transactionData } = data;
      const response = await apiRequest("POST", `/api/banks/${bankId}/transactions`, transactionData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/banks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      setBankTransactionDialogOpen(false);
      setSelectedBank(null);
      toast({ title: t("transactionCreated") || "Transaction recorded successfully" });
    },
    onError: () => {
      toast({ title: t("error") || "Error", description: t("failedToCreateTransaction") || "Failed to record transaction", variant: "destructive" });
    },
  });

  const formatCurrency = (amount: number | string, currency: CurrencyMode = currencyMode) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(num)) return currency === "USD" ? "$0.00" : "0.00 LYD";
    return currency === "USD" 
      ? `$${num.toFixed(2)}` 
      : `${num.toFixed(2)} ${isRTL ? "د.ل" : "LYD"}`;
  };

  const getTransactionIcon = (type: string) => {
    if (type.includes("deposit")) return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
    if (type.includes("withdrawal")) return <ArrowUpRight className="h-4 w-4 text-red-500" />;
    if (type.includes("transfer")) return <RefreshCw className="h-4 w-4 text-blue-500" />;
    return <DollarSign className="h-4 w-4" />;
  };

  const getTransactionBadgeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
    if (type.includes("deposit")) return "default";
    if (type.includes("withdrawal")) return "destructive";
    if (type.includes("transfer")) return "secondary";
    return "outline";
  };

  return (
    <div className="p-4 md:p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-finance-title">
            {t("financeManagement") || "Finance Management"}
          </h1>
          <p className="text-muted-foreground">
            {t("financeDescription") || "Manage safes, banks, and financial transactions"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={currencyMode === "USD" ? "default" : "outline"}
            size="sm"
            onClick={() => setCurrencyMode("USD")}
            data-testid="button-currency-usd"
          >
            <DollarSign className="h-4 w-4 mr-1" />
            USD
          </Button>
          <Button
            variant={currencyMode === "LYD" ? "default" : "outline"}
            size="sm"
            onClick={() => setCurrencyMode("LYD")}
            data-testid="button-currency-lyd"
          >
            <Banknote className="h-4 w-4 mr-1" />
            {isRTL ? "د.ل" : "LYD"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto lg:inline-flex">
          <TabsTrigger value="overview" data-testid="tab-overview">
            {t("overview") || "Overview"}
          </TabsTrigger>
          <TabsTrigger value="sales" data-testid="tab-sales">
            {t("salesByBranch") || "Sales by Branch"}
          </TabsTrigger>
          <TabsTrigger value="safes" data-testid="tab-safes">
            {t("safes") || "Safes"}
          </TabsTrigger>
          <TabsTrigger value="banks" data-testid="tab-banks">
            {t("banks") || "Banks"}
          </TabsTrigger>
          <TabsTrigger value="reconciliation" data-testid="tab-reconciliation">
            {t("reconciliation") || "Reconciliation"}
          </TabsTrigger>
          <TabsTrigger value="capital" data-testid="tab-capital">
            {t("capital") || "Capital"}
          </TabsTrigger>
          <TabsTrigger value="transactions" data-testid="tab-transactions">
            <History className="h-4 w-4 mr-1" />
            {t("transactionHistory") || "Transaction History"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-2 border-blue-200 dark:border-blue-800">
              <CardHeader className="bg-blue-50 dark:bg-blue-900/20">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  {t("ALFANI1") || "ALFANI1"}
                </CardTitle>
                <CardDescription>{t("branchSalesData") || "Branch sales data"}</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("totalSales") || "Total Sales"}</span>
                    <span className="text-xl font-bold text-green-600">
                      ${(invoiceMetrics?.byBranch?.ALFANI1?.sales || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("invoices") || "Invoices"}</span>
                    <span className="text-xl font-bold">
                      {invoiceMetrics?.byBranch?.ALFANI1?.count || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("itemsSold") || "Items Sold"}</span>
                    <span className="text-xl font-bold">
                      {invoiceMetrics?.byBranch?.ALFANI1?.items || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-2 border-purple-200 dark:border-purple-800">
              <CardHeader className="bg-purple-50 dark:bg-purple-900/20">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                  {t("ALFANI2") || "ALFANI2"}
                </CardTitle>
                <CardDescription>{t("branchSalesData") || "Branch sales data"}</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("totalSales") || "Total Sales"}</span>
                    <span className="text-xl font-bold text-green-600">
                      ${(invoiceMetrics?.byBranch?.ALFANI2?.sales || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("invoices") || "Invoices"}</span>
                    <span className="text-xl font-bold">
                      {invoiceMetrics?.byBranch?.ALFANI2?.count || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("itemsSold") || "Items Sold"}</span>
                    <span className="text-xl font-bold">
                      {invoiceMetrics?.byBranch?.ALFANI2?.items || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          {summaryLoading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
          <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Card data-testid="card-safe-balance">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("totalSafeBalance") || "Total Safe Balance"}
                </CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(currencyMode === "USD" ? summary?.totalSafeBalanceUSD || 0 : summary?.totalSafeBalanceLYD || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {currencyMode === "USD" 
                    ? formatCurrency(summary?.totalSafeBalanceLYD || 0, "LYD")
                    : formatCurrency(summary?.totalSafeBalanceUSD || 0, "USD")}
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-bank-balance">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("totalBankBalance") || "Total Bank Balance"}
                </CardTitle>
                <Landmark className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(currencyMode === "USD" ? summary?.totalBankBalanceUSD || 0 : summary?.totalBankBalanceLYD || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {currencyMode === "USD" 
                    ? formatCurrency(summary?.totalBankBalanceLYD || 0, "LYD")
                    : formatCurrency(summary?.totalBankBalanceUSD || 0, "USD")}
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-customer-debt">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("customerDebt") || "Customer Receivables"}
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(summary?.totalCustomerDebt || 0, "USD")}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("amountOwedByCustomers") || "Amount owed by customers"}
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-supplier-debt">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("supplierDebt") || "Supplier Payables"}
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(summary?.totalSupplierDebt || 0, "USD")}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("amountOwedToSuppliers") || "Amount owed to suppliers"}
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-goods-capital">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("goodsCapital") || "Goods Capital"}
                </CardTitle>
                <Package className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {formatCurrency(summary?.goodsCapitalLYD || 0, "LYD")}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("totalInventoryValue") || "Total inventory value at cost"}
                </p>
              </CardContent>
            </Card>
          </div>

          {goodsCapitalDetails && (goodsCapitalDetails.items.length > 0 || (goodsCapitalDetails.missingCostPrice?.length ?? 0) > 0) && (
            <div className="space-y-4">
              {(goodsCapitalDetails.missingCostPrice?.length ?? 0) > 0 && (
                <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/20" data-testid="card-missing-cost-price">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                      <AlertTriangle className="h-5 w-5" />
                      {t("missingCostPrice") || "Products Missing Cost Price"}
                      <Badge className="ml-2 bg-orange-500">{goodsCapitalDetails.missingCostPrice.length}</Badge>
                    </CardTitle>
                    <CardDescription className="text-orange-600 dark:text-orange-500">
                      {t("missingCostPriceDesc") || "These products have stock but no cost price set — they are excluded from goods capital calculation"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="border border-orange-200 rounded-md overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("product") || "Product"}</TableHead>
                            <TableHead>{t("branch") || "Branch"}</TableHead>
                            <TableHead className="text-center">{t("quantity") || "Qty"}</TableHead>
                            <TableHead className="text-center">{t("sellPrice") || "Sell Price"}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {goodsCapitalDetails.missingCostPrice.map((item, idx) => (
                            <TableRow key={`missing-${item.productId}-${item.branch}-${idx}`}>
                              <TableCell className="font-medium text-orange-700 dark:text-orange-400">{item.productName}</TableCell>
                              <TableCell><Badge variant="outline">{item.branch}</Badge></TableCell>
                              <TableCell className="text-center">{item.quantity}</TableCell>
                              <TableCell className="text-center">{item.sellPrice.toFixed(2)} LYD</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {goodsCapitalDetails.items.length > 0 && (
                <Card data-testid="card-goods-capital-details">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-amber-500" />
                      {t("goodsCapitalDetails") || "Goods Capital Details"}
                    </CardTitle>
                    <CardDescription>{t("goodsCapitalDetailsDesc") || "Breakdown of inventory value by product (cost price vs selling price)"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-md overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("product") || "Product"}</TableHead>
                            <TableHead>{t("branch") || "Branch"}</TableHead>
                            <TableHead className="text-center">{t("quantity") || "Qty"}</TableHead>
                            <TableHead className="text-center">{t("costPrice") || "Cost"}</TableHead>
                            <TableHead className="text-center">{t("sellPrice") || "Sell"}</TableHead>
                            <TableHead className="text-center text-amber-600">{t("costTotal") || "Cost Total"}</TableHead>
                            <TableHead className="text-center text-green-600">{t("sellTotal") || "Sell Total"}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {goodsCapitalDetails.items.map((item, idx) => (
                            <TableRow key={`${item.productId}-${item.branch}-${idx}`}>
                              <TableCell className="font-medium">{item.productName}</TableCell>
                              <TableCell><Badge variant="outline">{item.branch}</Badge></TableCell>
                              <TableCell className="text-center">{item.quantity}</TableCell>
                              <TableCell className="text-center text-muted-foreground">{item.costPrice.toFixed(2)}</TableCell>
                              <TableCell className="text-center text-muted-foreground">{item.sellPrice.toFixed(2)}</TableCell>
                              <TableCell className="text-center font-semibold text-amber-600">{item.totalValue.toFixed(2)}</TableCell>
                              <TableCell className="text-center font-semibold text-green-600">{item.totalSellValue.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">{t("totalCostCapital") || "Total Cost Capital"}</p>
                        <p className="text-xl font-bold text-amber-600">{goodsCapitalDetails.totalCapital.toFixed(2)} LYD</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">{t("totalSellValue") || "Total Sell Value"}</p>
                        <p className="text-xl font-bold text-green-600">{goodsCapitalDetails.totalSellValue.toFixed(2)} LYD</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  {t("safes") || "Safes"}
                </CardTitle>
                <CardDescription>{t("activeSafes") || "Active safes and their balances"}</CardDescription>
              </CardHeader>
              <CardContent>
                {safesLoading ? (
                  <div className="flex justify-center py-4">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  </div>
                ) : safes.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">{t("noSafes") || "No safes created yet"}</p>
                ) : (
                  <div className="space-y-3">
                    {safes.slice(0, 5).map((safe) => (
                      <div key={safe.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg" data-testid={`safe-item-${safe.id}`}>
                        <div>
                          <p className="font-medium">{safe.name}</p>
                          <p className="text-xs text-muted-foreground">{safe.code}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">{formatCurrency(safe.balanceUSD, "USD")}</p>
                          <p className="text-xs text-blue-600 font-medium">{formatCurrency(safe.balanceLYD, "LYD")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Landmark className="h-5 w-5" />
                  {t("banks") || "Banks"}
                </CardTitle>
                <CardDescription>{t("activeBanks") || "Active banks and their balances"}</CardDescription>
              </CardHeader>
              <CardContent>
                {banksLoading ? (
                  <div className="flex justify-center py-4">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  </div>
                ) : banks.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">{t("noBanks") || "No banks created yet"}</p>
                ) : (
                  <div className="space-y-3">
                    {banks.slice(0, 5).map((bank) => (
                      <div key={bank.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg" data-testid={`bank-item-${bank.id}`}>
                        <div>
                          <p className="font-medium">{bank.name}</p>
                          <p className="text-xs text-muted-foreground">{bank.code}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-blue-600">{formatCurrency(bank.balanceUSD, "USD")}</p>
                          <p className="text-xs text-blue-600 font-medium">{formatCurrency(bank.balanceLYD, "LYD")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {summary?.recentTransactions && summary.recentTransactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  {t("recentTransactions") || "Recent Transactions"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("type") || "Type"}</TableHead>
                      <TableHead>{t("amount") || "Amount"}</TableHead>
                      <TableHead>{t("date") || "Date"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.recentTransactions.map((tx, index) => (
                      <TableRow key={index} data-testid={`transaction-row-${index}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTransactionIcon(tx.type)}
                            <Badge variant={getTransactionBadgeVariant(tx.type)}>
                              {tx.type.replace("_", " ")}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(tx.amount, "USD")}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(tx.date), "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          </>
          )}
        </TabsContent>

        <TabsContent value="safes" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">{t("safeManagement") || "Safe Management"}</h2>
            <Dialog open={newSafeDialogOpen} onOpenChange={setNewSafeDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-safe">
                  <Plus className="h-4 w-4 mr-2" />
                  {t("addSafe") || "Add Safe"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("createNewSafe") || "Create New Safe"}</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    createSafeMutation.mutate({
                      name: formData.get("name") as string,
                      code: formData.get("code") as string,
                      parentSafeId: formData.get("parentSafeId") as string || undefined,
                    });
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("safeName") || "Safe Name"}</Label>
                    <Input id="name" name="name" required data-testid="input-safe-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code">{t("safeCode") || "Safe Code"}</Label>
                    <Input id="code" name="code" required data-testid="input-safe-code" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parentSafeId">{t("parentSafe") || "Parent Safe (Optional)"}</Label>
                    <Select name="parentSafeId">
                      <SelectTrigger data-testid="select-parent-safe">
                        <SelectValue placeholder={t("selectParentSafe") || "Select parent safe"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("noParent") || "No Parent"}</SelectItem>
                        {safes.map((safe) => (
                          <SelectItem key={safe.id} value={safe.id}>{safe.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createSafeMutation.isPending} data-testid="button-submit-safe">
                      {createSafeMutation.isPending ? t("creating") || "Creating..." : t("create") || "Create"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="pt-6">
              {safesLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin" />
                </div>
              ) : safes.length === 0 ? (
                <div className="text-center py-8">
                  <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t("noSafesYet") || "No safes created yet. Click 'Add Safe' to create one."}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("name") || "Name"}</TableHead>
                      <TableHead>{t("code") || "Code"}</TableHead>
                      <TableHead>{t("balanceUSD") || "Balance (USD)"}</TableHead>
                      <TableHead>{t("balanceLYD") || "Balance (LYD)"}</TableHead>
                      <TableHead>{t("status") || "Status"}</TableHead>
                      <TableHead>{t("actions") || "Actions"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safes.map((safe) => (
                      <TableRow key={safe.id} data-testid={`safe-row-${safe.id}`}>
                        <TableCell className="font-medium">{safe.name}</TableCell>
                        <TableCell>{safe.code}</TableCell>
                        <TableCell className="font-bold text-primary">{formatCurrency(safe.balanceUSD, "USD")}</TableCell>
                        <TableCell className="font-bold text-blue-600">{formatCurrency(safe.balanceLYD, "LYD")}</TableCell>
                        <TableCell>
                          <Badge variant={safe.isActive ? "default" : "secondary"}>
                            {safe.isActive ? t("active") || "Active" : t("inactive") || "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedSafe(safe);
                                setSafeTransactionDialogOpen(true);
                              }}
                              data-testid={`button-add-transaction-${safe.id}`}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              {t("transaction") || "Transaction"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSafeToEdit(safe);
                                setEditSafeName(safe.name);
                                setEditSafeCode(safe.code);
                                setEditSafeDialogOpen(true);
                              }}
                              data-testid={`button-edit-safe-${safe.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive"
                              onClick={() => {
                                setSafeToDelete(safe);
                                setDeleteSafeConfirmOpen(true);
                              }}
                              data-testid={`button-delete-safe-${safe.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Dialog open={safeTransactionDialogOpen} onOpenChange={(open) => {
            setSafeTransactionDialogOpen(open);
            if (!open) { setSafeTxType("deposit"); setSafeTxAmountUSD(""); setSafeTxAmountLYD(""); setSafeTxDescription(""); }
          }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {t("addTransaction") || "Add Transaction"} - {selectedSafe?.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("transactionType") || "Transaction Type"}</Label>
                  <Select value={safeTxType} onValueChange={setSafeTxType}>
                    <SelectTrigger data-testid="select-transaction-type">
                      <SelectValue placeholder={t("selectType") || "Select type"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deposit">{t("deposit") || "Deposit"}</SelectItem>
                      <SelectItem value="withdrawal">{t("withdrawal") || "Withdrawal"}</SelectItem>
                      <SelectItem value="transfer">{t("transfer") || "Transfer"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amountUSD">{t("amountUSD") || "Amount (USD)"}</Label>
                    <Input id="amountUSD" type="number" step="0.01" value={safeTxAmountUSD} onChange={e => setSafeTxAmountUSD(e.target.value)} data-testid="input-amount-usd" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amountLYD">{t("amountLYD") || "Amount (LYD)"}</Label>
                    <Input id="amountLYD" type="number" step="0.01" value={safeTxAmountLYD} onChange={e => setSafeTxAmountLYD(e.target.value)} data-testid="input-amount-lyd" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="safeTxDescription">{t("description") || "Description"}</Label>
                  <Input id="safeTxDescription" value={safeTxDescription} onChange={e => setSafeTxDescription(e.target.value)} data-testid="input-description" />
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      if (!selectedSafe || !safeTxType) return;
                      createSafeTransactionMutation.mutate({
                        safeId: selectedSafe.id,
                        type: safeTxType,
                        amountUSD: safeTxAmountUSD || undefined,
                        amountLYD: safeTxAmountLYD || undefined,
                        description: safeTxDescription || undefined,
                      });
                    }}
                    disabled={createSafeTransactionMutation.isPending}
                    data-testid="button-submit-transaction"
                  >
                    {createSafeTransactionMutation.isPending ? t("saving") || "Saving..." : t("save") || "Save"}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Safe Dialog */}
          <Dialog open={editSafeDialogOpen} onOpenChange={setEditSafeDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("editSafe") || "Edit Safe"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("safeName") || "Safe Name"}</Label>
                  <Input
                    value={editSafeName}
                    onChange={(e) => setEditSafeName(e.target.value)}
                    data-testid="input-edit-safe-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("safeCode") || "Safe Code"}</Label>
                  <Input
                    value={editSafeCode}
                    onChange={(e) => setEditSafeCode(e.target.value)}
                    data-testid="input-edit-safe-code"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditSafeDialogOpen(false)}>
                  {t("cancel") || "Cancel"}
                </Button>
                <Button
                  disabled={updateSafeMutation.isPending || !editSafeName.trim() || !editSafeCode.trim()}
                  onClick={() => {
                    if (safeToEdit) {
                      updateSafeMutation.mutate({ id: safeToEdit.id, name: editSafeName.trim(), code: editSafeCode.trim() });
                    }
                  }}
                  data-testid="button-confirm-edit-safe"
                >
                  {updateSafeMutation.isPending ? t("saving") || "Saving..." : t("save") || "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Safe Confirmation Dialog */}
          <Dialog open={deleteSafeConfirmOpen} onOpenChange={setDeleteSafeConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  {t("deleteSafe") || "Delete Safe"}
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                {t("deleteSafeConfirm") || "Are you sure you want to delete"} <strong>{safeToDelete?.name}</strong>? {t("actionCannotBeUndone") || "This action cannot be undone."}
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteSafeConfirmOpen(false)}>
                  {t("cancel") || "Cancel"}
                </Button>
                <Button
                  variant="destructive"
                  disabled={deleteSafeMutation.isPending}
                  onClick={() => safeToDelete && deleteSafeMutation.mutate(safeToDelete.id)}
                  data-testid="button-confirm-delete-safe"
                >
                  {deleteSafeMutation.isPending ? t("deleting") || "Deleting..." : t("delete") || "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </TabsContent>

        <TabsContent value="banks" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">{t("bankManagement") || "Bank Management"}</h2>
            <Dialog open={newBankDialogOpen} onOpenChange={setNewBankDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-bank">
                  <Plus className="h-4 w-4 mr-2" />
                  {t("addBank") || "Add Bank"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("createNewBank") || "Create New Bank"}</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    createBankMutation.mutate({
                      name: formData.get("name") as string,
                      code: formData.get("code") as string,
                      accountNumber: formData.get("accountNumber") as string || undefined,
                      linkedSafeId: formData.get("linkedSafeId") as string || undefined,
                    });
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="bankName">{t("bankName") || "Bank Name"}</Label>
                    <Input id="bankName" name="name" required data-testid="input-bank-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bankCode">{t("bankCode") || "Bank Code"}</Label>
                    <Input id="bankCode" name="code" required data-testid="input-bank-code" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountNumber">{t("accountNumber") || "Account Number"}</Label>
                    <Input id="accountNumber" name="accountNumber" data-testid="input-account-number" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkedSafeId">{t("linkedSafe") || "Linked Safe (Optional)"}</Label>
                    <Select name="linkedSafeId">
                      <SelectTrigger data-testid="select-linked-safe">
                        <SelectValue placeholder={t("selectLinkedSafe") || "Select linked safe"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("noLinkedSafe") || "No Linked Safe"}</SelectItem>
                        {safes.map((safe) => (
                          <SelectItem key={safe.id} value={safe.id}>{safe.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createBankMutation.isPending} data-testid="button-submit-bank">
                      {createBankMutation.isPending ? t("creating") || "Creating..." : t("create") || "Create"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="pt-6">
              {banksLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin" />
                </div>
              ) : banks.length === 0 ? (
                <div className="text-center py-8">
                  <Landmark className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t("noBanksYet") || "No banks created yet. Click 'Add Bank' to create one."}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("name") || "Name"}</TableHead>
                      <TableHead>{t("code") || "Code"}</TableHead>
                      <TableHead>{t("accountNumber") || "Account #"}</TableHead>
                      <TableHead>{t("balanceUSD") || "Balance (USD)"}</TableHead>
                      <TableHead>{t("balanceLYD") || "Balance (LYD)"}</TableHead>
                      <TableHead>{t("linkedSafe") || "Linked Safe"}</TableHead>
                      <TableHead>{t("actions") || "Actions"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {banks.map((bank) => (
                      <TableRow key={bank.id} data-testid={`bank-row-${bank.id}`}>
                        <TableCell className="font-medium">{bank.name}</TableCell>
                        <TableCell>{bank.code}</TableCell>
                        <TableCell>{bank.accountNumber || "-"}</TableCell>
                        <TableCell className="font-bold text-primary">{formatCurrency(bank.balanceUSD, "USD")}</TableCell>
                        <TableCell className="font-bold text-blue-600">{formatCurrency(bank.balanceLYD, "LYD")}</TableCell>
                        <TableCell>
                          {bank.linkedSafeId ? (
                            <Badge variant="outline">
                              {safes.find(s => s.id === bank.linkedSafeId)?.name || "Linked"}
                            </Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedBank(bank);
                              setBankTransactionDialogOpen(true);
                            }}
                            data-testid={`button-add-bank-transaction-${bank.id}`}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            {t("transaction") || "Transaction"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Dialog open={bankTransactionDialogOpen} onOpenChange={(open) => {
            setBankTransactionDialogOpen(open);
            if (!open) { setBankTxType("deposit"); setBankTxAmountUSD(""); setBankTxAmountLYD(""); setBankTxDescription(""); }
          }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {t("addTransaction") || "Add Transaction"} - {selectedBank?.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("transactionType") || "Transaction Type"}</Label>
                  <Select value={bankTxType} onValueChange={setBankTxType}>
                    <SelectTrigger data-testid="select-bank-transaction-type">
                      <SelectValue placeholder={t("selectType") || "Select type"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deposit">{t("deposit") || "Deposit"}</SelectItem>
                      <SelectItem value="withdrawal">{t("withdrawal") || "Withdrawal"}</SelectItem>
                      <SelectItem value="transfer">{t("transfer") || "Transfer"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bankAmountUSD">{t("amountUSD") || "Amount (USD)"}</Label>
                    <Input id="bankAmountUSD" type="number" step="0.01" value={bankTxAmountUSD} onChange={e => setBankTxAmountUSD(e.target.value)} data-testid="input-bank-amount-usd" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bankAmountLYD">{t("amountLYD") || "Amount (LYD)"}</Label>
                    <Input id="bankAmountLYD" type="number" step="0.01" value={bankTxAmountLYD} onChange={e => setBankTxAmountLYD(e.target.value)} data-testid="input-bank-amount-lyd" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankTxDescription">{t("description") || "Description"}</Label>
                  <Input id="bankTxDescription" value={bankTxDescription} onChange={e => setBankTxDescription(e.target.value)} data-testid="input-bank-description" />
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      if (!selectedBank || !bankTxType) return;
                      createBankTransactionMutation.mutate({
                        bankId: selectedBank.id,
                        type: bankTxType,
                        amountUSD: bankTxAmountUSD || undefined,
                        amountLYD: bankTxAmountLYD || undefined,
                        description: bankTxDescription || undefined,
                      });
                    }}
                    disabled={createBankTransactionMutation.isPending}
                    data-testid="button-submit-bank-transaction"
                  >
                    {createBankTransactionMutation.isPending ? t("saving") || "Saving..." : t("save") || "Save"}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="reconciliation" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">{t("cashboxReconciliation") || "Cashbox Reconciliation"}</h2>
            <Dialog open={reconciliationDialogOpen} onOpenChange={setReconciliationDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-reconciliation">
                  <Scale className="h-4 w-4 mr-2" />
                  {t("newReconciliation") || "New Reconciliation"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("reconcileCashbox") || "Reconcile Cashbox"}</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    createReconciliationMutation.mutate({
                      safeId: formData.get("safeId") as string,
                      actualBalanceUSD: formData.get("actualBalanceUSD") as string,
                      actualBalanceLYD: formData.get("actualBalanceLYD") as string,
                      notes: formData.get("notes") as string || undefined,
                    });
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label>{t("selectCashbox") || "Select Cashbox"}</Label>
                    <Select name="safeId" required value={selectedReconcileSafe} onValueChange={setSelectedReconcileSafe}>
                      <SelectTrigger data-testid="select-reconcile-safe">
                        <SelectValue placeholder={t("selectCashbox") || "Select cashbox"} />
                      </SelectTrigger>
                      <SelectContent>
                        {safes.filter(s => s.isActive).map(safe => (
                          <SelectItem key={safe.id} value={safe.id}>
                            {safe.name} (${parseFloat(String(safe.balanceUSD)).toFixed(2)} / {parseFloat(String(safe.balanceLYD)).toFixed(2)} LYD)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("actualBalanceUSD") || "Actual Balance (USD)"}</Label>
                      <Input name="actualBalanceUSD" type="number" step="0.01" required data-testid="input-actual-usd" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("actualBalanceLYD") || "Actual Balance (LYD)"}</Label>
                      <Input name="actualBalanceLYD" type="number" step="0.01" required data-testid="input-actual-lyd" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("notes") || "Notes"}</Label>
                    <Input name="notes" data-testid="input-reconciliation-notes" />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createReconciliationMutation.isPending} data-testid="button-submit-reconciliation">
                      {createReconciliationMutation.isPending ? t("saving") || "Saving..." : t("reconcile") || "Reconcile"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="pt-6">
              {reconciliations.length === 0 ? (
                <div className="text-center py-8">
                  <Scale className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t("noReconciliations") || "No reconciliations recorded yet"}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("date") || "Date"}</TableHead>
                      <TableHead>{t("cashbox") || "Cashbox"}</TableHead>
                      <TableHead>{t("systemBalance") || "System Balance"}</TableHead>
                      <TableHead>{t("actualBalance") || "Actual Balance"}</TableHead>
                      <TableHead>{t("difference") || "Difference"}</TableHead>
                      <TableHead>{t("notes") || "Notes"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconciliations.map((rec: any) => {
                      const diffUSD = parseFloat(rec.differenceUSD || "0");
                      const diffLYD = parseFloat(rec.differenceLYD || "0");
                      const safe = safes.find(s => s.id === rec.safeId);
                      return (
                        <TableRow key={rec.id}>
                          <TableCell>{format(new Date(rec.createdAt), "MMM d, yyyy")}</TableCell>
                          <TableCell>{safe?.name || rec.safeId}</TableCell>
                          <TableCell>
                            <div>${parseFloat(rec.systemBalanceUSD || "0").toFixed(2)}</div>
                            <div className="text-xs text-blue-600">{parseFloat(rec.systemBalanceLYD || "0").toFixed(2)} LYD</div>
                          </TableCell>
                          <TableCell>
                            <div>${parseFloat(rec.actualBalanceUSD || "0").toFixed(2)}</div>
                            <div className="text-xs text-blue-600">{parseFloat(rec.actualBalanceLYD || "0").toFixed(2)} LYD</div>
                          </TableCell>
                          <TableCell>
                            <div className={diffUSD >= 0 ? "text-green-600" : "text-red-600"}>
                              {diffUSD >= 0 ? "+" : ""}${diffUSD.toFixed(2)}
                            </div>
                            <div className={`text-xs ${diffLYD >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {diffLYD >= 0 ? "+" : ""}{diffLYD.toFixed(2)} LYD
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{rec.notes || "-"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="capital" className="space-y-4">
          {/* Header + actions */}
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">{t("ownerAccountsCapital") || "Partners & Capital"}</h2>
            <div className="flex gap-2">
              {/* Add Transaction dialog */}
              <Dialog open={capitalTxDialogOpen} onOpenChange={setCapitalTxDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-capital-transaction">
                    <ArrowUpRight className="h-4 w-4 mr-2" />
                    {t("capitalTransaction") || "Transaction"}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("addCapitalTransaction") || "Add Capital Transaction"}</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const safeVal = formData.get("safeId") as string;
                      createCapitalTxMutation.mutate({
                        ownerAccountId: formData.get("ownerAccountId") as string,
                        type: formData.get("type") as string,
                        amount: formData.get("amount") as string,
                        currency: formData.get("currency") as string,
                        safeId: safeVal && safeVal !== "none" ? safeVal : undefined,
                        description: formData.get("description") as string || undefined,
                      });
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label>{t("ownerAccount") || "Partner"}</Label>
                      <Select name="ownerAccountId" defaultValue={selectedOwnerAccount || undefined} required>
                        <SelectTrigger><SelectValue placeholder={t("selectOwner") || "Select partner"} /></SelectTrigger>
                        <SelectContent>
                          {ownerAccounts.map((acc: any) => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.ownerName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("type") || "Type"}</Label>
                        <Select name="type" required>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="injection">{t("capitalInjection") || "Injection"}</SelectItem>
                            <SelectItem value="withdrawal">{t("capitalWithdrawal") || "Withdrawal"}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t("currency") || "Currency"}</Label>
                        <Select name="currency" defaultValue="USD">
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="LYD">LYD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("amount") || "Amount"}</Label>
                      <Input name="amount" type="number" step="0.01" min="0.01" required />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("cashbox") || "Cashbox"} ({t("optional") || "optional"})</Label>
                      <Select name="safeId">
                        <SelectTrigger><SelectValue placeholder={t("noCashbox") || "No cashbox"} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("noCashbox") || "None"}</SelectItem>
                          {safes.filter(s => s.isActive).map(safe => (
                            <SelectItem key={safe.id} value={safe.id}>{safe.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("description") || "Description"}</Label>
                      <Input name="description" />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={createCapitalTxMutation.isPending}>
                        {createCapitalTxMutation.isPending ? t("saving") || "Saving..." : t("save") || "Save"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Add Partner dialog */}
              <Dialog open={ownerAccountDialogOpen} onOpenChange={setOwnerAccountDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-owner-account">
                    <UserCircle className="h-4 w-4 mr-2" />
                    {t("addOwnerAccount") || "Add Partner"}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("createOwnerAccount") || "Add Partner"}</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      createOwnerAccountMutation.mutate({
                        ownerName: formData.get("ownerName") as string,
                        currency: formData.get("currency") as string || "USD",
                        notes: formData.get("notes") as string || undefined,
                      });
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label>{t("ownerName") || "Partner Name"}</Label>
                      <Input name="ownerName" required data-testid="input-owner-name" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("currency") || "Currency"}</Label>
                      <Select name="currency" defaultValue="USD">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="LYD">LYD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("notes") || "Notes"}</Label>
                      <Input name="notes" />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={createOwnerAccountMutation.isPending}>
                        {createOwnerAccountMutation.isPending ? t("creating") || "Creating..." : t("create") || "Create"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Total capital summary */}
          {ownerAccounts.length > 0 && (() => {
            const totalCapital = ownerAccounts.reduce((sum: number, a: any) => sum + parseFloat(a.capitalBalance || "0"), 0);
            return (
              <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200">
                <CardContent className="pt-5">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-sm text-muted-foreground">{t("totalCapital") || "Total Capital"}</p>
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">${totalCapital.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("partners") || "Partners"}</p>
                      <p className="text-2xl font-bold">{ownerAccounts.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("transactions") || "Transactions"}</p>
                      <p className="text-2xl font-bold">{allCapitalTransactions.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {ownerAccounts.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <UserCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t("noOwnerAccounts") || "No partners added yet"}</p>
                </div>
              </CardContent>
            </Card>
          ) : (() => {
            const totalCapital = ownerAccounts.reduce((sum: number, a: any) => sum + parseFloat(a.capitalBalance || "0"), 0);
            return (
              <div className="space-y-3">
                {ownerAccounts.map((account: any) => {
                  const balance = parseFloat(account.capitalBalance || "0");
                  const ownership = totalCapital > 0 ? (balance / totalCapital) * 100 : 0;
                  const partnerTxs = allCapitalTransactions.filter((tx: any) => tx.ownerAccountId === account.id);
                  const isExpanded = expandedPartner === account.id;
                  const injections = partnerTxs.filter((tx: any) => tx.type === "injection").reduce((s: number, tx: any) => s + parseFloat(tx.amount || "0"), 0);
                  const withdrawals = partnerTxs.filter((tx: any) => tx.type === "withdrawal").reduce((s: number, tx: any) => s + parseFloat(tx.amount || "0"), 0);

                  return (
                    <Card key={account.id} className="border-2" data-testid={`card-partner-${account.id}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <UserCircle className="h-6 w-6 text-blue-500" />
                            <div>
                              <CardTitle className="text-lg">{account.ownerName}</CardTitle>
                              {account.notes && <CardDescription>{account.notes}</CardDescription>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Quick-add transaction for this partner */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedOwnerAccount(account.id);
                                setCapitalTxDialogOpen(true);
                              }}
                              data-testid={`button-add-tx-${account.id}`}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              {t("transaction") || "Tx"}
                            </Button>
                            {/* Delete partner */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                if (confirm(`${t("confirmDeletePartner") || "Delete partner"} "${account.ownerName}"? ${t("thisWillDeleteAllTx") || "This will also delete all their transactions."}`)) {
                                  deleteOwnerAccountMutation.mutate(account.id);
                                }
                              }}
                              disabled={deleteOwnerAccountMutation.isPending}
                              data-testid={`button-delete-partner-${account.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        {/* Stats row */}
                        <div className="grid grid-cols-4 gap-3">
                          <div className="text-center p-2 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground">{t("capitalBalance") || "Balance"}</p>
                            <p className="text-lg font-bold text-green-600">
                              {account.currency === "LYD" ? "" : "$"}{balance.toFixed(2)}{account.currency === "LYD" ? " LYD" : ""}
                            </p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground">{t("ownership") || "Ownership"}</p>
                            <p className="text-lg font-bold text-blue-600">{ownership.toFixed(1)}%</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-950/30">
                            <p className="text-xs text-muted-foreground">{t("injections") || "In"}</p>
                            <p className="text-sm font-semibold text-green-600">+{injections.toFixed(2)}</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-950/30">
                            <p className="text-xs text-muted-foreground">{t("withdrawals") || "Out"}</p>
                            <p className="text-sm font-semibold text-red-600">-{withdrawals.toFixed(2)}</p>
                          </div>
                        </div>

                        {/* Ownership progress bar */}
                        <div>
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>{t("ownershipShare") || "Ownership share"}</span>
                            <span>{ownership.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${Math.min(ownership, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Transaction history (collapsible) */}
                        {partnerTxs.length > 0 && (
                          <div>
                            <button
                              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full"
                              onClick={() => setExpandedPartner(isExpanded ? null : account.id)}
                              data-testid={`button-expand-partner-${account.id}`}
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              {t("transactions") || "Transactions"} ({partnerTxs.length})
                            </button>

                            {isExpanded && (
                              <div className="mt-2 border rounded-md overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-xs">{t("date") || "Date"}</TableHead>
                                      <TableHead className="text-xs">{t("type") || "Type"}</TableHead>
                                      <TableHead className="text-xs">{t("amount") || "Amount"}</TableHead>
                                      <TableHead className="text-xs">{t("description") || "Notes"}</TableHead>
                                      <TableHead className="text-xs w-10"></TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {partnerTxs.map((tx: any) => (
                                      <TableRow key={tx.id} data-testid={`row-capital-tx-${tx.id}`}>
                                        <TableCell className="text-xs whitespace-nowrap">
                                          {tx.createdAt ? format(new Date(tx.createdAt), "yyyy-MM-dd") : "-"}
                                        </TableCell>
                                        <TableCell>
                                          <Badge
                                            variant={tx.type === "injection" ? "default" : "destructive"}
                                            className="text-xs"
                                          >
                                            {tx.type === "injection"
                                              ? (t("capitalInjection") || "Injection")
                                              : (t("capitalWithdrawal") || "Withdrawal")}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className={`text-sm font-semibold ${tx.type === "injection" ? "text-green-600" : "text-red-600"}`}>
                                          {tx.type === "injection" ? "+" : "-"}{parseFloat(tx.amount || "0").toFixed(2)} {tx.currency}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                                          {tx.description || "-"}
                                        </TableCell>
                                        <TableCell>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-red-400 hover:text-red-600"
                                            onClick={() => {
                                              if (confirm(t("confirmDeleteTransaction") || "Delete this transaction? The balance will be reversed.")) {
                                                deleteCapitalTxMutation.mutate(tx.id);
                                              }
                                            }}
                                            disabled={deleteCapitalTxMutation.isPending}
                                            data-testid={`button-delete-tx-${tx.id}`}
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            );
          })()}
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                {t("transactionHistory") || "Transaction History"}
              </CardTitle>
              <CardDescription>
                {t("allSafeTransactionsDesc") || "All financial transactions across safes, including sales revenue, returns, and manual adjustments"}
              </CardDescription>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("searchTransactions") || "Search transactions..."}
                  value={transactionSearchQuery}
                  onChange={(e) => setTransactionSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-transactions"
                />
              </div>
            </CardHeader>
            <CardContent>
              {allTransactions.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t("noTransactions") || "No transactions recorded yet"}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("date") || "Date"}</TableHead>
                        <TableHead>{t("type") || "Type"}</TableHead>
                        <TableHead>{t("description") || "Description"}</TableHead>
                        <TableHead>{t("reference") || "Reference"}</TableHead>
                        <TableHead className="text-right">{t("amountUSD") || "Amount (USD)"}</TableHead>
                        <TableHead className="text-right">{t("amountLYD") || "Amount (LYD)"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allTransactions
                        .filter((tx) => {
                          if (!transactionSearchQuery) return true;
                          const q = transactionSearchQuery.toLowerCase();
                          return (
                            (tx.description || "").toLowerCase().includes(q) ||
                            (tx.type || "").toLowerCase().includes(q) ||
                            (tx.referenceType || "").toLowerCase().includes(q) ||
                            (tx.referenceId || "").toLowerCase().includes(q)
                          );
                        })
                        .map((tx) => {
                          const isDeposit = tx.type === "deposit";
                          const isReturn = (tx.description || "").toLowerCase().includes("return") ||
                                           (tx.referenceType || "").toLowerCase().includes("return");
                          const isSale = (tx.referenceType || "").toLowerCase().includes("invoice") && isDeposit;
                          
                          return (
                            <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`}>
                              <TableCell className="whitespace-nowrap">
                                {tx.createdAt ? format(new Date(tx.createdAt), "yyyy-MM-dd HH:mm") : "-"}
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant={isDeposit ? "default" : "destructive"}
                                  className={`flex items-center gap-1 w-fit ${isReturn ? "bg-orange-500" : ""}`}
                                  data-testid={`badge-tx-type-${tx.id}`}
                                >
                                  {isReturn ? (
                                    <RotateCcw className="h-3 w-3" />
                                  ) : isSale ? (
                                    <ShoppingCart className="h-3 w-3" />
                                  ) : isDeposit ? (
                                    <ArrowDownLeft className="h-3 w-3" />
                                  ) : (
                                    <ArrowUpRight className="h-3 w-3" />
                                  )}
                                  {isReturn
                                    ? (t("return") || "Return")
                                    : isSale
                                    ? (t("sale") || "Sale")
                                    : isDeposit
                                    ? (t("deposit") || "Deposit")
                                    : (t("withdrawal") || "Withdrawal")}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {tx.description || "-"}
                              </TableCell>
                              <TableCell>
                                {tx.referenceType && tx.referenceId ? (
                                  <Badge variant="outline" className="font-mono text-xs" data-testid={`badge-tx-ref-${tx.id}`}>
                                    {tx.referenceType}: {tx.referenceId}
                                  </Badge>
                                ) : "-"}
                              </TableCell>
                              <TableCell className={`text-right font-mono font-semibold ${isDeposit ? "text-green-600" : "text-red-600"}`}>
                                {isDeposit ? "+" : "-"}${parseFloat(tx.amountUSD || "0").toFixed(2)}
                              </TableCell>
                              <TableCell className={`text-right font-mono font-semibold text-blue-600`}>
                                {parseFloat(tx.amountLYD || "0").toFixed(2)} LYD
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}