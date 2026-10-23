import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Scope = "all" | "category" | "selected";
interface ProductOption { id: string; name: string; sku?: string | null; category?: string | null; price?: string | number | null; }
interface ProductPage { products: ProductOption[]; total: number; totalPages: number; page: number; }
interface PreviewSample { id: string; name: string; price: number | string; newPrice: number | string; }
interface PreviewResult { token: string; total: number; samples: PreviewSample[]; }
interface PreviewContext { percentage: number; scope: Scope; category?: string; productIds?: string[]; }

const copy = {
  title: "Bulk selling price adjustment / تعديل جماعي لأسعار البيع",
  percent: "Percentage / النسبة المئوية",
  scope: "Apply to / نطاق التطبيق",
  all: "All products / كل المنتجات",
  category: "One category / فئة واحدة",
  selected: "Selected products / منتجات محددة",
  categoryPlaceholder: "Choose a category / اختر الفئة",
  search: "Search products / ابحث عن المنتجات",
  selectionCount: "selected / محدد",
  preview: "Review price changes / معاينة التغييرات",
  confirmTitle: "Confirm price adjustment / تأكيد تعديل الأسعار",
  cancel: "Cancel / إلغاء",
  back: "Back / رجوع",
  confirm: "Apply price change / تطبيق تعديل الأسعار",
  count: "Products affected / عدد المنتجات",
  before: "Current / الحالي",
  after: "New price / السعر الجديد",
  note: "Only selling prices will change. Cost prices and inventory remain unchanged.",
  noteAr: "ستتغير أسعار البيع فقط. لن تتغير أسعار التكلفة أو المخزون.",
  loading: "Loading / جارٍ التحميل",
  noProducts: "No matching products / لا توجد منتجات مطابقة",
  retry: "Try again / إعادة المحاولة",
  success: "Selling prices updated / تم تحديث أسعار البيع",
  invalidPercent: "Enter a positive percentage with up to 2 decimals. Maximum decrease: 100%; maximum increase: 10,000%. / أدخل نسبة موجبة بحد أقصى منزلتين عشريتين. أقصى تخفيض: 100٪؛ أقصى زيادة: 10,000٪.",
  chooseCategory: "Choose a category first. / اختر فئة أولاً.",
  chooseProducts: "Select at least one product. / اختر منتجاً واحداً على الأقل.",
  scopeAll: "All products / كل المنتجات",
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Request failed / تعذر إتمام الطلب";
}

export function BulkPriceIncrease() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [percentage, setPercentage] = useState("");
  const [direction, setDirection] = useState<"increase" | "decrease">("increase");
  const [scope, setScope] = useState<Scope>("all");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set<string>());
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewContext, setPreviewContext] = useState<PreviewContext | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const requestLock = useRef(false);
  const busy = working;
  const percentageValue = Number(percentage);
  const maxPercentage = direction === "decrease" ? 100 : 10000;
  const validPercentage = Number.isFinite(percentageValue) && percentageValue > 0 && percentageValue <= maxPercentage && /^\d+(\.\d{1,2})?$/.test(percentage);

  const { data: categories = [], isLoading: categoriesLoading, isError: categoriesError, refetch: refetchCategories } = useQuery<string[]>({
    queryKey: ["/api/products/price-increase/categories"],
    queryFn: async () => {
      const response = await fetch("/api/products/price-increase/categories", { credentials: "include" });
      if (!response.ok) throw new Error(await response.text() || "Unable to load categories");
      return response.json();
    },
    enabled: open && scope === "category",
    retry: false,
  });

  const { data: productPage, isLoading: productsLoading, isError: productsError, refetch: refetchProducts } = useQuery<ProductPage>({
    queryKey: ["/api/products", "bulk-price-picker", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "50", search: search.trim() });
      const response = await fetch(`/api/products?${params.toString()}`, { credentials: "include" });
      if (!response.ok) throw new Error(await response.text() || "Unable to load products");
      return response.json();
    },
    enabled: open && scope === "selected",
    retry: false,
    placeholderData: (previous) => previous,
  });

  useEffect(() => { setPage(1); }, [search]);

  const reset = () => {
    setPercentage("");
    setDirection("increase");
    setScope("all");
    setCategory("");
    setSearch("");
    setPage(1);
    setSelectedIds(new Set<string>());
    setPreview(null);
    setPreviewContext(null);
    setConfirming(false);
  };

  const changeScope = (next: Scope) => {
    setScope(next);
    setPreview(null);
    setPreviewContext(null);
  };
  const invalidatePreview = () => { setPreview(null); setPreviewContext(null); };
  const toggleProduct = (id: string) => {
    setSelectedIds((existing) => {
      const next = new Set(existing);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    invalidatePreview();
  };

  const makePreview = async () => {
    if (requestLock.current) return;
    if (!validPercentage) {
      toast({ title: t("error") || "Error", description: copy.invalidPercent, variant: "destructive" });
      return;
    }
    if (scope === "category" && !category) {
      toast({ title: t("error") || "Error", description: copy.chooseCategory, variant: "destructive" });
      return;
    }
    if (scope === "selected" && selectedIds.size === 0) {
      toast({ title: t("error") || "Error", description: copy.chooseProducts, variant: "destructive" });
      return;
    }
    requestLock.current = true;
    setWorking(true);
    setPreview(null);
    try {
      const context: PreviewContext = {
        percentage: direction === "decrease" ? -percentageValue : percentageValue,
        scope,
        ...(scope === "category" ? { category } : {}),
        ...(scope === "selected" ? { productIds: Array.from(selectedIds) } : {}),
      };
      const response = await apiRequest("POST", "/api/products/price-increase/preview", context);
      const result = await response.json() as PreviewResult;
      setPreview(result);
      setPreviewContext(context);
      setConfirming(true);
    } catch (error) {
      setPreview(null);
      setPreviewContext(null);
      toast({ title: t("error") || "Error", description: errorMessage(error), variant: "destructive" });
    } finally {
      requestLock.current = false;
      setWorking(false);
    }
  };

  const applyIncrease = async () => {
    if (requestLock.current || !preview?.token) return;
    requestLock.current = true;
    setWorking(true);
    try {
      const response = await apiRequest("POST", "/api/products/price-increase/apply", { token: preview.token });
      const result = await response.json() as { updatedCount: number };
      await queryClient.invalidateQueries();
      toast({
        title: copy.success,
        description: `${result.updatedCount} products / ${result.updatedCount} منتج`,
      });
      setOpen(false);
      reset();
    } catch (error) {
      setPreview(null);
      setPreviewContext(null);
      setConfirming(false);
      toast({ title: t("error") || "Error", description: errorMessage(error), variant: "destructive" });
    } finally {
      requestLock.current = false;
      setWorking(false);
    }
  };

  const close = (nextOpen: boolean) => {
    if (requestLock.current) return;
    setOpen(nextOpen);
    if (!nextOpen) reset();
  };
  const pages = productPage?.totalPages || 1;
  const scopeName = previewContext?.scope === "all" ? copy.scopeAll
    : previewContext?.scope === "category" ? `${copy.category.split(" / ")[0]}: ${previewContext.category}`
    : `${copy.selected.split(" / ")[0]} (${previewContext?.productIds?.length || 0})`;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="gap-2" data-testid="button-bulk-price-increase">
        <ArrowUpRight className="h-4 w-4" />
        <span>Bulk price adjustment / تعديل جماعي للأسعار</span>
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{confirming ? copy.confirmTitle : copy.title}</DialogTitle>
            <DialogDescription>
              {confirming
                ? "Review the price changes before applying them. / راجع تغييرات الأسعار قبل تطبيقها."
                : "Choose increase or decrease, enter a percentage, then review before applying. / اختر زيادة أو تخفيضاً، وأدخل النسبة، ثم راجع التغييرات قبل تطبيقها."}
            </DialogDescription>
          </DialogHeader>

          {!confirming ? (
            <div className="space-y-5 py-2">
              <div className="grid gap-2">
                <Label htmlFor="bulk-price-direction">Adjustment / نوع التعديل</Label>
                <select
                  id="bulk-price-direction"
                  data-testid="select-bulk-price-direction"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={direction}
                  disabled={busy}
                  onChange={(event) => {
                    setDirection(event.target.value as "increase" | "decrease");
                    invalidatePreview();
                  }}
                >
                  <option value="increase">Increase prices / زيادة الأسعار</option>
                  <option value="decrease">Decrease prices / تخفيض الأسعار</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bulk-price-percent">{copy.percent}</Label>
                <div className="relative">
                  <Input
                    id="bulk-price-percent"
                    type="number"
                    min="0.01"
                    max={maxPercentage}
                    step="0.01"
                    inputMode="decimal"
                    placeholder="e.g. 12.5"
                    value={percentage}
                    disabled={busy}
                    onChange={(event) => { setPercentage(event.target.value); invalidatePreview(); }}
                    data-testid="input-bulk-price-percent"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">0.01–{maxPercentage.toLocaleString()}% · up to 2 decimals / حتى منزلتين عشريتين</p>
                {direction === "decrease" && percentageValue === 100 && (
                  <p className="text-sm text-destructive">A 100% decrease sets selling prices to 0 LYD. / تخفيض 100٪ يجعل أسعار البيع 0 د.ل.</p>
                )}
              </div>

              <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm font-medium">{copy.scope}</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(["all", "category", "selected"] as Scope[]).map((option) => (
                    <button
                      type="button"
                      key={option}
                      onClick={() => changeScope(option)}
                      disabled={busy}
                      className={`rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${
                        scope === option ? "border-primary bg-primary/5 text-foreground" : "border-input hover:bg-muted/60"
                      }`}
                      aria-pressed={scope === option}
                    >
                      {option === "all" ? copy.all : option === "category" ? copy.category : copy.selected}
                    </button>
                  ))}
                </div>
              </fieldset>

              {scope === "category" && (
                <div className="grid gap-2">
                  <Label htmlFor="bulk-price-category">{copy.category}</Label>
                  {categoriesLoading ? (
                    <div className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{copy.loading}</div>
                  ) : categoriesError ? (
                    <div className="flex items-center justify-between rounded-md border border-destructive/30 p-3 text-sm">
                      <span className="text-destructive">Unable to load categories / تعذر تحميل الفئات</span>
                      <Button type="button" variant="outline" size="sm" onClick={() => refetchCategories()}>{copy.retry}</Button>
                    </div>
                  ) : (
                    <select
                      id="bulk-price-category"
                      value={category}
                      onChange={(event) => { setCategory(event.target.value); invalidatePreview(); }}
                      disabled={busy}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">{copy.categoryPlaceholder}</option>
                      {categories.map((item) => <option value={item} key={item}>{item}</option>)}
                    </select>
                  )}
                </div>
              )}

              {scope === "selected" && (
                <section className="space-y-3 rounded-lg border bg-muted/20 p-3" aria-label="Product selection">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>{copy.selected}</Label>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      {selectedIds.size} {copy.selectionCount}
                    </span>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                      placeholder={copy.search}
                      className="pl-9"
                      disabled={busy}
                    />
                  </div>
                  {productsError ? (
                    <div className="flex items-center justify-between rounded-md border border-destructive/30 p-3 text-sm">
                      <span className="text-destructive">Unable to load products / تعذر تحميل المنتجات</span>
                      <Button type="button" variant="outline" size="sm" onClick={() => refetchProducts()}>{copy.retry}</Button>
                    </div>
                  ) : productsLoading && !productPage ? (
                    <div className="space-y-2 py-2">
                      {[0, 1, 2].map((item) => <div key={item} className="h-10 animate-pulse rounded-md bg-muted" />)}
                    </div>
                  ) : productPage?.products.length ? (
                    <div className="divide-y rounded-md border bg-background">
                      {productPage.products.map((product) => (
                        <label key={product.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(product.id)}
                            onChange={() => toggleProduct(product.id)}
                            disabled={busy}
                            className="h-4 w-4 accent-primary"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{product.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{product.sku || product.category || ""}</span>
                          </span>
                          <span className="text-xs tabular-nums text-muted-foreground">{Number(product.price || 0).toFixed(2)} LYD</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">{copy.noProducts}</div>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{productPage?.total || 0} products / منتج</span>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || busy} aria-label="Previous page">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span>{page} / {pages}</span>
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((current) => Math.min(pages, current + 1))} disabled={page >= pages || busy} aria-label="Next page">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </section>
              )}
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => close(false)} disabled={busy}><X className="mr-2 h-4 w-4" />{copy.cancel}</Button>
                <Button onClick={makePreview} disabled={busy || !validPercentage || (scope === "category" && !category) || (scope === "selected" && selectedIds.size === 0)} data-testid="button-preview-price-increase">
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  {copy.preview}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">{copy.count}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{preview?.total.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">{copy.scope}</p>
                  <p className="mt-1 text-sm font-semibold">{scopeName}</p>
                  <p className="text-sm font-medium">
                    {(previewContext?.percentage ?? 0) < 0 ? "Decrease / تخفيض" : "Increase / زيادة"}
                    {" "}{(previewContext?.percentage ?? 0) > 0 ? "+" : ""}{previewContext?.percentage}%
                  </p>
                  {previewContext?.percentage === -100 && (
                    <p className="text-sm text-destructive">Selling prices will become 0 LYD. / ستصبح أسعار البيع 0 د.ل.</p>
                  )}
                </div>
              </div>
              <div className="rounded-md border border-amber-300/70 bg-amber-50/70 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                <p>{copy.note}</p>
                <p dir="rtl" className="mt-1">{copy.noteAr}</p>
              </div>
              <div className="overflow-hidden rounded-md border">
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <span>Product / المنتج</span><span className="text-right">{copy.before}</span><span className="text-right">{copy.after}</span>
                </div>
                {preview?.samples.length ? (
                  <div className="divide-y">
                    {preview.samples.map((sample) => (
                      <div key={sample.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2.5 text-sm">
                        <span className="min-w-0 truncate font-medium">{sample.name}</span>
                        <span className="whitespace-nowrap text-right tabular-nums text-muted-foreground">{Number(sample.price).toFixed(2)} LYD</span>
                        <span className="whitespace-nowrap text-right font-semibold tabular-nums text-primary">{Number(sample.newPrice).toFixed(2)} LYD</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="p-4 text-center text-sm text-muted-foreground">No sample prices / لا توجد أسعار للعرض</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Showing {preview?.samples.length || 0} sample prices / عرض عينة من الأسعار</p>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => setConfirming(false)} disabled={busy}>{copy.back}</Button>
                <Button variant="destructive" onClick={applyIncrease} disabled={busy || !preview?.token} data-testid="button-confirm-price-increase">
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowUpRight className="mr-2 h-4 w-4" />}
                  {busy ? copy.loading : copy.confirm}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default BulkPriceIncrease;
