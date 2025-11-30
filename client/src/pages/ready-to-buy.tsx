import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShoppingCart, Search, Eye, Edit, CheckCircle } from "lucide-react";
import { useLydExchangeRate } from "@/hooks/use-lyd-exchange-rate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Header } from "@/components/header";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { OrderWithCustomer, OrderItem } from "@shared/schema";
import { format } from "date-fns";

export default function ReadyToBuy() {
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<OrderWithCustomer | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isOrderIdDialogOpen, setIsOrderIdDialogOpen] = useState(false);
  const [orderIdInput, setOrderIdInput] = useState("");
  const [pendingAction, setPendingAction] = useState<{ type: 'edit' | 'mark_bought'; order: OrderWithCustomer } | null>(null);
  const [editingOrder, setEditingOrder] = useState<OrderWithCustomer | null>(null);
  const [editOrderItems, setEditOrderItems] = useState<OrderItem[]>([]);
  const [editFormData, setEditFormData] = useState({
    status: "",
    trackingNumber: "",
    notes: "",
    totalAmount: "",
    downPayment: "",
    remainingBalance: "",
    shippingCost: "",
    shippingWeight: "",
    shippingCountry: "",
    shippingCity: "",
  });
  const { exchangeRate } = useLydExchangeRate();
  const { toast } = useToast();

  const { data: orders = [], isLoading } = useQuery<OrderWithCustomer[]>({
    queryKey: ["/api/orders"],
  });

  const markAsProcessingMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await apiRequest("PATCH", `/api/orders/${orderId}`, {
        status: "processing",
      });
      if (!response.ok) {
        throw new Error("Failed to update order status");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: t('success'),
        description: t('orderMarkedAsProcessing'),
      });
      setIsOrderIdDialogOpen(false);
      setPendingAction(null);
      setOrderIdInput("");
    },
    onError: () => {
      toast({
        title: t('error'),
        description: t('failedToUpdateOrderStatus'),
        variant: "destructive",
      });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, data }: { orderId: string; data: any }) => {
      const response = await apiRequest("PUT", `/api/orders/${orderId}`, data);
      if (!response.ok) {
        throw new Error("Failed to update order");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: t('success'),
        description: t('orderUpdatedSuccessfully'),
      });
      setIsEditDialogOpen(false);
      setEditingOrder(null);
      setIsOrderIdDialogOpen(false);
      setPendingAction(null);
      setOrderIdInput("");
    },
    onError: () => {
      toast({
        title: t('error'),
        description: t('failedToUpdateOrder'),
        variant: "destructive",
      });
    },
  });

  const handleMarkAsBought = (order: OrderWithCustomer, checked: boolean) => {
    if (checked) {
      setPendingAction({ type: 'mark_bought', order });
      setOrderIdInput("");
      setIsOrderIdDialogOpen(true);
    }
  };

  const handleEditOrder = (order: OrderWithCustomer) => {
    setPendingAction({ type: 'edit', order });
    setOrderIdInput("");
    setIsOrderIdDialogOpen(true);
  };

  const handleOrderIdVerification = async () => {
    if (!pendingAction) return;
    
    if (orderIdInput !== pendingAction.order.orderNumber) {
      toast({
        title: t('error'),
        description: t('orderIdDoesNotMatch'),
        variant: "destructive",
      });
      return;
    }

    if (pendingAction.type === 'mark_bought') {
      markAsProcessingMutation.mutate(pendingAction.order.id);
    } else if (pendingAction.type === 'edit') {
      // Fetch order items
      try {
        const response = await apiRequest("GET", `/api/orders/${pendingAction.order.id}/items`);
        const items = await response.json();
        setEditOrderItems(items);
      } catch {
        setEditOrderItems([]);
      }
      
      setEditingOrder(pendingAction.order);
      setEditFormData({
        status: pendingAction.order.status,
        trackingNumber: pendingAction.order.trackingNumber || "",
        notes: pendingAction.order.notes || "",
        totalAmount: pendingAction.order.totalAmount || "",
        downPayment: pendingAction.order.downPayment || "0",
        remainingBalance: pendingAction.order.remainingBalance || "0",
        shippingCost: pendingAction.order.shippingCost || "0",
        shippingWeight: pendingAction.order.shippingWeight || "0",
        shippingCountry: pendingAction.order.shippingCountry || "",
        shippingCity: pendingAction.order.shippingCity || "",
      });
      setIsOrderIdDialogOpen(false);
      setIsEditDialogOpen(true);
    }
  };

  const handleSaveEdit = () => {
    if (!editingOrder) return;
    
    updateOrderMutation.mutate({
      orderId: editingOrder.id,
      data: {
        status: editFormData.status,
        trackingNumber: editFormData.trackingNumber || undefined,
        notes: editFormData.notes || undefined,
        totalAmount: editFormData.totalAmount,
        downPayment: editFormData.downPayment,
        remainingBalance: editFormData.remainingBalance,
        shippingCost: editFormData.shippingCost,
        shippingWeight: editFormData.shippingWeight,
        shippingCountry: editFormData.shippingCountry || undefined,
        shippingCity: editFormData.shippingCity || undefined,
      },
    });
  };

  const readyToBuyOrders = orders.filter(order => order.status === "ready_to_buy");

  const filteredOrders = readyToBuyOrders.filter(order => {
    const searchLower = searchTerm.toLowerCase();
    return (
      order.orderNumber.toLowerCase().includes(searchLower) ||
      order.customer?.firstName?.toLowerCase().includes(searchLower) ||
      order.customer?.lastName?.toLowerCase().includes(searchLower) ||
      order.customer?.phone?.toLowerCase().includes(searchLower) ||
      order.customer?.shippingCode?.toLowerCase().includes(searchLower)
    );
  });

  const handleViewDetails = (order: OrderWithCustomer) => {
    setSelectedOrder(order);
    setIsDetailsDialogOpen(true);
  };

  const formatCurrency = (amount: string | number | null | undefined, currency: 'USD' | 'LYD' = 'USD') => {
    if (!amount) return currency === 'USD' ? '$0.00' : 'د.ل 0.00';
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    if (currency === 'LYD') {
      const lydAmount = numAmount * exchangeRate;
      return i18n.language === 'ar' 
        ? `${lydAmount.toFixed(2)} د.ل`
        : `د.ل ${lydAmount.toFixed(2)}`;
    }
    
    return `$${numAmount.toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title={t('readyToBuy')} />
      <main className="container mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">
              {t('readyToBuy')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('readyToBuyDescription')}
            </p>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-2" data-testid="badge-order-count">
            {filteredOrders.length} {t('orders')}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              {t('readyToBuyOrders')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('searchOrders')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('loading')}...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? t('noOrdersFound') : t('noReadyToBuyOrders')}
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">{t('bought')}</TableHead>
                      <TableHead>{t('orderNumber')}</TableHead>
                      <TableHead>{t('customer')}</TableHead>
                      <TableHead>{t('customerCode')}</TableHead>
                      <TableHead>{t('city')}</TableHead>
                      <TableHead className="text-right">{t('totalAmount')}</TableHead>
                      <TableHead className="text-right">{t('downPayment')}</TableHead>
                      <TableHead className="text-right">{t('remainingBalance')}</TableHead>
                      <TableHead>{t('date')}</TableHead>
                      <TableHead className="text-center">{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                        <TableCell>
                          <Checkbox
                            onCheckedChange={(checked) => handleMarkAsBought(order, checked as boolean)}
                            disabled={markAsProcessingMutation.isPending}
                            data-testid={`checkbox-bought-${order.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {order.orderNumber}
                        </TableCell>
                        <TableCell>
                          {order.customer?.firstName} {order.customer?.lastName}
                          <div className="text-sm text-muted-foreground">
                            {order.customer?.phone}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {order.customer?.shippingCode || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell>{order.shippingCity || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div>{formatCurrency(order.totalAmount)}</div>
                          <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                            {formatCurrency(order.totalAmount, 'LYD')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div>{formatCurrency(order.downPayment)}</div>
                          <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                            {formatCurrency(order.downPayment, 'LYD')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div>{formatCurrency(order.remainingBalance)}</div>
                          <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                            {formatCurrency(order.remainingBalance, 'LYD')}
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(order.createdAt), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(order)}
                              data-testid={`button-view-${order.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditOrder(order)}
                              data-testid={`button-edit-${order.id}`}
                            >
                              <Edit className="h-4 w-4" />
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
      </main>

      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t('orderDetails')} - {selectedOrder?.orderNumber}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">{t('customerInformation')}</h3>
                  <div className="space-y-1 text-sm">
                    <p><strong>{t('name')}:</strong> {selectedOrder.customer?.firstName} {selectedOrder.customer?.lastName}</p>
                    <p><strong>{t('phone')}:</strong> {selectedOrder.customer?.phone}</p>
                    <p><strong>{t('customerCode')}:</strong> {selectedOrder.customer?.shippingCode || '-'}</p>
                    <p><strong>{t('city')}:</strong> {selectedOrder.customer?.city}</p>
                    <p><strong>{t('country')}:</strong> {selectedOrder.customer?.country}</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">{t('orderInformation')}</h3>
                  <div className="space-y-1 text-sm">
                    <p><strong>{t('orderNumber')}:</strong> {selectedOrder.orderNumber}</p>
                    <p><strong>{t('status')}:</strong> <Badge>{t('readyToBuy')}</Badge></p>
                    <p><strong>{t('totalAmount')}:</strong> {formatCurrency(selectedOrder.totalAmount)}</p>
                    <p><strong>{t('downPayment')}:</strong> {formatCurrency(selectedOrder.downPayment)}</p>
                    <p><strong>{t('remainingBalance')}:</strong> {formatCurrency(selectedOrder.remainingBalance)}</p>
                    <p><strong>{t('shippingCost')}:</strong> {formatCurrency(selectedOrder.shippingCost)}</p>
                  </div>
                </div>
              </div>
              {selectedOrder.notes && (
                <div>
                  <h3 className="font-semibold mb-2">{t('notes')}</h3>
                  <p className="text-sm text-muted-foreground">{selectedOrder.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Order ID Verification Dialog */}
      <Dialog open={isOrderIdDialogOpen} onOpenChange={(open) => {
        setIsOrderIdDialogOpen(open);
        if (!open) {
          setPendingAction(null);
          setOrderIdInput("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('enterOrderId') || 'Enter Order ID'}</DialogTitle>
            <DialogDescription>
              {t('enterOrderIdDescription') || 'Please enter the Order ID to proceed with this action'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="order-id-input">{t('orderId') || 'Order ID'}</Label>
              <Input
                id="order-id-input"
                value={orderIdInput}
                onChange={(e) => setOrderIdInput(e.target.value)}
                placeholder={t('enterOrderNumber') || 'Enter order number'}
                data-testid="input-order-id-verification"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOrderIdDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button 
              onClick={handleOrderIdVerification}
              disabled={!orderIdInput || markAsProcessingMutation.isPending}
              data-testid="button-verify-order-id"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {t('verify') || 'Verify'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setEditingOrder(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('editOrder')} - {editingOrder?.orderNumber}</DialogTitle>
          </DialogHeader>
          {editingOrder && (
            <div className="space-y-6">
              {/* Customer Info (Read-only) */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">{t('customerInformation')}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <p><strong>{t('name')}:</strong> {editingOrder.customer?.firstName} {editingOrder.customer?.lastName}</p>
                  <p><strong>{t('phone')}:</strong> {editingOrder.customer?.phone}</p>
                  <p><strong>{t('customerCode')}:</strong> {editingOrder.customer?.shippingCode || '-'}</p>
                  <p><strong>{t('city')}:</strong> {editingOrder.customer?.city}</p>
                </div>
              </div>

              {/* Order Items */}
              {editOrderItems.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">{t('orderItems')}</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('product')}</TableHead>
                          <TableHead className="text-center">{t('quantity')}</TableHead>
                          <TableHead className="text-right">{t('unitPrice')}</TableHead>
                          <TableHead className="text-right">{t('total')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {editOrderItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.productName}</TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell className="text-right">${parseFloat(item.unitPrice).toFixed(2)}</TableCell>
                            <TableCell className="text-right">${parseFloat(item.totalPrice).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Editable Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-status">{t('status')}</Label>
                  <Select
                    value={editFormData.status}
                    onValueChange={(value) => setEditFormData(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger id="edit-status">
                      <SelectValue placeholder={t('selectStatus')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">{t('pending')}</SelectItem>
                      <SelectItem value="ready_to_buy">{t('readyToBuy')}</SelectItem>
                      <SelectItem value="processing">{t('processing')}</SelectItem>
                      <SelectItem value="shipped">{t('shipped')}</SelectItem>
                      <SelectItem value="delivered">{t('delivered')}</SelectItem>
                      <SelectItem value="cancelled">{t('cancelled')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-tracking">{t('trackingNumber')}</Label>
                  <Input
                    id="edit-tracking"
                    value={editFormData.trackingNumber}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, trackingNumber: e.target.value }))}
                    placeholder={t('enterTrackingNumber')}
                    data-testid="input-edit-tracking"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-total">{t('totalAmount')}</Label>
                  <Input
                    id="edit-total"
                    type="number"
                    step="0.01"
                    value={editFormData.totalAmount}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, totalAmount: e.target.value }))}
                    data-testid="input-edit-total"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-downpayment">{t('downPayment')}</Label>
                  <Input
                    id="edit-downpayment"
                    type="number"
                    step="0.01"
                    value={editFormData.downPayment}
                    onChange={(e) => {
                      const downPayment = parseFloat(e.target.value) || 0;
                      const total = parseFloat(editFormData.totalAmount) || 0;
                      setEditFormData(prev => ({
                        ...prev,
                        downPayment: e.target.value,
                        remainingBalance: (total - downPayment).toFixed(2)
                      }));
                    }}
                    data-testid="input-edit-downpayment"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-remaining">{t('remainingBalance')}</Label>
                  <Input
                    id="edit-remaining"
                    type="number"
                    step="0.01"
                    value={editFormData.remainingBalance}
                    readOnly
                    className="bg-muted"
                    data-testid="input-edit-remaining"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-shipping-cost">{t('shippingCost')}</Label>
                  <Input
                    id="edit-shipping-cost"
                    type="number"
                    step="0.01"
                    value={editFormData.shippingCost}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, shippingCost: e.target.value }))}
                    data-testid="input-edit-shipping-cost"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-shipping-weight">{t('shippingWeight')}</Label>
                  <Input
                    id="edit-shipping-weight"
                    type="number"
                    step="0.01"
                    value={editFormData.shippingWeight}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, shippingWeight: e.target.value }))}
                    data-testid="input-edit-shipping-weight"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-shipping-country">{t('shippingCountry')}</Label>
                  <Input
                    id="edit-shipping-country"
                    value={editFormData.shippingCountry}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, shippingCountry: e.target.value }))}
                    data-testid="input-edit-shipping-country"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-shipping-city">{t('shippingCity')}</Label>
                  <Input
                    id="edit-shipping-city"
                    value={editFormData.shippingCity}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, shippingCity: e.target.value }))}
                    data-testid="input-edit-shipping-city"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notes">{t('notes')}</Label>
                <Textarea
                  id="edit-notes"
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  data-testid="input-edit-notes"
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button 
                  onClick={handleSaveEdit}
                  disabled={updateOrderMutation.isPending}
                  data-testid="button-save-edit"
                >
                  {updateOrderMutation.isPending ? t('saving') : t('saveChanges')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
