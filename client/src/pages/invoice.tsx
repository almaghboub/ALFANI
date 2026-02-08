import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Minus, Printer, Trash2, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Header } from "@/components/header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Product, ProductWithInventory } from "@shared/schema";
import logoPath from "@assets/alfani-logo.png";

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export default function Invoice() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [customerName, setCustomerName] = useState("");
  const [branch, setBranch] = useState<"ALFANI1" | "ALFANI2">("ALFANI1");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: products = [], isLoading } = useQuery<ProductWithInventory[]>({
    queryKey: ["/api/products/with-inventory"],
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: { customerName: string; branch: string; items: CartItem[] }) => {
      const response = await apiRequest("POST", "/api/invoices", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/with-inventory"] });
      toast({ title: t("success"), description: t("invoiceCreated") });
      handlePrint();
      setCart([]);
      setCustomerName("");
    },
    onError: () => {
      toast({ title: t("error"), description: t("failedCreateInvoice"), variant: "destructive" });
    },
  });

  const addToCart = (product: ProductWithInventory) => {
    const branchInventory = product.inventory.find(inv => inv.branch === branch);
    const availableQty = branchInventory?.quantity || 0;
    
    const existingItem = cart.find(item => item.productId === product.id);
    const currentQty = existingItem?.quantity || 0;
    
    if (currentQty >= availableQty) {
      toast({ title: t("error"), description: t("notEnoughStock"), variant: "destructive" });
      return;
    }

    if (existingItem) {
      setCart(cart.map(item => 
        item.productId === product.id 
          ? { ...item, quantity: item.quantity + 1, lineTotal: (item.quantity + 1) * item.unitPrice }
          : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: Number(product.price),
        lineTotal: Number(product.price),
      }]);
    }
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCart(cart.filter(item => item.productId !== productId));
    } else {
      const product = products.find(p => p.id === productId);
      const branchInventory = product?.inventory.find(inv => inv.branch === branch);
      const availableQty = branchInventory?.quantity || 0;
      
      if (newQuantity > availableQty) {
        toast({ title: t("error"), description: t("notEnoughStock"), variant: "destructive" });
        return;
      }
      
      setCart(cart.map(item =>
        item.productId === productId
          ? { ...item, quantity: newQuantity, lineTotal: newQuantity * item.unitPrice }
          : item
      ));
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const getTotal = () => cart.reduce((sum, item) => sum + item.lineTotal, 0);

  const handlePrint = () => {
    if (printRef.current) {
      const printContents = printRef.current.innerHTML;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>${t("invoice")}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; direction: ${document.dir}; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: ${document.dir === 'rtl' ? 'right' : 'left'}; }
                th { background-color: #f4f4f4; }
                .header { text-align: center; margin-bottom: 20px; }
                .logo { width: 120px; margin-bottom: 10px; }
                .total { font-size: 1.2em; font-weight: bold; margin-top: 20px; text-align: ${document.dir === 'rtl' ? 'left' : 'right'}; }
                .info { margin-bottom: 20px; }
              </style>
            </head>
            <body>
              ${printContents}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const handleSubmit = () => {
    if (!customerName.trim()) {
      toast({ title: t("error"), description: t("enterCustomerName"), variant: "destructive" });
      return;
    }
    if (cart.length === 0) {
      toast({ title: t("error"), description: t("cartEmpty"), variant: "destructive" });
      return;
    }
    createInvoiceMutation.mutate({ customerName, branch, items: cart });
  };

  const filteredProducts = products.filter(product => 
    product.isActive && 
    (product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     product.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getAvailableQuantity = (product: ProductWithInventory) => {
    const branchInventory = product.inventory.find(inv => inv.branch === branch);
    return branchInventory?.quantity || 0;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title={t("newInvoice")} description={t("createNewInvoice")} />
      
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                {t("selectProducts")}
              </CardTitle>
              <CardDescription>{t("addProductsToCart")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label>{t("branch")}</Label>
                  <Select value={branch} onValueChange={(v) => setBranch(v as "ALFANI1" | "ALFANI2")}>
                    <SelectTrigger data-testid="select-branch">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALFANI1">{t("ALFANI1")}</SelectItem>
                      <SelectItem value="ALFANI2">{t("ALFANI2")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label>{t("searchProducts")}</Label>
                  <Input
                    placeholder={t("searchProducts")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-products"
                  />
                </div>
              </div>
              
              <div className="max-h-96 overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("productName")}</TableHead>
                      <TableHead>{t("sku")}</TableHead>
                      <TableHead>{t("price")}</TableHead>
                      <TableHead>{t("stock")}</TableHead>
                      <TableHead>{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map(product => (
                      <TableRow key={product.id}>
                        <TableCell>{product.name}</TableCell>
                        <TableCell>{product.sku}</TableCell>
                        <TableCell>{Number(product.price).toFixed(2)} LYD</TableCell>
                        <TableCell>{getAvailableQuantity(product)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => addToCart(product)}
                            disabled={getAvailableQuantity(product) === 0}
                            data-testid={`button-add-${product.id}`}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("invoice")}</CardTitle>
              <CardDescription>{t("reviewAndPrint")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t("customerName")}</Label>
                <Input
                  placeholder={t("enterCustomerName")}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  data-testid="input-customer-name"
                />
              </div>
              
              {cart.length > 0 ? (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("product")}</TableHead>
                        <TableHead>{t("quantity")}</TableHead>
                        <TableHead>{t("price")}</TableHead>
                        <TableHead>{t("total")}</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cart.map(item => (
                        <TableRow key={item.productId}>
                          <TableCell>{item.productName}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button size="icon" variant="outline" onClick={() => updateQuantity(item.productId, item.quantity - 1)}>
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span>{item.quantity}</span>
                              <Button size="icon" variant="outline" onClick={() => updateQuantity(item.productId, item.quantity + 1)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>{item.unitPrice.toFixed(2)} LYD</TableCell>
                          <TableCell>{item.lineTotal.toFixed(2)} LYD</TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => removeFromCart(item.productId)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {t("cartEmpty")}
                </div>
              )}
              
              <div className="flex justify-between items-center pt-4 border-t">
                <span className="text-lg font-semibold">{t("total")}</span>
                <span className="text-2xl font-bold">{getTotal().toFixed(2)} LYD</span>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  className="flex-1" 
                  onClick={handleSubmit}
                  disabled={cart.length === 0 || !customerName.trim() || createInvoiceMutation.isPending}
                  data-testid="button-create-invoice"
                >
                  <Printer className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {createInvoiceMutation.isPending ? t("creating") : t("createAndPrint")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="hidden">
        <div ref={printRef}>
          <div className="header">
            <img src={logoPath} alt="ALFANI" className="logo" />
            <h1>ALFANI - {branch}</h1>
            <p>{new Date().toLocaleDateString()}</p>
          </div>
          <div className="info">
            <p><strong>{t("customerName")}:</strong> {customerName}</p>
            <p><strong>{t("branch")}:</strong> {branch}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>{t("product")}</th>
                <th>{t("quantity")}</th>
                <th>{t("unitPrice")}</th>
                <th>{t("total")}</th>
              </tr>
            </thead>
            <tbody>
              {cart.map(item => (
                <tr key={item.productId}>
                  <td>{item.productName}</td>
                  <td>{item.quantity}</td>
                  <td>{item.unitPrice.toFixed(2)} LYD</td>
                  <td>{item.lineTotal.toFixed(2)} LYD</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="total">
            {t("total")}: {getTotal().toFixed(2)} LYD
          </div>
        </div>
      </div>
    </div>
  );
}
