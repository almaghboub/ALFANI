import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search, Warehouse, AlertTriangle, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Product, BranchInventory, ProductWithInventory } from "@shared/schema";

type Branch = "ALFANI1" | "ALFANI2";

export default function Inventory() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<Branch>("ALFANI1");
  const [isAddStockDialogOpen, setIsAddStockDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stockFormData, setStockFormData] = useState({
    quantity: 0,
    lowStockThreshold: 5,
  });

  const { data: productsWithInventory = [], isLoading } = useQuery<ProductWithInventory[]>({
    queryKey: ["/api/products/with-inventory"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const updateInventoryMutation = useMutation({
    mutationFn: async (data: { productId: string; branch: Branch; quantity: number; lowStockThreshold: number }) => {
      const response = await apiRequest("POST", "/api/inventory", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products/with-inventory"] });
      setIsAddStockDialogOpen(false);
      setSelectedProduct(null);
      setStockFormData({ quantity: 0, lowStockThreshold: 5 });
      toast({ title: t("success"), description: t("inventoryUpdated") });
    },
    onError: () => {
      toast({ title: t("error"), description: t("failedUpdateInventory"), variant: "destructive" });
    },
  });

  const handleAddStock = (product: Product) => {
    setSelectedProduct(product);
    const existingInventory = productsWithInventory
      .find(p => p.id === product.id)
      ?.inventory?.find(inv => inv.branch === selectedBranch);
    
    setStockFormData({
      quantity: existingInventory?.quantity || 0,
      lowStockThreshold: existingInventory?.lowStockThreshold || 5,
    });
    setIsAddStockDialogOpen(true);
  };

  const handleSubmitStock = () => {
    if (selectedProduct) {
      updateInventoryMutation.mutate({
        productId: selectedProduct.id,
        branch: selectedBranch,
        quantity: stockFormData.quantity,
        lowStockThreshold: stockFormData.lowStockThreshold,
      });
    }
  };

  const getInventoryForBranch = (product: ProductWithInventory, branch: Branch): BranchInventory | undefined => {
    return product.inventory?.find(inv => inv.branch === branch);
  };

  const filteredProducts = productsWithInventory.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getLowStockCount = (branch: Branch) => {
    return productsWithInventory.filter(product => {
      const inv = getInventoryForBranch(product, branch);
      return inv && inv.quantity <= inv.lowStockThreshold && inv.quantity > 0;
    }).length;
  };

  const getOutOfStockCount = (branch: Branch) => {
    return productsWithInventory.filter(product => {
      const inv = getInventoryForBranch(product, branch);
      return !inv || inv.quantity === 0;
    }).length;
  };

  const getTotalStock = (branch: Branch) => {
    return productsWithInventory.reduce((sum, product) => {
      const inv = getInventoryForBranch(product, branch);
      return sum + (inv?.quantity || 0);
    }, 0);
  };

  const renderInventoryTable = (branch: Branch) => {
    const branchProducts = filteredProducts.map(product => ({
      ...product,
      branchInventory: getInventoryForBranch(product, branch),
    }));

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("productName")}</TableHead>
            <TableHead>{t("sku")}</TableHead>
            <TableHead>{t("category")}</TableHead>
            <TableHead>{t("price")}</TableHead>
            <TableHead>{t("quantity")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {branchProducts.map((product) => {
            const quantity = product.branchInventory?.quantity || 0;
            const threshold = product.branchInventory?.lowStockThreshold || 5;
            const isLowStock = quantity > 0 && quantity <= threshold;
            const isOutOfStock = quantity === 0;

            return (
              <TableRow key={product.id} data-testid={`row-inventory-${product.id}-${branch}`}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>{product.sku}</TableCell>
                <TableCell>{product.category || "-"}</TableCell>
                <TableCell>${parseFloat(product.price).toFixed(2)}</TableCell>
                <TableCell>{quantity}</TableCell>
                <TableCell>
                  {isOutOfStock ? (
                    <Badge variant="destructive">{t("outOfStock")}</Badge>
                  ) : isLowStock ? (
                    <Badge variant="secondary" className="bg-yellow-500 text-black">{t("lowStock")}</Badge>
                  ) : (
                    <Badge variant="default">{t("inStock")}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedBranch(branch);
                      handleAddStock(product);
                    }}
                    data-testid={`button-update-stock-${product.id}-${branch}`}
                  >
                    {t("updateStock")}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="flex-1 p-6 space-y-6">
      <Header
        title={t("inventory")}
        description={t("branchInventoryDescription")}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("totalStock")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getTotalStock("ALFANI1") + getTotalStock("ALFANI2")}
            </div>
            <p className="text-xs text-muted-foreground">{t("acrossAllBranches")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              {t("lowStockItems")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {getLowStockCount("ALFANI1") + getLowStockCount("ALFANI2")}
            </div>
            <p className="text-xs text-muted-foreground">{t("needsAttention")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("outOfStockItems")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {getOutOfStockCount("ALFANI1") + getOutOfStockCount("ALFANI2")}
            </div>
            <p className="text-xs text-muted-foreground">{t("requiresRestock")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchProducts")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-inventory"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            {t("branchInventory")}
          </CardTitle>
          <CardDescription>{t("manageStockPerBranch")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="ALFANI1" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="ALFANI1" data-testid="tab-alfani1">
                ALFANI1
                <Badge variant="secondary" className="ml-2">{getTotalStock("ALFANI1")}</Badge>
              </TabsTrigger>
              <TabsTrigger value="ALFANI2" data-testid="tab-alfani2">
                ALFANI2
                <Badge variant="secondary" className="ml-2">{getTotalStock("ALFANI2")}</Badge>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="ALFANI1">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t("noProductsFound")}</p>
                </div>
              ) : (
                renderInventoryTable("ALFANI1")
              )}
            </TabsContent>
            <TabsContent value="ALFANI2">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t("noProductsFound")}</p>
                </div>
              ) : (
                renderInventoryTable("ALFANI2")
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isAddStockDialogOpen} onOpenChange={setIsAddStockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("updateStock")} - {selectedBranch}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {selectedProduct && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedProduct.name}</p>
                <p className="text-sm text-muted-foreground">SKU: {selectedProduct.sku}</p>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="quantity">{t("quantity")}</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                value={stockFormData.quantity}
                onChange={(e) => setStockFormData({ ...stockFormData, quantity: parseInt(e.target.value) || 0 })}
                data-testid="input-stock-quantity"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lowStockThreshold">{t("lowStockThreshold")}</Label>
              <Input
                id="lowStockThreshold"
                type="number"
                min="0"
                value={stockFormData.lowStockThreshold}
                onChange={(e) => setStockFormData({ ...stockFormData, lowStockThreshold: parseInt(e.target.value) || 0 })}
                data-testid="input-low-stock-threshold"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddStockDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={handleSubmitStock}
              disabled={updateInventoryMutation.isPending}
              data-testid="button-submit-stock"
            >
              {updateInventoryMutation.isPending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
