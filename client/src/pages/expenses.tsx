import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, DollarSign, Wallet, ArrowUpRight, ArrowDownLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Expense } from "@shared/schema";

interface Safe {
  id: string;
  name: string;
  code: string;
  balanceUSD: number | string;
  balanceLYD: number | string;
  isActive: boolean;
}

export default function Expenses() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const isRTL = i18n.language === "ar";
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<string>("LYD");
  const [transactionType, setTransactionType] = useState<string>("outgoing");
  const [selectedSafeId, setSelectedSafeId] = useState<string>("");
  const [personName, setPersonName] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: safes = [] } = useQuery<Safe[]>({
    queryKey: ["/api/safes"],
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/expenses", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/safes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      toast({ title: t('success'), description: t('expenseAddedSuccess') });
      setIsAddModalOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: t('error'), description: t('failedAddExpense'), variant: "destructive" });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: t('success'), description: t('expenseDeletedSuccess') });
    },
    onError: () => {
      toast({ title: t('error'), description: t('failedDeleteExpense'), variant: "destructive" });
    },
  });

  const resetForm = () => {
    setSelectedCategory("");
    setAmount("");
    setCurrency("LYD");
    setTransactionType("outgoing");
    setSelectedSafeId("");
    setPersonName("");
    setDescription("");
    setExpenseDate(new Date().toISOString().split('T')[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCategory || !amount || !personName || !selectedSafeId) {
      toast({
        title: t('validationError'),
        description: t('fillAllRequired') || 'Please fill all required fields including cashbox',
        variant: "destructive",
      });
      return;
    }

    createExpenseMutation.mutate({
      category: selectedCategory,
      amount: amount,
      currency: currency,
      transactionType: transactionType,
      safeId: selectedSafeId,
      personName: personName,
      description: description || undefined,
      date: expenseDate,
    });
  };

  const getCategoryLabel = (category: string) => {
    const categoryMap: Record<string, string> = {
      employee_salaries: t('employeeSalaries'),
      supplier_expenses: t('supplierExpenses'),
      marketing_commission: t('marketingCommission'),
      rent: t('rent'),
      cleaning_salaries: t('cleaningSalaries'),
      other: t('otherExpenses'),
    };
    return categoryMap[category] || category;
  };

  const getSafeName = (safeId: string | null) => {
    if (!safeId) return "-";
    const safe = safes.find(s => s.id === safeId);
    return safe ? safe.name : "-";
  };

  const totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);

  const printExpenseReceipt = (expense: Expense) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html dir="${isRTL ? 'rtl' : 'ltr'}">
      <head><title>${t('expenseReceipt')}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
        .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .label { font-weight: bold; color: #555; }
        .amount { font-size: 24px; text-align: center; margin: 20px 0; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #888; }
        @media print { body { padding: 0; } }
      </style></head>
      <body>
        <div class="header">
          <h2>ALFANI</h2>
          <p>${t('expenseReceipt')}</p>
        </div>
        <div class="amount">${(expense as any).currency === 'LYD' ? '' : '$'}${parseFloat(expense.amount).toFixed(2)} ${(expense as any).currency || 'USD'}</div>
        <div class="row"><span class="label">${t('date')}:</span><span>${new Date(expense.date).toLocaleDateString()}</span></div>
        <div class="row"><span class="label">${t('category')}:</span><span>${getCategoryLabel(expense.category)}</span></div>
        <div class="row"><span class="label">${t('personName')}:</span><span>${expense.personName}</span></div>
        <div class="row"><span class="label">${t('type')}:</span><span>${(expense as any).transactionType === 'incoming' ? t('incoming') : t('outgoing')}</span></div>
        <div class="row"><span class="label">${t('cashbox')}:</span><span>${getSafeName((expense as any).safeId)}</span></div>
        ${expense.description ? `<div class="row"><span class="label">${t('description')}:</span><span>${expense.description}</span></div>` : ''}
        <div class="footer"><p>${new Date().toLocaleString()}</p></div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6 p-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t('expenses')}</h1>
          <p className="text-muted-foreground">{t('expensesDescription')}</p>
        </div>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-expense">
              <Plus className="mr-2 h-4 w-4" />
              {t('addExpense')}
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="modal-add-expense" className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('addNewExpense')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('transactionType')} *</Label>
                  <Select value={transactionType} onValueChange={setTransactionType}>
                    <SelectTrigger data-testid="select-transaction-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="outgoing">
                        <span className="flex items-center gap-2">
                          <ArrowUpRight className="h-3 w-3 text-red-500" />
                          {t('outgoing')}
                        </span>
                      </SelectItem>
                      <SelectItem value="incoming">
                        <span className="flex items-center gap-2">
                          <ArrowDownLeft className="h-3 w-3 text-green-500" />
                          {t('incoming')}
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('currency')} *</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger data-testid="select-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LYD">{isRTL ? "د.ل" : "LYD"}</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>{t('cashbox')} *</Label>
                <Select value={selectedSafeId} onValueChange={setSelectedSafeId}>
                  <SelectTrigger data-testid="select-safe">
                    <SelectValue placeholder={t('selectCashbox')} />
                  </SelectTrigger>
                  <SelectContent>
                    {safes.filter(s => s.isActive).map(safe => (
                      <SelectItem key={safe.id} value={safe.id}>
                        <span className="flex items-center gap-2">
                          <Wallet className="h-3 w-3" />
                          {safe.name} ({safe.code})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('expenseCategory')} *</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder={t('selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee_salaries">{t('employeeSalaries')}</SelectItem>
                    <SelectItem value="supplier_expenses">{t('supplierExpenses')}</SelectItem>
                    <SelectItem value="marketing_commission">{t('marketingCommission')}</SelectItem>
                    <SelectItem value="rent">{t('rent')}</SelectItem>
                    <SelectItem value="cleaning_salaries">{t('cleaningSalaries')}</SelectItem>
                    <SelectItem value="other">{t('otherExpenses')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('amount')} ({currency}) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={t('enterAmount')}
                  data-testid="input-amount"
                  required
                />
              </div>

              <div>
                <Label>{t('personName')} *</Label>
                <Input
                  type="text"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder={t('enterPersonName') || 'Enter person name'}
                  data-testid="input-person-name"
                  required
                />
              </div>

              <div>
                <Label>{t('date')} *</Label>
                <Input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  data-testid="input-date"
                  required
                />
              </div>

              <div>
                <Label>{t('descriptionOptional')}</Label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full min-h-[80px] p-3 border rounded-md resize-none bg-background"
                  placeholder={t('addDescription')}
                  data-testid="textarea-description"
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={createExpenseMutation.isPending} data-testid="button-submit">
                  {createExpenseMutation.isPending ? t('adding') : t('addExpense')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalExpenses')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-total-expenses">
              ${totalExpenses.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('outgoing')}</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {expenses.filter(e => (e as any).transactionType !== 'incoming').length}
            </div>
            <p className="text-xs text-muted-foreground">{t('transactions')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('incoming')}</CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {expenses.filter(e => (e as any).transactionType === 'incoming').length}
            </div>
            <p className="text-xs text-muted-foreground">{t('transactions')}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('expensesList')}</CardTitle>
          <CardDescription>{t('manageAllExpenses')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">{t('loadingExpenses')}</div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t('noExpensesFound')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('date')}</TableHead>
                    <TableHead>{t('type')}</TableHead>
                    <TableHead>{t('category')}</TableHead>
                    <TableHead>{t('personName')}</TableHead>
                    <TableHead>{t('cashbox')}</TableHead>
                    <TableHead>{t('currency')}</TableHead>
                    <TableHead className="text-right">{t('amount')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id} data-testid={`row-expense-${expense.id}`}>
                      <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={(expense as any).transactionType === 'incoming' ? 'default' : 'destructive'}>
                          {(expense as any).transactionType === 'incoming' ? (
                            <span className="flex items-center gap-1"><ArrowDownLeft className="h-3 w-3" /> {t('incoming')}</span>
                          ) : (
                            <span className="flex items-center gap-1"><ArrowUpRight className="h-3 w-3" /> {t('outgoing')}</span>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>{getCategoryLabel(expense.category)}</TableCell>
                      <TableCell>{expense.personName}</TableCell>
                      <TableCell>{getSafeName((expense as any).safeId)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{(expense as any).currency || 'USD'}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {(expense as any).currency === 'LYD' ? '' : '$'}{parseFloat(expense.amount).toFixed(2)} {(expense as any).currency === 'LYD' ? (isRTL ? 'د.ل' : 'LYD') : ''}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => printExpenseReceipt(expense)}
                            data-testid={`button-print-${expense.id}`}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteExpenseMutation.mutate(expense.id)}
                            data-testid={`button-delete-${expense.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
