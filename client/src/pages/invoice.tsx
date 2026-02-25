import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Minus, Printer, Trash2, ShoppingCart, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Header } from "@/components/header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Product, ProductWithInventory, Safe, Setting } from "@shared/schema";
import logoPath from "@assets/alfani-logo.png";

function getLogoBase64(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } else {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  branch: string;
}

export default function Invoice() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [customerName, setCustomerName] = useState("");
  const [branch, setBranch] = useState<"ALFANI1" | "ALFANI2">("ALFANI1");
  const [selectedSafeId, setSelectedSafeId] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [logoBase64, setLogoBase64] = useState<string>(logoPath);
  const [discountType, setDiscountType] = useState<"amount" | "percentage">("amount");
  const [discountValue, setDiscountValue] = useState<string>("");
  const [includeService, setIncludeService] = useState(false);
  const [serviceAmount, setServiceAmount] = useState<string>("");
  const [paymentType, setPaymentType] = useState<"cash" | "credit">("cash");

  useEffect(() => {
    getLogoBase64(logoPath).then(setLogoBase64);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: productsData, isLoading } = useQuery<{ products: ProductWithInventory[]; total: number }>({
    queryKey: ["/api/products/with-inventory", "invoice", 1, 50, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/products/with-inventory?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
    placeholderData: keepPreviousData,
    staleTime: 3000,
  });

  const products = productsData?.products || [];

  const { data: safes = [] } = useQuery<Safe[]>({
    queryKey: ["/api/safes"],
  });

  const { data: allSettings = [] } = useQuery<Setting[]>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const markupPercentage = (() => {
    const setting = allSettings.find(s => s.key === "global_markup_percentage");
    return setting ? parseFloat(setting.value) || 0 : 0;
  })();

  const applyMarkup = (basePrice: number) => {
    if (markupPercentage <= 0) return basePrice;
    return basePrice * (1 + markupPercentage / 100);
  };

  useEffect(() => {
    if (safes.length > 0 && !selectedSafeId) {
      setSelectedSafeId(safes[0].id);
    }
  }, [safes, selectedSafeId]);

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: { customerName: string; branch: string; items: CartItem[]; safeId: string | null; discountType: string; discountValue: string; serviceAmount: string; paymentType: string }) => {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.message || `Error ${res.status}`);
      }
      return json;
    },
    onSuccess: (data) => {
      try {
        handlePrint();
      } catch (e) {
        console.error("Print error:", e);
      }
      setCart([]);
      setCustomerName("");
      setDiscountType("amount");
      setDiscountValue("");
      setIncludeService(false);
      setServiceAmount("");
      setPaymentType("cash");
      toast({ title: t("success"), description: t("invoiceCreated") });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/products/with-inventory"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/safes"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"], refetchType: "all" });
    },
    onError: (error: any) => {
      const msg = error?.message || t("failedCreateInvoice");
      toast({ title: t("error"), description: msg, variant: "destructive" });
    },
  });

  const addToCart = (product: ProductWithInventory) => {
    const branchInv = product.inventory.find(inv => inv.branch === branch);
    const availableQty = branchInv?.quantity || 0;
    
    const existingItem = cart.find(item => item.productId === product.id && item.branch === branch);
    const currentQty = existingItem?.quantity || 0;
    
    if (currentQty >= availableQty) {
      toast({ title: t("error"), description: t("notEnoughStock"), variant: "destructive" });
      return;
    }

    if (existingItem) {
      setCart(cart.map(item => 
        (item.productId === product.id && item.branch === branch)
          ? { ...item, quantity: item.quantity + 1, lineTotal: (item.quantity + 1) * item.unitPrice }
          : item
      ));
    } else {
      const markedUpPrice = applyMarkup(Number(product.price || 0));
      setCart([...cart, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: Math.round(markedUpPrice * 100) / 100,
        lineTotal: Math.round(markedUpPrice * 100) / 100,
        branch: branch,
      }]);
    }
  };

  const updateQuantity = (productId: string, itemBranch: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCart(cart.filter(item => !(item.productId === productId && item.branch === itemBranch)));
    } else {
      const product = products.find(p => p.id === productId);
      const branchInv = product?.inventory.find(inv => inv.branch === itemBranch);
      const availableQty = branchInv?.quantity || 0;
      
      if (newQuantity > availableQty) {
        toast({ title: t("error"), description: t("notEnoughStock"), variant: "destructive" });
        return;
      }
      
      setCart(cart.map(item =>
        (item.productId === productId && item.branch === itemBranch)
          ? { ...item, quantity: newQuantity, lineTotal: newQuantity * item.unitPrice }
          : item
      ));
    }
  };

  const removeFromCart = (productId: string, itemBranch: string) => {
    setCart(cart.filter(item => !(item.productId === productId && item.branch === itemBranch)));
  };

  const getSubtotal = () => cart.reduce((sum, item) => sum + item.lineTotal, 0);

  const getDiscountAmount = () => {
    const subtotal = getSubtotal();
    const dv = parseFloat(discountValue) || 0;
    if (dv <= 0) return 0;
    if (discountType === "percentage") {
      return Math.min((subtotal * dv) / 100, subtotal);
    }
    return Math.min(dv, subtotal);
  };

  const getServiceAmount = () => includeService ? (parseFloat(serviceAmount) || 0) : 0;

  const getTotal = () => Math.max(getSubtotal() - getDiscountAmount() + getServiceAmount(), 0);

  const handlePrint = () => {
    const isRtl = document.dir === 'rtl';
    const align = isRtl ? 'right' : 'left';
    const alignEnd = isRtl ? 'left' : 'right';
    const dir = isRtl ? 'rtl' : 'ltr';
    const dateStr = new Date().toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    const timeStr = new Date().toLocaleTimeString(isRtl ? 'ar-SA' : 'en-US', {
      hour: '2-digit', minute: '2-digit'
    });
    const subtotal = getSubtotal();
    const discountAmt = getDiscountAmount();
    const svcAmount = getServiceAmount();
    const finalTotal = getTotal();
    const totalQty = cart.reduce((s, i) => s + i.quantity, 0);

    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.top = '-10000px';
    printFrame.style.left = '-10000px';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    document.body.appendChild(printFrame);
    const printDoc = printFrame.contentDocument || printFrame.contentWindow?.document;
    if (printDoc) {
      printDoc.open();
      printDoc.write(`
        <html dir="${dir}">
          <head>
            <meta charset="UTF-8">
            <title>${t("invoice")}</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                color: #0f172a;
                direction: ${dir};
                background: white;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .page {
                max-width: 780px;
                margin: 0 auto;
                padding: 40px;
                position: relative;
              }
              .accent-bar {
                height: 6px;
                background: linear-gradient(90deg, #0f2744 0%, #1e3a5f 40%, #c8a42a 100%);
                border-radius: 3px;
                margin-bottom: 32px;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 36px;
              }
              .brand { display: flex; align-items: center; gap: 18px; }
              .logo-wrap {
                width: 140px; height: 140px;
                border-radius: 16px;
                overflow: hidden;
                display: flex; align-items: center; justify-content: center;
                background: #f8fafc;
                border: 2px solid #e2e8f0;
              }
              .logo-wrap img { width: 100%; height: 100%; object-fit: contain; }
              .brand-name {
                font-size: 32px; font-weight: 800; color: #0f2744;
                letter-spacing: -0.5px; line-height: 1;
              }
              .brand-tagline {
                font-size: 11px; font-weight: 500; color: #64748b;
                text-transform: uppercase; letter-spacing: 2px; margin-top: 4px;
              }
              .invoice-badge { text-align: ${alignEnd}; }
              .badge-label {
                display: inline-block;
                background: linear-gradient(135deg, #0f2744, #1e3a5f);
                color: white;
                font-size: 13px; font-weight: 700;
                letter-spacing: 3px; text-transform: uppercase;
                padding: 8px 24px;
                border-radius: 6px;
                margin-bottom: 14px;
              }
              .invoice-date {
                font-size: 12px; color: #64748b; margin-top: 4px;
                font-weight: 500;
              }
              .info-row {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 16px;
                margin-bottom: 32px;
              }
              .info-card {
                border: 1.5px solid #e2e8f0;
                border-radius: 10px;
                padding: 16px 18px;
                position: relative;
                overflow: hidden;
              }
              .info-card::before {
                content: '';
                position: absolute;
                top: 0; ${isRtl ? 'right' : 'left'}: 0;
                width: 4px; height: 100%;
              }
              .info-card.customer::before { background: #c8a42a; }
              .info-card.branch::before { background: #1e3a5f; }
              .info-card.summary::before { background: #059669; }
              .info-card-label {
                font-size: 9px; font-weight: 700; color: #94a3b8;
                text-transform: uppercase; letter-spacing: 1.5px;
                margin-bottom: 6px;
              }
              .info-card-value {
                font-size: 15px; font-weight: 600; color: #0f2744;
              }
              .info-card-sub {
                font-size: 11px; color: #64748b; margin-top: 2px;
              }
              .items-table {
                width: 100%;
                border-collapse: separate;
                border-spacing: 0;
                margin-bottom: 28px;
                border: 1.5px solid #e2e8f0;
                border-radius: 10px;
                overflow: hidden;
              }
              .items-table thead {
                background: linear-gradient(135deg, #0f2744 0%, #1a3352 100%);
              }
              .items-table th {
                padding: 13px 18px;
                font-size: 10px; font-weight: 700;
                text-transform: uppercase; letter-spacing: 1px;
                color: rgba(255,255,255,0.95);
                text-align: ${align};
                border: none;
              }
              .items-table th.num { width: 50px; text-align: center; }
              .items-table th.price, .items-table th.total { text-align: ${alignEnd}; }
              .items-table th.qty { text-align: center; width: 80px; }
              .items-table td {
                padding: 12px 18px;
                font-size: 13px; color: #334155;
                border-bottom: 1px solid #f1f5f9;
                text-align: ${align};
              }
              .items-table td.num {
                text-align: center; color: #94a3b8;
                font-weight: 600; font-size: 12px;
              }
              .items-table td.name { font-weight: 500; color: #0f2744; }
              .items-table td.qty { text-align: center; font-weight: 600; }
              .items-table td.price { text-align: ${alignEnd}; font-variant-numeric: tabular-nums; }
              .items-table td.total {
                text-align: ${alignEnd}; font-weight: 600;
                color: #0f2744; font-variant-numeric: tabular-nums;
              }
              .items-table tbody tr:nth-child(even) { background: #fafbfc; }
              .items-table tbody tr:last-child td { border-bottom: none; }
              .totals-wrapper {
                display: flex;
                justify-content: ${isRtl ? 'flex-start' : 'flex-end'};
                margin-bottom: 36px;
              }
              .totals-card {
                width: 300px;
                border: 1.5px solid #e2e8f0;
                border-radius: 10px;
                overflow: hidden;
              }
              .totals-row {
                display: flex; justify-content: space-between;
                padding: 10px 20px;
                font-size: 13px; color: #475569;
              }
              .totals-row .label { font-weight: 500; }
              .totals-row .value { font-weight: 600; font-variant-numeric: tabular-nums; }
              .totals-row.items-count {
                background: #fafbfc;
                border-bottom: 1px solid #f1f5f9;
                font-size: 12px; color: #64748b;
              }
              .totals-row.subtotal {
                border-bottom: 1px solid #f1f5f9;
              }
              .totals-row.grand-total {
                background: linear-gradient(135deg, #0f2744 0%, #1a3352 100%);
                padding: 14px 20px;
              }
              .totals-row.grand-total .label {
                color: rgba(255,255,255,0.8);
                font-size: 13px; font-weight: 600;
                text-transform: uppercase; letter-spacing: 1px;
              }
              .totals-row.grand-total .value {
                color: #c8a42a;
                font-size: 20px; font-weight: 800;
              }
              .signatures {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 60px;
                margin: 40px 0 36px;
              }
              .sig-block { text-align: center; }
              .sig-label-top {
                font-size: 10px; font-weight: 700; color: #94a3b8;
                text-transform: uppercase; letter-spacing: 1.5px;
                margin-bottom: 36px;
              }
              .sig-line {
                border-bottom: 2px dashed #cbd5e1;
                margin-bottom: 6px;
              }
              .sig-hint {
                font-size: 10px; color: #94a3b8;
                font-style: italic;
              }
              .footer {
                border-top: 1.5px solid #e2e8f0;
                padding-top: 20px;
                text-align: center;
              }
              .footer-brand {
                font-size: 16px; font-weight: 700; color: #0f2744;
                letter-spacing: 3px;
                margin-bottom: 4px;
              }
              .footer-tagline {
                font-size: 10px; color: #c8a42a;
                font-weight: 600; text-transform: uppercase;
                letter-spacing: 2px; margin-bottom: 10px;
              }
              .footer-note {
                font-size: 9px; color: #94a3b8;
                font-style: italic;
              }
              .footer-accent {
                height: 3px;
                background: linear-gradient(90deg, #0f2744 0%, #1e3a5f 40%, #c8a42a 100%);
                border-radius: 2px;
                margin-top: 16px;
              }
              @media print {
                body { margin: 0; padding: 0; }
                .page { padding: 24px; }
                @page { margin: 0.3in; size: A4; }
              }
            </style>
          </head>
          <body>
            <div class="page">
              <div class="accent-bar"></div>

              <div class="header">
                <div class="brand">
                  <div class="logo-wrap">
                    <img src="${logoBase64}" alt="ALFANI" />
                  </div>
                  <div class="brand-text">
                    <div class="brand-name">ALFANI</div>
                    <div class="brand-tagline">${t("carAccessories") || "Car Accessories"}</div>
                  </div>
                </div>
                <div class="invoice-badge">
                  <div class="badge-label">${t("invoice")}</div>
                  <div class="invoice-date">${dateStr} &bull; ${timeStr}</div>
                </div>
              </div>

              <div class="info-row">
                <div class="info-card customer">
                  <div class="info-card-label">${t("billTo") || "Customer"}</div>
                  <div class="info-card-value">${customerName}</div>
                </div>
                <div class="info-card branch">
                  <div class="info-card-label">${t("branch")}</div>
                  <div class="info-card-value">${branch === 'ALFANI1' ? 'ALFANI 1' : 'ALFANI 2'}</div>
                </div>
                <div class="info-card summary">
                  <div class="info-card-label">${t("items")}</div>
                  <div class="info-card-value">${totalQty} ${isRtl ? 'قطعة' : 'pcs'}</div>
                  <div class="info-card-sub">${cart.length} ${isRtl ? 'منتج' : 'products'}</div>
                </div>
              </div>

              <table class="items-table">
                <thead>
                  <tr>
                    <th class="num">#</th>
                    <th>${t("product")}</th>
                    <th class="qty">${t("quantity")}</th>
                    <th class="price">${t("unitPrice")}</th>
                    <th class="total">${t("total")}</th>
                  </tr>
                </thead>
                <tbody>
                  ${cart.map((item, idx) => `
                    <tr>
                      <td class="num">${String(idx + 1).padStart(2, '0')}</td>
                      <td class="name">${item.productName} <small style="color:#64748b">(${item.branch})</small></td>
                      <td class="qty">${item.quantity}</td>
                      <td class="price">${item.unitPrice.toFixed(2)} <small style="color:#94a3b8">LYD</small></td>
                      <td class="total">${item.lineTotal.toFixed(2)} <small style="color:#94a3b8">LYD</small></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>

              <div class="totals-wrapper">
                <div class="totals-card">
                  <div class="totals-row items-count">
                    <span class="label">${t("totalItems") || "Total Items"}</span>
                    <span class="value">${totalQty}</span>
                  </div>
                  <div class="totals-row subtotal">
                    <span class="label">${t("subtotal")}</span>
                    <span class="value">${subtotal.toFixed(2)} LYD</span>
                  </div>
                  ${discountAmt > 0 ? `
                  <div class="totals-row subtotal" style="color: #dc2626;">
                    <span class="label">${t("discount")} ${discountType === 'percentage' ? `(${parseFloat(discountValue || '0')}%)` : ''}</span>
                    <span class="value">-${discountAmt.toFixed(2)} LYD</span>
                  </div>` : ''}
                  ${svcAmount > 0 ? `
                  <div class="totals-row subtotal" style="color: #0369a1;">
                    <span class="label">${t("serviceFee") || "Service"}</span>
                    <span class="value">+${svcAmount.toFixed(2)} LYD</span>
                  </div>` : ''}
                  <div class="totals-row grand-total">
                    <span class="label">${t("total")}</span>
                    <span class="value">${finalTotal.toFixed(2)} LYD</span>
                  </div>
                </div>
              </div>

              <div class="signatures">
                <div class="sig-block">
                  <div class="sig-label-top">${t("authorizedBy") || "Authorized By"}</div>
                  <div class="sig-line"></div>
                  <div class="sig-hint">${isRtl ? 'التوقيع والتاريخ' : 'Signature & Date'}</div>
                </div>
                <div class="sig-block">
                  <div class="sig-label-top">${t("receivedBy") || "Received By"}</div>
                  <div class="sig-line"></div>
                  <div class="sig-hint">${isRtl ? 'التوقيع والتاريخ' : 'Signature & Date'}</div>
                </div>
              </div>

              <div class="footer">
                <div class="footer-brand">ALFANI</div>
                <div class="footer-tagline">${t("carAccessories") || "Car Accessories"}</div>
                <div class="footer-note">${t("autoGenerated") || "This is a computer-generated invoice"}</div>
                <div class="footer-accent"></div>
              </div>
            </div>
          </body>
        </html>
      `);
      printDoc.close();
      setTimeout(() => {
        try {
          printFrame.contentWindow?.print();
        } catch (e) {
          console.error("Print failed:", e);
        }
        setTimeout(() => {
          try { document.body.removeChild(printFrame); } catch {}
        }, 2000);
      }, 500);
    } else {
      try { document.body.removeChild(printFrame); } catch {}
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
    const invoiceBranch = cart[0]?.branch || branch;
    const effectiveSafeId = paymentType === "credit" ? null : (selectedSafeId || null);
    createInvoiceMutation.mutate({ customerName, branch: invoiceBranch, items: cart, safeId: effectiveSafeId, discountType, discountValue, serviceAmount: includeService ? serviceAmount : "0", paymentType });
  };

  const filteredProducts = products.filter(product => product.isActive);

  const getAvailableQuantity = (product: ProductWithInventory) => {
    const branchInventory = product.inventory.find(inv => inv.branch === branch);
    return branchInventory?.quantity || 0;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title={t("newInvoice")} description={t("createNewInvoice")} />
      
      <div className="p-6">
        {markupPercentage > 0 && (
          <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800 flex items-center gap-2" data-testid="markup-banner">
            <span className="text-orange-600 dark:text-orange-400 font-semibold text-sm">
              +{markupPercentage}% {t("markupApplied")}
            </span>
          </div>
        )}
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
                        <TableCell>{product.sku || "-"}</TableCell>
                        <TableCell>
                          {markupPercentage > 0 ? (
                            <div>
                              <span className="font-medium">{applyMarkup(Number(product.price || 0)).toFixed(2)} LYD</span>
                              <span className="block text-xs text-muted-foreground line-through">{Number(product.price || 0).toFixed(2)}</span>
                            </div>
                          ) : (
                            <span>{Number(product.price || 0).toFixed(2)} LYD</span>
                          )}
                        </TableCell>
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
              <div>
                <Label>{t("paymentType")}</Label>
                <div className="flex gap-2 mt-1">
                  <Button
                    type="button"
                    variant={paymentType === "cash" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPaymentType("cash")}
                    data-testid="button-payment-cash"
                  >
                    {t("cashSale")}
                  </Button>
                  <Button
                    type="button"
                    variant={paymentType === "credit" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPaymentType("credit")}
                    data-testid="button-payment-credit"
                  >
                    {t("creditSale")}
                  </Button>
                </div>
              </div>

              {safes.filter(s => s.isActive).length > 0 && paymentType === "cash" && (
              <div>
                <Label>{t("cashbox")}</Label>
                <Select value={selectedSafeId} onValueChange={setSelectedSafeId}>
                  <SelectTrigger data-testid="select-cashbox">
                    <SelectValue placeholder={t("selectCashbox")} />
                  </SelectTrigger>
                  <SelectContent>
                    {safes.filter(s => s.isActive).map(safe => (
                      <SelectItem key={safe.id} value={safe.id}>
                        {safe.name} ({Number(safe.balanceLYD).toFixed(2)} LYD)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              )}
              
              <div>
                <Label>{t("discount")}</Label>
                <div className="flex gap-2">
                  <Select value={discountType} onValueChange={(v) => setDiscountType(v as "amount" | "percentage")}>
                    <SelectTrigger className="w-32" data-testid="select-discount-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amount">{t("fixedAmount") || "Fixed (LYD)"}</SelectItem>
                      <SelectItem value="percentage">{t("percentage") || "%"}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={discountType === "percentage" ? "0%" : "0.00 LYD"}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    data-testid="input-discount-value"
                  />
                </div>
                {getDiscountAmount() > 0 && (
                  <p className="text-sm text-red-500 mt-1" data-testid="text-discount-preview">
                    -{getDiscountAmount().toFixed(2)} LYD {t("discountApplied") || "discount applied"}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={includeService ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setIncludeService(!includeService);
                      if (includeService) setServiceAmount("");
                    }}
                    data-testid="button-toggle-service"
                  >
                    <Wrench className="h-4 w-4 mr-1" />
                    {t("serviceFee") || "Service Fee"}
                  </Button>
                </div>
                {includeService && (
                  <div className="mt-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00 LYD"
                      value={serviceAmount}
                      onChange={(e) => setServiceAmount(e.target.value)}
                      data-testid="input-service-amount"
                    />
                    {getServiceAmount() > 0 && (
                      <p className="text-sm text-blue-600 mt-1" data-testid="text-service-preview">
                        +{getServiceAmount().toFixed(2)} LYD {t("serviceAdded") || "service added"}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {cart.length > 0 ? (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("product")}</TableHead>
                        <TableHead>{t("branch")}</TableHead>
                        <TableHead>{t("quantity")}</TableHead>
                        <TableHead>{t("price")}</TableHead>
                        <TableHead>{t("total")}</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cart.map(item => (
                        <TableRow key={`${item.productId}-${item.branch}`}>
                          <TableCell>{item.productName}</TableCell>
                          <TableCell><span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-muted">{item.branch}</span></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button size="icon" variant="outline" onClick={() => updateQuantity(item.productId, item.branch, item.quantity - 1)}>
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span>{item.quantity}</span>
                              <Button size="icon" variant="outline" onClick={() => updateQuantity(item.productId, item.branch, item.quantity + 1)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>{item.unitPrice.toFixed(2)} LYD</TableCell>
                          <TableCell>{item.lineTotal.toFixed(2)} LYD</TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => removeFromCart(item.productId, item.branch)}>
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
              
              <div className="space-y-2 pt-4 border-t">
                {(getDiscountAmount() > 0 || getServiceAmount() > 0) && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t("subtotal")}</span>
                      <span className="text-sm">{getSubtotal().toFixed(2)} LYD</span>
                    </div>
                    {getDiscountAmount() > 0 && (
                      <div className="flex justify-between items-center text-red-500">
                        <span className="text-sm">{t("discount")} {discountType === "percentage" ? `(${discountValue}%)` : ""}</span>
                        <span className="text-sm">-{getDiscountAmount().toFixed(2)} LYD</span>
                      </div>
                    )}
                    {getServiceAmount() > 0 && (
                      <div className="flex justify-between items-center text-blue-600">
                        <span className="text-sm">{t("serviceFee") || "Service Fee"}</span>
                        <span className="text-sm">+{getServiceAmount().toFixed(2)} LYD</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">{t("total")}</span>
                  <span className="text-2xl font-bold">{getTotal().toFixed(2)} LYD</span>
                </div>
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

    </div>
  );
}
