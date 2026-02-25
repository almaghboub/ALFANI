import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DollarSign, Users, Building2, CreditCard, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SalesInvoiceWithItems, CreditPayment, Supplier, Safe } from "@shared/schema";

interface CreditSummary {
  totalReceivables: number;
  totalPayables: number;
  receivablesCount: number;
  payablesCount: number;
}

export default function Credits() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const isRTL = i18n.language === "ar";

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoiceWithItems | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentSafeId, setPaymentSafeId] = useState("");
  const [paymentDescription, setPaymentDescription] = useState("");

  const [isSupplierPaymentDialogOpen, setIsSupplierPaymentDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierPaymentAmount, setSupplierPaymentAmount] = useState("");
  const [supplierPaymentSafeId, setSupplierPaymentSafeId] = useState("");
  const [supplierPaymentDescription, setSupplierPaymentDescription] = useState("");

  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

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

      <Card>
        <CardHeader>
          <CardTitle>{t("customerReceivables")}</CardTitle>
        </CardHeader>
        <CardContent>
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
                  {creditInvoices.map((invoice) => (
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
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedInvoice(invoice);
                              setIsPaymentDialogOpen(true);
                            }}
                            data-testid={`button-record-payment-${invoice.id}`}
                          >
                            {t("recordPayment")}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedInvoiceId === invoice.id && (
                        <TableRow key={`history-${invoice.id}`}>
                          <TableCell colSpan={7} className="bg-muted/50 p-4">
                            <div className="space-y-2">
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

      <Card>
        <CardHeader>
          <CardTitle>{t("supplierPayables")}</CardTitle>
        </CardHeader>
        <CardContent>
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
                  {supplierDebts.map((supplier) => (
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
    </div>
  );
}