import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search, Pencil, Trash2, Package, PackagePlus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
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
import { useAuth } from "@/components/auth-provider";
import type { Product, InsertProduct } from "@shared/schema";

interface ProductWithInventory extends Product {
  inventory?: Array<{ branch: string; quantity: number; lowStockThreshold: number }>;
}

export default function Products() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const canManage = user?.role === "owner" || user?.role === "stock_manager";
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isStockInDialogOpen, setIsStockInDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithInventory | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [stockInData, setStockInData] = useState({
    productId: "",
    branch: "ALFANI1",
    quantity: 1,
    costPerUnit: "0",
    purchaseType: "paid_now" as "paid_now" | "on_credit",
    currency: "LYD",
    exchangeRate: "",
    supplierName: "",
    supplierInvoiceNumber: "",
    safeId: "",
    supplierId: "",
  });
  const nameInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  interface PaginatedResponse {
    products: ProductWithInventory[];
    total: number;
    page: number;
    totalPages: number;
  }

  const { data: paginatedData, isLoading } = useQuery<PaginatedResponse>({
    queryKey: ["/api/products/with-inventory", currentPage, pageSize, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/products/with-inventory?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
    placeholderData: keepPreviousData,
    staleTime: 10000,
  });

  useEffect(() => {
    if (paginatedData && currentPage < (paginatedData.totalPages || 1)) {
      const nextPage = currentPage + 1;
      const params = new URLSearchParams({ page: String(nextPage), limit: String(pageSize) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      queryClient.prefetchQuery({
        queryKey: ["/api/products/with-inventory", nextPage, pageSize, debouncedSearch],
        queryFn: async () => {
          const res = await fetch(`/api/products/with-inventory?${params}`, { credentials: "include" });
          if (!res.ok) throw new Error("Failed to fetch products");
          return res.json();
        },
        staleTime: 10000,
      });
    }
  }, [currentPage, pageSize, debouncedSearch, paginatedData]);

  const products = paginatedData?.products || [];
  const totalProducts = paginatedData?.total || 0;
  const totalPages = paginatedData?.totalPages || 1;

  const { data: safes = [] } = useQuery<any[]>({
    queryKey: ["/api/safes"],
    enabled: canManage,
  });

  const { data: suppliersList = [] } = useQuery<any[]>({
    queryKey: ["/api/suppliers"],
    enabled: canManage,
  });

  const [suggestionSearch, setSuggestionSearch] = useState("");
  const { data: serverSuggestions = [] } = useQuery<ProductWithInventory[]>({
    queryKey: ["/api/products/search", suggestionSearch],
    queryFn: async () => {
      if (!suggestionSearch) return [];
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(suggestionSearch)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: suggestionSearch.length >= 1 && isCreateDialogOpen && !isEditDialogOpen,
    staleTime: 5000,
  });
  const nameSuggestions = suggestionSearch.length >= 1 ? serverSuggestions : [];

  useEffect(() => {
    const name = formData.name?.trim() || "";
    if (name.length < 1 || isEditDialogOpen) {
      setSuggestionSearch("");
      return;
    }
    const timer = setTimeout(() => setSuggestionSearch(name), 200);
    return () => clearTimeout(timer);
  }, [formData.name, isEditDialogOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        nameInputRef.current &&
        !nameInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectSuggestion = (product: ProductWithInventory) => {
    setShowSuggestions(false);
    setIsCreateDialogOpen(false);
    setSelectedProduct(product);
    const totalQty = product.inventory?.reduce((sum, bi) => sum + bi.quantity, 0) || 0;
    setFormData({
      name: product.name,
      sku: product.sku || "",
      category: product.category || "",
      description: product.description || "",
      price: product.price || "0",
      costPrice: product.costPrice || "0",
      isActive: product.isActive,
      branch: product.inventory?.[0]?.branch || "ALFANI1",
      initialQuantity: totalQty,
    });
    setIsEditDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async (data: InsertProduct) => {
      const response = await apiRequest("POST", "/api/products", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/with-inventory"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: t("success"), description: t("productCreated") });
    },
    onError: (error: any) => {
      if (error?.message?.includes("401")) {
        window.location.href = "/";
        return;
      }
      const errorMsg = error?.message?.replace(/^\d+:\s*/, "") || t("failedCreateProduct");
      let parsedMsg = errorMsg;
      try {
        const parsed = JSON.parse(errorMsg);
        if (parsed.message) parsedMsg = parsed.message;
      } catch {}
      toast({ title: t("error"), description: parsedMsg, variant: "destructive" });
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

  const stockInMutation = useMutation({
    mutationFn: async (data: typeof stockInData) => {
      const response = await apiRequest("POST", "/api/stock-purchases", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/with-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/safes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/safe-transactions"] });
      setIsStockInDialogOpen(false);
      setSelectedProduct(null);
      resetStockInForm();
      toast({ title: t("success"), description: t("stockInSuccess") || "Stock added successfully" });
    },
    onError: (error: any) => {
      toast({ title: t("error"), description: error?.message || t("stockInFailed") || "Failed to add stock", variant: "destructive" });
    },
  });

  const resetStockInForm = () => {
    setStockInData({
      productId: "",
      branch: "ALFANI1",
      quantity: 1,
      costPerUnit: "0",
      purchaseType: "paid_now",
      currency: "LYD",
      exchangeRate: "",
      supplierName: "",
      supplierInvoiceNumber: "",
      safeId: "",
      supplierId: "",
    });
  };

  const handleStockIn = (product: ProductWithInventory) => {
    setSelectedProduct(product);
    setStockInData({
      ...stockInData,
      productId: product.id,
      costPerUnit: product.costPrice || "0",
      branch: product.inventory?.[0]?.branch || "ALFANI1",
    });
    setIsStockInDialogOpen(true);
  };

  const handleStockInSubmit = () => {
    if (!stockInData.productId || stockInData.quantity <= 0 || parseFloat(stockInData.costPerUnit) <= 0) {
      toast({ title: t("error"), description: t("fillRequiredFields") || "Please fill all required fields", variant: "destructive" });
      return;
    }
    if (stockInData.purchaseType === "paid_now" && !stockInData.safeId) {
      toast({ title: t("error"), description: t("selectCashbox") || "Please select a cashbox for paid purchases", variant: "destructive" });
      return;
    }
    stockInMutation.mutate(stockInData);
  };

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
    setShowSuggestions(false);
  };

  const handleEdit = (product: ProductWithInventory) => {
    setSelectedProduct(product);
    const totalQty = product.inventory?.reduce((sum, bi) => sum + bi.quantity, 0) || 0;
    setFormData({
      name: product.name,
      sku: product.sku || "",
      category: product.category || "",
      description: product.description || "",
      price: product.price || "0",
      costPrice: product.costPrice || "0",
      isActive: product.isActive,
      branch: product.inventory?.[0]?.branch || "ALFANI1",
      initialQuantity: totalQty,
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (product: Product) => {
    setSelectedProduct(product);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name || formData.name.trim() === "") {
      toast({ title: t("error"), description: t("productNameRequired") || "Product name is required", variant: "destructive" });
      return;
    }
    if (isEditDialogOpen && selectedProduct) {
      updateMutation.mutate({ id: selectedProduct.id, data: formData as InsertProduct });
    } else {
      createMutation.mutate(formData as InsertProduct & { branch: string; initialQuantity: number });
    }
  };

  const filteredProducts = products;

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
        {canManage && (
          <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-product">
            <Plus className="h-4 w-4 mr-2" />
            {t("addProduct")}
          </Button>
        )}
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
                  <TableHead>{t("branch")}</TableHead>
                  <TableHead>{t("sku")}</TableHead>
                  <TableHead>{t("category")}</TableHead>
                  <TableHead>{t("price")}</TableHead>
                  {canManage && <TableHead>{t("costPrice")}</TableHead>}
                  <TableHead>{t("quantity")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  {canManage && <TableHead>{t("actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      {product.inventory && product.inventory.length > 0 ? product.inventory.map((inv, idx) => (
                        <Badge key={`${product.id}-${inv.branch}-${idx}`} variant="outline" className="mr-1">
                          {t(inv.branch) || inv.branch}
                        </Badge>
                      )) : "-"}
                    </TableCell>
                    <TableCell>{product.sku || "-"}</TableCell>
                    <TableCell>{product.category || "-"}</TableCell>
                    <TableCell>{parseFloat(product.price || "0").toFixed(2)} LYD</TableCell>
                    {canManage && <TableCell>{parseFloat(product.costPrice || "0").toFixed(2)} LYD</TableCell>}
                    <TableCell>
                      {(() => {
                        const totalQty = product.inventory?.reduce((sum, bi) => sum + bi.quantity, 0) || 0;
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
                    {canManage && (
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStockIn(product)}
                            data-testid={`button-stockin-product-${product.id}`}
                            title={t("stockIn") || "Stock In"}
                          >
                            <PackagePlus className="h-4 w-4 text-green-600" />
                          </Button>
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
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground" data-testid="text-products-count">
                {t("showing")} {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalProducts)} {t("of")} {totalProducts} {t("products")}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  data-testid="button-first-page"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-3 py-1 text-sm font-medium" data-testid="text-page-info">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  data-testid="button-last-page"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {canManage && (<Dialog open={isCreateDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
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
            <div className="grid gap-2 relative">
              <Label htmlFor="name">{t("productName")} *</Label>
              <Input
                id="name"
                ref={nameInputRef}
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder={t("enterProductName")}
                autoComplete="off"
                data-testid="input-product-name"
              />
              {showSuggestions && nameSuggestions.length > 0 && isCreateDialogOpen && (
                <div
                  ref={suggestionsRef}
                  className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto"
                  data-testid="product-name-suggestions"
                >
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border bg-muted/50">
                    {t("existingProducts") || "Existing products"}
                  </div>
                  {nameSuggestions.map((product) => {
                    const totalQty = product.inventory?.reduce((sum, bi) => sum + bi.quantity, 0) || 0;
                    return (
                      <button
                        key={product.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between gap-2 cursor-pointer"
                        onClick={() => selectSuggestion(product)}
                        data-testid={`suggestion-product-${product.id}`}
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{product.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {product.sku ? `SKU: ${product.sku}` : ""}{product.category ? ` · ${product.category}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-medium">{parseFloat(product.price || "0").toFixed(2)} LYD</span>
                          <Badge variant="outline" className="text-xs">
                            {totalQty} {t("inStock") || "in stock"}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sku">{t("sku")}</Label>
              <Input
                id="sku"
                value={formData.sku || ""}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder={t("autoGeneratedIfEmpty")}
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
                <Label htmlFor="costPrice">{t("buyingPrice")}</Label>
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
                <Label htmlFor="price">{t("sellingPrice")}</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price || "0"}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  data-testid="input-product-price"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="initialQuantity">{t("quantity")}</Label>
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
      </Dialog>)}

      {canManage && (<Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
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
      </Dialog>)}

      {canManage && (<Dialog open={isStockInDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsStockInDialogOpen(false);
          setSelectedProduct(null);
          resetStockInForm();
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-green-600" />
              {t("stockIn") || "Stock In"} {selectedProduct ? `- ${selectedProduct.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t("branch") || "Branch"} *</Label>
              <Select
                value={stockInData.branch}
                onValueChange={(value) => setStockInData({ ...stockInData, branch: value })}
              >
                <SelectTrigger data-testid="select-stockin-branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALFANI1">ALFANI1</SelectItem>
                  <SelectItem value="ALFANI2">ALFANI2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>{t("purchaseType") || "Purchase Type"} *</Label>
              <Select
                value={stockInData.purchaseType}
                onValueChange={(value: "paid_now" | "on_credit") => setStockInData({ ...stockInData, purchaseType: value })}
              >
                <SelectTrigger data-testid="select-stockin-purchase-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid_now">{t("paidNow") || "Paid Now"}</SelectItem>
                  <SelectItem value="on_credit">{t("onCredit") || "On Credit"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("quantity") || "Quantity"} *</Label>
                <Input
                  type="number"
                  min="1"
                  value={stockInData.quantity}
                  onChange={(e) => setStockInData({ ...stockInData, quantity: parseInt(e.target.value) || 0 })}
                  data-testid="input-stockin-quantity"
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("costPerUnit") || "Cost Per Unit"} *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={stockInData.costPerUnit}
                  onChange={(e) => setStockInData({ ...stockInData, costPerUnit: e.target.value })}
                  data-testid="input-stockin-cost"
                />
              </div>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{t("totalCost") || "Total Cost"}:</span>
                <span className="text-lg font-bold">
                  {(stockInData.quantity * parseFloat(stockInData.costPerUnit || "0")).toFixed(2)} {stockInData.currency}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("currency") || "Currency"} *</Label>
                <Select
                  value={stockInData.currency}
                  onValueChange={(value) => setStockInData({ ...stockInData, currency: value })}
                >
                  <SelectTrigger data-testid="select-stockin-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LYD">LYD</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("exchangeRate") || "Exchange Rate"}</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={t("optional") || "Optional"}
                  value={stockInData.exchangeRate}
                  onChange={(e) => setStockInData({ ...stockInData, exchangeRate: e.target.value })}
                  data-testid="input-stockin-exchange-rate"
                />
              </div>
            </div>

            {stockInData.purchaseType === "paid_now" && (
              <div className="grid gap-2">
                <Label>{t("cashbox") || "Cashbox"} *</Label>
                <Select
                  value={stockInData.safeId}
                  onValueChange={(value) => setStockInData({ ...stockInData, safeId: value })}
                >
                  <SelectTrigger data-testid="select-stockin-safe">
                    <SelectValue placeholder={t("selectCashbox") || "Select Cashbox"} />
                  </SelectTrigger>
                  <SelectContent>
                    {safes.filter((s: any) => s.isActive).map((safe: any) => (
                      <SelectItem key={safe.id} value={safe.id}>
                        {safe.name} ({safe.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {stockInData.purchaseType === "on_credit" && (
              <div className="grid gap-2">
                <Label>{t("supplier") || "Supplier"}</Label>
                <Select
                  value={stockInData.supplierId}
                  onValueChange={(value) => {
                    const supplier = suppliersList.find((s: any) => s.id === value);
                    setStockInData({ 
                      ...stockInData, 
                      supplierId: value,
                      supplierName: supplier?.name || stockInData.supplierName 
                    });
                  }}
                >
                  <SelectTrigger data-testid="select-stockin-supplier">
                    <SelectValue placeholder={t("selectSupplier") || "Select Supplier"} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliersList.filter((s: any) => s.isActive).map((supplier: any) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name} ({supplier.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("supplierName") || "Supplier Name"}</Label>
                <Input
                  placeholder={t("optional") || "Optional"}
                  value={stockInData.supplierName}
                  onChange={(e) => setStockInData({ ...stockInData, supplierName: e.target.value })}
                  data-testid="input-stockin-supplier-name"
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("invoiceNumber") || "Invoice Number"}</Label>
                <Input
                  placeholder={t("optional") || "Optional"}
                  value={stockInData.supplierInvoiceNumber}
                  onChange={(e) => setStockInData({ ...stockInData, supplierInvoiceNumber: e.target.value })}
                  data-testid="input-stockin-invoice-number"
                />
              </div>
            </div>

            {stockInData.purchaseType === "paid_now" && (
              <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-sm">
                <p className="text-red-700 dark:text-red-300 font-medium">
                  {t("paidNowNote") || "This will deduct the total cost from the selected cashbox and create a financial record."}
                </p>
              </div>
            )}

            {stockInData.purchaseType === "on_credit" && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
                <p className="text-amber-700 dark:text-amber-300 font-medium">
                  {t("onCreditNote") || "No cashbox deduction. The total cost will be added to the supplier's payable balance."}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsStockInDialogOpen(false);
              setSelectedProduct(null);
              resetStockInForm();
            }}>
              {t("cancel")}
            </Button>
            <Button
              onClick={handleStockInSubmit}
              disabled={stockInMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-submit-stock-in"
            >
              {stockInMutation.isPending ? (t("processing") || "Processing...") : (t("confirmStockIn") || "Confirm Stock In")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>)}
    </div>
  );
}
