import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DollarSign, Users, Building2, CreditCard, ChevronDown, ChevronUp, Search, Pencil, RotateCcw, Minus, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/components/auth-provider";
import type { SalesInvoiceWithItems, CreditPayment, Supplier, Safe, ProductWithInventory } from "@shared/schema";

type EditItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  isNew?: boolean;
};

interface CreditSummary {
  totalReceivables: number;
  totalPayables: number;
  receivablesCount: number;
  payablesCount: number;
}

export default function Credits() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isRTL = i18n.language === "ar";

  // ── payment dialog ──────────────────────────────────────────────
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoiceWithItems | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentSafeId, setPaymentSafeId] = useState("");
  const [paymentDescription, setPaymentDescription] = useState("");

  // ── supplier payment dialog ─────────────────────────────────────
  const [isSupplierPaymentDialogOpen, setIsSupplierPaymentDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierPaymentAmount, setSupplierPaymentAmount] = useState("");
  const [supplierPaymentSafeId, setSupplierPaymentSafeId] = useState("");
  const [supplierPaymentDescription, setSupplierPaymentDescription] = useState("");

  // ── edit dialog ─────────────────────────────────────────────────
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState<SalesInvoiceWithItems | null>(null);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editBranch, setEditBranch] = useState<"ALFANI1" | "ALFANI2">("ALFANI1");
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [editProductSearch, setEditProductSearch] = useState("");
  const [editSearchDebounced, setEditSearchDebounced] = useState("");
  const [showEditProductResults, setShowEditProductResults] = useState(false);
  const editSearchRef = useRef<HTMLDivElement>(null);

  // ── return dialog ───────────────────────────────────────────────
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [returnInvoice, setReturnInvoice] = useState<SalesInvoiceWithItems | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});

  // ── misc state ──────────────────────────────────────────────────
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");

  // ── debounce for product search ─────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setEditSearchDebounced(editProductSearch), 300);
    return () => clearTimeout(timer);
  }, [editProductSearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editSearchRef.current && !editSearchRef.current.contains(e.target as Node)) {
        setShowEditProductResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── queries ─────────────────────────────────────────────────────
  const { data: summary } = useQuery<CreditSummary>({
    queryKey: ["/api/credit/summary"],
  });

  const { data: creditInvoices = [], isLoading: loadingInvoices } = useQuery<SalesInvoiceWithItems[]>({
    queryKey: ["/api/credit/invoices"],
  });

  const { data: supplierDebts = [], isLoading: loadingSuppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/credit/supplier-debts"],
  });

  const { data: safes = [] } = useQuery<Safe[]>({
    queryKey: ["/api/safes"],
  });

  const { data: paymentHistory = [] } = useQuery<CreditPayment[]>({
    queryKey: ["/api/credit/payments", expandedInvoiceId],
    queryFn: async () => {
      if (!expandedInvoiceId) return [];
      const res = await fetch(`/api/credit/payments/${expandedInvoiceId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!expandedInvoiceId,
  });

  const { data: editSearchResults = [] } = useQuery<ProductWithInventory[]>({
    queryKey: ["/api/products/search", editSearchDebounced],
    queryFn: async () => {
      if (!editSearchDebounced) return [];
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(editSearchDebounced)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: editSearchDebounced.length >= 1 && isEditDialogOpen,
    staleTime: 5000,
  });

  // ── mutations ────────────────────────────────────────────────────
  const recordPaymentMutation = useMutation({
    mutationFn: async (data: { invoiceId: string; amount: string; paymentMethod: string; safeId?: string; description?: string }) => {
      return await apiRequest("POST", "/api/credit/payments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credit/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credit/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credit/payments", expandedInvoiceId] });
      queryClient.invalidateQueries({ queryKey: ["/api/safes"] });
      toast({ title: t("success"), description: t("creditPaymentRecorded") });
      closePaymentDialog();
    },
    onError: () => {
      toast({ title: t("error"), description: t("failedRecordPayment"), variant: "destructive" });
    },
  });

  const supplierPaymentMutation = useMutation({
    mutationFn: async (data: { supplierId: string; amount: string; safeId?: string; description?: string }) => {
      return await apiRequest("POST", "/api/credit/supplier-payments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credit/supplier-debts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credit/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/safes"] });
      toast({ title: t("success"), description: t("supplierPaymentRecorded") });
      closeSupplierPaymentDialog();
    },
    onError: () => {
      toast({ title: t("error"), description: t("failedRecordSupplierPayment"), variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/invoices/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credit/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credit/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/with-inventory"], refetchType: "all" });
      setIsEditDialogOpen(false);
      setEditItems([]);
      setEditProductSearch("");
      toast({ title: t("invoiceUpdated") });
    },
    onError: (error: any) => {
      toast({ title: t("error"), description: error?.message || "Failed to update invoice", variant: "destructive" });
    },
  });

  const returnMutation = useMutation({
    mutationFn: async ({ id, returnItems }: { id: string; returnItems: Array<{ itemId: string; quantity: number }> }) => {
      const idempotencyKey = `ret-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const res = await fetch(`/api/invoices/${id}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ returnItems }),
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || `Error ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credit/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credit/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credit/payments", expandedInvoiceId] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/with-inventory"], refetchType: "all" });
      setIsReturnDialogOpen(false);
      setReturnInvoice(null);
      setReturnQuantities({});
      toast({ title: t("returnSuccess") });
    },
    onError: (error: any) => {
      toast({ title: t("error"), description: error?.message || "Failed to process return", variant: "destructive" });
    },
  });

  // ── helpers ──────────────────────────────────────────────────────
  const closePaymentDialog = () => {
    setIsPaymentDialogOpen(false);
    setSelectedInvoice(null);
    setPaymentAmount("");
    setPaymentMethod("cash");
    setPaymentSafeId("");
    setPaymentDescription("");
  };

  const closeSupplierPaymentDialog = () => {
    setIsSupplierPaymentDialogOpen(false);
    setSelectedSupplier(null);
    setSupplierPaymentAmount("");
    setSupplierPaymentSafeId("");
    setSupplierPaymentDescription("");
  };

  const handleRecordPayment = () => {
    if (!selectedInvoice || !paymentAmount) return;
    recordPaymentMutation.mutate({
      invoiceId: selectedInvoice.id,
      amount: paymentAmount,
      paymentMethod,
      safeId: paymentSafeId || undefined,
      description: paymentDescription || undefined,
    });
  };

  const handleSupplierPayment = () => {
    if (!selectedSupplier || !supplierPaymentAmount) return;
    supplierPaymentMutation.mutate({
      supplierId: selectedSupplier.id,
      amount: supplierPaymentAmount,
      safeId: supplierPaymentSafeId || undefined,
      description: supplierPaymentDescription || undefined,
    });
  };

  // ── edit handlers ─────────────────────────────────────────────────
  const handleEditInvoice = (invoice: SalesInvoiceWithItems) => {
    setEditInvoice(invoice);
    setEditCustomerName(invoice.customerName);
    setEditBranch(invoice.branch as "ALFANI1" | "ALFANI2");
    setEditItems(invoice.items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    })));
    setEditProductSearch("");
    setShowEditProductResults(false);
    setIsEditDialogOpen(true);
  };

  const handleEditSave = () => {
    if (!editInvoice || editItems.length === 0) return;
    editMutation.mutate({
      id: editInvoice.id,
      data: {
        customerName: editCustomerName,
        branch: editBranch,
        items: editItems.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      },
    });
  };

  const handleEditAddProduct = (product: ProductWithInventory) => {
    const existing = editItems.find(i => i.productId === product.id);
    if (existing) {
      setEditItems(prev => prev.map(i =>
        i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setEditItems(prev => [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: Number(product.price),
        isNew: true,
      }]);
    }
    setEditProductSearch("");
    setShowEditProductResults(false);
  };

  const handleEditRemoveItem = (productId: string) => {
    setEditItems(prev => prev.filter(i => i.productId !== productId));
  };

  const handleEditQuantityChange = (productId: string, newQty: number) => {
    if (newQty <= 0) { handleEditRemoveItem(productId); return; }
    setEditItems(prev => prev.map(i =>
      i.productId === productId ? { ...i, quantity: newQty } : i
    ));
  };

  const editTotal = editItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  // ── return handlers ───────────────────────────────────────────────
  const handleReturnClick = (invoice: SalesInvoiceWithItems) => {
    setReturnInvoice(invoice);
    const quantities: Record<string, number> = {};
    invoice.items.forEach(item => { quantities[item.id] = 0; });
    setReturnQuantities(quantities);
    setIsReturnDialogOpen(true);
  };

  const handleReturnProcess = () => {
    if (!returnInvoice) return;
    const returnItems = Object.entries(returnQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, quantity]) => ({ itemId, quantity }));
    if (returnItems.length === 0) {
      toast({ title: t("noItemsToReturn"), variant: "destructive" });
      return;
    }
    returnMutation.mutate({ id: returnInvoice.id, returnItems });
  };

  // ── filtering & summary ──────────────────────────────────────────
  const filteredCreditInvoices = creditInvoices.filter(inv =>
    inv.invoiceNumber.toLowerCase().includes(customerSearch.toLowerCase()) ||
    inv.customerName.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const customerSummaryData = customerSearch.trim() && filteredCreditInvoices.length > 0 ? {
    invoicesCount: filteredCreditInvoices.length,
    customerNames: [...new Set(filteredCreditInvoices.map(inv => inv.customerName))],
    totalAmount: filteredCreditInvoices.reduce((s, inv) => s + Number(inv.totalAmount), 0),
    totalPaid: filteredCreditInvoices.reduce((s, inv) => s + Number(inv.paidAmount ?? 0), 0),
    totalRemaining: filteredCreditInvoices.reduce((s, inv) => s + Number(inv.remainingAmount ?? 0), 0),
  } : null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "unpaid":
        return <Badge variant="destructive" data-testid="badge-unpaid">{t("unpaid")}</Badge>;
      case "partially_paid":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white" data-testid="badge-partially-paid">{t("partiallyPaid")}</Badge>;
      case "paid":
        return <Badge className="bg-green-500 hover:bg-green-600 text-white" data-testid="badge-paid">{t("paid")}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const togglePaymentHistory = (invoiceId: string) => {
    setExpandedInvoiceId(prev => prev === invoiceId ? null : invoiceId);
  };

  return (
    <div className="space-y-6 p-6" dir={isRTL ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">{t("creditsDebts")}</h1>
        <p className="text-muted-foreground" data-testid="text-page-description">{t("creditsDebtsDescription")}</p>
      </div>

      {/* ─── Summary cards ─────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("totalReceivables")}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-total-receivables">
              {(summary?.totalReceivables ?? 0).toFixed(2)} LYD
            </div>
            <p className="text-xs text-muted-foreground">{t("moneyCustomersOwe")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("totalPayables")}</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600" data-testid="text-total-payables">
              {(summary?.totalPayables ?? 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">{t("moneyOwedToSuppliers")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("unpaidInvoices")}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-receivables-count">
              {summary?.receivablesCount ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">{t("invoicesAwaitingPayment")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("suppliersWithDebt")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-payables-count">
              {summary?.payablesCount ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">{t("suppliersWithBalance")}</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Customer Receivables ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>{t("customerReceivables")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchInvoices")}
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="ltr:pl-10 rtl:pr-10"
                data-testid="input-search-customer-receivables"
              />
            </div>
          </div>

          {/* Customer Summary Card */}
          {customerSummaryData && (
            <div className="mb-4 p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" data-testid="card-customer-summary">
              <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                {t("customerSummary")}
                {customerSummaryData.customerNames.length === 1 && (
                  <span className="font-bold">— {customerSummaryData.customerNames[0]}</span>
                )}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="text-center p-2 rounded bg-white/60 dark:bg-black/20">
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{customerSummaryData.invoicesCount}</div>
                  <div className="text-xs text-muted-foreground">{t("unpaidInvoices")}</div>
                </div>
                <div className="text-center p-2 rounded bg-white/60 dark:bg-black/20">
                  <div className="text-lg font-bold text-gray-700 dark:text-gray-300">{customerSummaryData.totalAmount.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">{t("totalAmount")} (LYD)</div>
                </div>
                <div className="text-center p-2 rounded bg-white/60 dark:bg-black/20">
                  <div className="text-lg font-bold text-green-700 dark:text-green-300">{customerSummaryData.totalPaid.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">{t("paidAmount")} (LYD)</div>
                </div>
                <div className="text-center p-2 rounded bg-white/60 dark:bg-black/20">
                  <div className="text-lg font-bold text-red-700 dark:text-red-300">{customerSummaryData.totalRemaining.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">{t("remainingAmount")} (LYD)</div>
                </div>
              </div>
            </div>
          )}

          {loadingInvoices ? (
            <div className="text-center py-8" data-testid="text-loading-invoices">{t("loading")}</div>
          ) : creditInvoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-credit-invoices">
              {t("noCreditInvoices")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("invoiceNumber")}</TableHead>
                    <TableHead>{t("customerName")}</TableHead>
                    <TableHead className="text-right">{t("totalAmount")}</TableHead>
                    <TableHead className="text-right">{t("paidAmount")}</TableHead>
                    <TableHead className="text-right">{t("remainingAmount")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCreditInvoices.map((invoice) => (
                    <>
                      <TableRow key={invoice.id} data-testid={`row-credit-invoice-${invoice.id}`} className="cursor-pointer" onClick={() => togglePaymentHistory(invoice.id)}>
                        <TableCell className="font-medium" data-testid={`text-invoice-number-${invoice.id}`}>
                          <div className="flex items-center gap-2">
                            {expandedInvoiceId === invoice.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            {invoice.invoiceNumber}
                          </div>
                        </TableCell>
                        <TableCell data-testid={`text-customer-name-${invoice.id}`}>{invoice.customerName}</TableCell>
                        <TableCell className="text-right" data-testid={`text-total-amount-${invoice.id}`}>
                          {Number(invoice.totalAmount).toFixed(2)} LYD
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-paid-amount-${invoice.id}`}>
                          {Number(invoice.paidAmount ?? 0).toFixed(2)} LYD
                        </TableCell>
                        <TableCell className="text-right font-semibold" data-testid={`text-remaining-amount-${invoice.id}`}>
                          {Number(invoice.remainingAmount ?? 0).toFixed(2)} LYD
                        </TableCell>
                        <TableCell>{getStatusBadge(invoice.paymentStatus ?? "unpaid")}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setIsPaymentDialogOpen(true);
                              }}
                              data-testid={`button-record-payment-${invoice.id}`}
                            >
                              {t("recordPayment")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditInvoice(invoice)}
                              data-testid={`button-edit-invoice-${invoice.id}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-amber-600 border-amber-300 hover:bg-amber-50"
                              onClick={() => handleReturnClick(invoice)}
                              data-testid={`button-return-invoice-${invoice.id}`}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedInvoiceId === invoice.id && (
                        <TableRow key={`history-${invoice.id}`}>
                          <TableCell colSpan={7} className="bg-muted/50 p-4">
                            <div className="space-y-3">
                              {/* Invoice items */}
                              <div>
                                <h4 className="font-semibold text-sm mb-2">{t("invoiceItems")}</h4>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>{t("product")}</TableHead>
                                      <TableHead className="text-right">{t("quantity")}</TableHead>
                                      <TableHead className="text-right">{t("unitPrice")}</TableHead>
                                      <TableHead className="text-right">{t("total")}</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {invoice.items.map(item => (
                                      <TableRow key={item.id}>
                                        <TableCell>{item.productName}</TableCell>
                                        <TableCell className="text-right">{Number(item.quantity)}</TableCell>
                                        <TableCell className="text-right">{Number(item.unitPrice).toFixed(2)} LYD</TableCell>
                                        <TableCell className="text-right">{Number(item.lineTotal).toFixed(2)} LYD</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                              {/* Payment history */}
                              <div>
                                <h4 className="font-semibold text-sm">{t("paymentHistory")}</h4>
                                {paymentHistory.length === 0 ? (
                                  <p className="text-sm text-muted-foreground" data-testid="text-no-payments">{t("noPaymentsYet")}</p>
                                ) : (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>{t("date")}</TableHead>
                                        <TableHead className="text-right">{t("amount")}</TableHead>
                                        <TableHead>{t("paymentMethodLabel")}</TableHead>
                                        <TableHead>{t("description")}</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {paymentHistory.map((payment) => (
                                        <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                                          <TableCell>{new Date(payment.createdAt).toLocaleDateString()}</TableCell>
                                          <TableCell className="text-right font-semibold">{Number(payment.amount).toFixed(2)} LYD</TableCell>
                                          <TableCell>{t(payment.paymentMethod ?? "cash")}</TableCell>
                                          <TableCell>{payment.description || "-"}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Supplier Payables ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>{t("supplierPayables")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchSuppliers")}
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                className="ltr:pl-10 rtl:pr-10"
                data-testid="input-search-supplier-debts"
              />
            </div>
          </div>
          {loadingSuppliers ? (
            <div className="text-center py-8" data-testid="text-loading-suppliers">{t("loading")}</div>
          ) : supplierDebts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-supplier-debts">
              {t("noSupplierDebts")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("supplierName")}</TableHead>
                    <TableHead>{t("supplierCode")}</TableHead>
                    <TableHead className="text-right">{t("balanceOwed")}</TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierDebts.filter(s =>
                    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
                    (s.code ?? "").toLowerCase().includes(supplierSearch.toLowerCase())
                  ).map((supplier) => (
                    <TableRow key={supplier.id} data-testid={`row-supplier-debt-${supplier.id}`}>
                      <TableCell className="font-medium" data-testid={`text-supplier-name-${supplier.id}`}>{supplier.name}</TableCell>
                      <TableCell data-testid={`text-supplier-code-${supplier.id}`}>{supplier.code}</TableCell>
                      <TableCell className="text-right font-semibold text-orange-600" data-testid={`text-balance-owed-${supplier.id}`}>
                        {Number(supplier.balanceOwed).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedSupplier(supplier);
                            setIsSupplierPaymentDialogOpen(true);
                          }}
                          data-testid={`button-pay-supplier-${supplier.id}`}
                        >
                          {t("paySupplier")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Record Payment Dialog ──────────────────────────────────── */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={(open) => { if (!open) closePaymentDialog(); }}>
        <DialogContent data-testid="dialog-record-payment">
          <DialogHeader>
            <DialogTitle>{t("recordPayment")}</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-md space-y-1">
                <p className="text-sm"><span className="font-medium">{t("invoiceNumber")}:</span> {selectedInvoice.invoiceNumber}</p>
                <p className="text-sm"><span className="font-medium">{t("customerName")}:</span> {selectedInvoice.customerName}</p>
                <p className="text-sm"><span className="font-medium">{t("remainingAmount")}:</span> {Number(selectedInvoice.remainingAmount ?? 0).toFixed(2)} LYD</p>
              </div>
              <div>
                <Label>{t("amount")} (LYD) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={Number(selectedInvoice.remainingAmount ?? 0)}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={t("enterAmount")}
                  data-testid="input-payment-amount"
                />
              </div>
              <div>
                <Label>{t("paymentMethodLabel")}</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger data-testid="select-payment-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t("cash")}</SelectItem>
                    <SelectItem value="bank_transfer">{t("bankTransfer")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("cashbox")} ({t("optional")})</Label>
                <Select value={paymentSafeId} onValueChange={setPaymentSafeId}>
                  <SelectTrigger data-testid="select-payment-safe">
                    <SelectValue placeholder={t("selectCashbox")} />
                  </SelectTrigger>
                  <SelectContent>
                    {safes.filter((s: any) => s.isActive).map((safe: any) => (
                      <SelectItem key={safe.id} value={safe.id}>{safe.name} ({safe.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("description")} ({t("optional")})</Label>
                <Input
                  value={paymentDescription}
                  onChange={(e) => setPaymentDescription(e.target.value)}
                  placeholder={t("addDescription")}
                  data-testid="input-payment-description"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closePaymentDialog} data-testid="button-cancel-payment">{t("cancel")}</Button>
                <Button
                  onClick={handleRecordPayment}
                  disabled={!paymentAmount || recordPaymentMutation.isPending}
                  data-testid="button-submit-payment"
                >
                  {recordPaymentMutation.isPending ? t("loading") : t("recordPayment")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Supplier Payment Dialog ────────────────────────────────── */}
      <Dialog open={isSupplierPaymentDialogOpen} onOpenChange={(open) => { if (!open) closeSupplierPaymentDialog(); }}>
        <DialogContent data-testid="dialog-pay-supplier">
          <DialogHeader>
            <DialogTitle>{t("paySupplier")}</DialogTitle>
          </DialogHeader>
          {selectedSupplier && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-md space-y-1">
                <p className="text-sm"><span className="font-medium">{t("supplierName")}:</span> {selectedSupplier.name}</p>
                <p className="text-sm"><span className="font-medium">{t("balanceOwed")}:</span> {Number(selectedSupplier.balanceOwed).toFixed(2)}</p>
              </div>
              <div>
                <Label>{t("amount")} *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={Number(selectedSupplier.balanceOwed)}
                  value={supplierPaymentAmount}
                  onChange={(e) => setSupplierPaymentAmount(e.target.value)}
                  placeholder={t("enterAmount")}
                  data-testid="input-supplier-payment-amount"
                />
              </div>
              <div>
                <Label>{t("cashbox")} ({t("optional")})</Label>
                <Select value={supplierPaymentSafeId} onValueChange={setSupplierPaymentSafeId}>
                  <SelectTrigger data-testid="select-supplier-payment-safe">
                    <SelectValue placeholder={t("selectCashbox")} />
                  </SelectTrigger>
                  <SelectContent>
                    {safes.filter((s: any) => s.isActive).map((safe: any) => (
                      <SelectItem key={safe.id} value={safe.id}>{safe.name} ({safe.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("description")} ({t("optional")})</Label>
                <Input
                  value={supplierPaymentDescription}
                  onChange={(e) => setSupplierPaymentDescription(e.target.value)}
                  placeholder={t("addDescription")}
                  data-testid="input-supplier-payment-description"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeSupplierPaymentDialog} data-testid="button-cancel-supplier-payment">{t("cancel")}</Button>
                <Button
                  onClick={handleSupplierPayment}
                  disabled={!supplierPaymentAmount || supplierPaymentMutation.isPending}
                  data-testid="button-submit-supplier-payment"
                >
                  {supplierPaymentMutation.isPending ? t("loading") : t("paySupplier")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Edit Invoice Dialog ────────────────────────────────────── */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) { setEditItems([]); setEditProductSearch(""); setShowEditProductResults(false); }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              {t("editInvoice")}
            </DialogTitle>
            <DialogDescription>
              {editInvoice?.invoiceNumber} — {editInvoice?.customerName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{t("customerName")}</Label>
                <Input
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  data-testid="input-edit-credit-customer-name"
                />
              </div>
              <div>
                <Label>{t("branch")}</Label>
                <Select value={editBranch} onValueChange={(v) => setEditBranch(v as "ALFANI1" | "ALFANI2")}>
                  <SelectTrigger data-testid="select-edit-credit-branch">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALFANI1">ALFANI 1</SelectItem>
                    <SelectItem value="ALFANI2">ALFANI 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t pt-4">
              <Label className="text-base font-semibold">{t("invoiceItems")}</Label>
              <div className="border rounded-md mt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("product")}</TableHead>
                      <TableHead className="text-center w-[160px]">{t("quantity")}</TableHead>
                      <TableHead className="text-center">{t("unitPrice")}</TableHead>
                      <TableHead className="text-center">{t("total")}</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editItems.map((item) => (
                      <TableRow key={item.productId} className={item.isNew ? "bg-green-50 dark:bg-green-950/20" : ""}>
                        <TableCell>
                          <span className="font-medium">{item.productName}</span>
                          {item.isNew && <Badge variant="outline" className="ml-2 text-xs text-green-600 border-green-300">{t("new")}</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button size="icon" variant="outline" className="h-7 w-7"
                              onClick={() => handleEditQuantityChange(item.productId, item.quantity - 1)}
                              data-testid={`button-credit-edit-qty-minus-${item.productId}`}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              min={0.001}
                              step="any"
                              value={item.quantity}
                              onChange={(e) => handleEditQuantityChange(item.productId, parseFloat(e.target.value) || 0)}
                              className="w-20 text-center h-7"
                              data-testid={`input-credit-edit-qty-${item.productId}`}
                            />
                            <Button size="icon" variant="outline" className="h-7 w-7"
                              onClick={() => handleEditQuantityChange(item.productId, item.quantity + 1)}
                              data-testid={`button-credit-edit-qty-plus-${item.productId}`}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{item.unitPrice.toFixed(2)} LYD</TableCell>
                        <TableCell className="text-center font-semibold">{(item.quantity * item.unitPrice).toFixed(2)} LYD</TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700"
                            onClick={() => handleEditRemoveItem(item.productId)}
                            data-testid={`button-credit-edit-remove-${item.productId}`}>
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {editItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-6">{t("noItems")}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="relative" ref={editSearchRef}>
              <Label>{t("addProduct")}</Label>
              <div className="relative mt-1">
                <Search className="absolute ltr:left-2.5 rtl:right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={editProductSearch}
                  onChange={(e) => { setEditProductSearch(e.target.value); setShowEditProductResults(true); }}
                  onFocus={() => { if (editProductSearch.length >= 1) setShowEditProductResults(true); }}
                  placeholder={t("searchProducts")}
                  className="ltr:pl-9 rtl:pr-9"
                  data-testid="input-credit-edit-add-product"
                />
              </div>
              {showEditProductResults && editSearchDebounced.length >= 1 && editSearchResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {editSearchResults
                    .filter(p => !editItems.find(i => i.productId === p.id))
                    .map(product => {
                      const branchInv = product.inventory?.find((inv: any) => inv.branch === editBranch);
                      const stock = parseFloat(String(branchInv?.quantity || 0)) || 0;
                      return (
                        <button
                          key={product.id}
                          className="w-full text-left px-3 py-2 hover:bg-accent flex items-center justify-between text-sm"
                          onClick={() => handleEditAddProduct(product)}
                          data-testid={`button-credit-edit-add-${product.id}`}
                        >
                          <span className="font-medium">{product.name}</span>
                          <span className="text-muted-foreground text-xs">
                            {Number(product.price).toFixed(2)} LYD | {t("stock")}: {stock}
                          </span>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-sm text-muted-foreground">{editItems.length} {t("items")}</span>
              <span className="text-xl font-bold">{editTotal.toFixed(2)} LYD</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} data-testid="button-cancel-credit-edit">{t("cancel")}</Button>
            <Button
              onClick={handleEditSave}
              disabled={editMutation.isPending || !editCustomerName.trim() || editItems.length === 0}
              data-testid="button-save-credit-edit"
            >
              {editMutation.isPending ? t("loading") : t("saveChanges")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Return Dialog ──────────────────────────────────────────── */}
      <Dialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-600" />
              {t("returnProducts")}
            </DialogTitle>
            <DialogDescription>{t("returnProductsDesc")}</DialogDescription>
          </DialogHeader>
          {returnInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-3 bg-muted rounded-md">
                <div>
                  <p className="text-xs text-muted-foreground">{t("invoiceNumber")}</p>
                  <p className="font-mono text-sm">{returnInvoice.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("customerName")}</p>
                  <p className="text-sm">{returnInvoice.customerName}</p>
                </div>
              </div>

              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("product")}</TableHead>
                      <TableHead className="text-center">{t("quantity")}</TableHead>
                      <TableHead className="text-center">{t("unitPrice")}</TableHead>
                      <TableHead className="text-center">{t("returnQuantity")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returnInvoice.items.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell className="text-center">{Number(item.quantity)}</TableCell>
                        <TableCell className="text-center">{Number(item.unitPrice).toFixed(2)} LYD</TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            max={Number(item.quantity)}
                            value={returnQuantities[item.id] || 0}
                            onChange={(e) => {
                              const val = Math.min(Math.max(0, parseFloat(e.target.value) || 0), Number(item.quantity));
                              setReturnQuantities(prev => ({ ...prev, [item.id]: val }));
                            }}
                            className="w-24 text-center mx-auto"
                            data-testid={`input-credit-return-qty-${item.id}`}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {Object.values(returnQuantities).some(q => q > 0) && (
                    <span className="text-amber-700 font-medium">
                      {t("returnProducts").toLowerCase()}:{" "}
                      {returnInvoice.items
                        .filter(item => (returnQuantities[item.id] || 0) > 0)
                        .map(item => `${item.productName} × ${returnQuantities[item.id]}`)
                        .join(", ")}
                    </span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const allMax: Record<string, number> = {};
                    returnInvoice.items.forEach(item => { allMax[item.id] = Number(item.quantity); });
                    setReturnQuantities(allMax);
                  }}
                  data-testid="button-credit-return-all"
                >
                  {t("fullReturn")}
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReturnDialogOpen(false)} data-testid="button-cancel-credit-return">{t("cancel")}</Button>
            <Button
              onClick={handleReturnProcess}
              disabled={returnMutation.isPending || Object.values(returnQuantities).every(q => q === 0)}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="button-confirm-credit-return"
            >
              {returnMutation.isPending ? t("loading") : t("processReturn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
