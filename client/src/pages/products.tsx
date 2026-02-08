import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search, Pencil, Trash2, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Product, InsertProduct } from "@shared/schema";

interface ProductWithInventory extends Product {
  branchInventory?: Array<{ branch: string; quantity: number; lowStockThreshold: number }>;
}

export default function Products() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithInventory | null>(null);
  const [formData, setFormData] = useState<Partial<InsertProduct> & { branch?: string; initialQuantity?: number }>({
    name: "",
    sku: "",
    category: "",
    description: "",
    price: "0",
    costPrice: "0",
    isActive: true,
    branch: "ALFANI1",
    initialQuantity: 0,
  });

  const { data: products = [], isLoading } = useQuery<ProductWithInventory[]>({
    queryKey: ["/api/products/with-inventory"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertProduct) => {
      const response = await apiRequest("POST", "/api/products", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products-with-inventory"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: t("success"), description: t("productCreated") });
    },
    onError: () => {
      toast({ title: t("error"), description: t("failedCreateProduct"), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertProduct> }) => {
      const response = await apiRequest("PATCH", `/api/products/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/with-inventory"] });
      setIsEditDialogOpen(false);
      setSelectedProduct(null);
      resetForm();
      toast({ title: t("success"), description: t("productUpdated") });
    },
    onError: () => {
      toast({ title: t("error"), description: t("failedUpdateProduct"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/with-inventory"] });
      setIsDeleteDialogOpen(false);
      setSelectedProduct(null);
      toast({ title: t("success"), description: t("productDeleted") });
    },
    onError: () => {
      toast({ title: t("error"), description: t("failedDeleteProduct"), variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      sku: "",
      category: "",
      description: "",
      price: "0",
      costPrice: "0",
      isActive: true,
      branch: "ALFANI1",
      initialQuantity: 0,
    });
  };

  const handleEdit = (product: ProductWithInventory) => {
    setSelectedProduct(product);
    const firstBranch = product.branchInventory?.[0];
    const totalQty = product.branchInventory?.reduce((sum, bi) => sum + bi.quantity, 0) || 0;
    setFormData({
      name: product.name,
      sku: product.sku,
      category: product.category || "",
      description: product.description || "",
      price: product.price,
      costPrice: product.costPrice || "0",
      isActive: product.isActive,
      branch: firstBranch?.branch || "ALFANI1",
      initialQuantity: totalQty,
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (product: Product) => {
    setSelectedProduct(product);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = () => {
    if (isEditDialogOpen && selectedProduct) {
      updateMutation.mutate({ id: selectedProduct.id, data: formData as InsertProduct });
    } else {
      createMutation.mutate(formData as InsertProduct & { branch: string; initialQuantity: number });
    }
  };

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.category && product.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex-1 p-6 space-y-6">
      <Header
        title={t("products")}
        description={t("productsDescription")}
      />

      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchProducts")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-products"
          />
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-product">
          <Plus className="h-4 w-4 mr-2" />
          {t("addProduct")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t("productCatalog")}
          </CardTitle>
          <CardDescription>{t("productCatalogDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("productName")}</TableHead>
                  <TableHead>{t("sku")}</TableHead>
                  <TableHead>{t("category")}</TableHead>
                  <TableHead>{t("price")}</TableHead>
                  <TableHead>{t("costPrice")}</TableHead>
                  <TableHead>{t("quantity")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.sku}</TableCell>
                    <TableCell>{product.category || "-"}</TableCell>
                    <TableCell>${parseFloat(product.price).toFixed(2)}</TableCell>
                    <TableCell>${parseFloat(product.costPrice || "0").toFixed(2)}</TableCell>
                    <TableCell>
                      {(() => {
                        const totalQty = product.branchInventory?.reduce((sum, bi) => sum + bi.quantity, 0) || 0;
                        return (
                          <span className={`font-semibold ${totalQty === 0 ? 'text-red-500' : totalQty <= 5 ? 'text-amber-500' : 'text-foreground'}`}>
                            {totalQty}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.isActive ? "default" : "secondary"}>
                        {product.isActive ? t("active") : t("inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(product)}
                          data-testid={`button-edit-product-${product.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(product)}
                          data-testid={`button-delete-product-${product.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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

      <Dialog open={isCreateDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateDialogOpen(false);
          setIsEditDialogOpen(false);
          setSelectedProduct(null);
          resetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditDialogOpen ? t("editProduct") : t("addProduct")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t("branch")} *</Label>
              <Select
                value={formData.branch || "ALFANI1"}
                onValueChange={(value) => setFormData({ ...formData, branch: value })}
              >
                <SelectTrigger data-testid="select-product-branch">
                  <SelectValue placeholder={t("selectBranch")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALFANI1">{t("ALFANI1")}</SelectItem>
                  <SelectItem value="ALFANI2">{t("ALFANI2")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">{t("productName")} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("enterProductName")}
                data-testid="input-product-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sku">{t("sku")} *</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder={t("enterSku")}
                data-testid="input-product-sku"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">{t("category")}</Label>
              <Input
                id="category"
                value={formData.category || ""}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder={t("enterCategory")}
                data-testid="input-product-category"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="costPrice">{t("buyingPrice")} *</Label>
                <Input
                  id="costPrice"
                  type="number"
                  step="0.01"
                  value={formData.costPrice || "0"}
                  onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                  data-testid="input-product-cost-price"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="price">{t("sellingPrice")} *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  data-testid="input-product-price"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="initialQuantity">{t("quantity")} *</Label>
                <Input
                  id="initialQuantity"
                  type="number"
                  min="0"
                  value={formData.initialQuantity || 0}
                  onChange={(e) => setFormData({ ...formData, initialQuantity: parseInt(e.target.value) || 0 })}
                  data-testid="input-product-initial-quantity"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">{t("description")}</Label>
              <Input
                id="description"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("enterDescription")}
                data-testid="input-product-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              setIsEditDialogOpen(false);
              setSelectedProduct(null);
              resetForm();
            }}>
              {t("cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit-product"
            >
              {createMutation.isPending || updateMutation.isPending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteProduct")}</DialogTitle>
          </DialogHeader>
          <p>{t("deleteProductConfirmation")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedProduct && deleteMutation.mutate(selectedProduct.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-product"
            >
              {deleteMutation.isPending ? t("deleting") : t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
