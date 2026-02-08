import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { History, Printer, Eye, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/header";
import type { SalesInvoiceWithItems } from "@shared/schema";
import logoPath from "@assets/ALFANI-removebg-preview_1768829603636.png";

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

export default function Sales() {
  const { t } = useTranslation();
  const printRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoiceWithItems | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string>(logoPath);

  useEffect(() => {
    getLogoBase64(logoPath).then(setLogoBase64);
  }, []);

  const { data: invoices = [], isLoading } = useQuery<SalesInvoiceWithItems[]>({
    queryKey: ["/api/invoices"],
  });

  const filteredInvoices = invoices.filter(invoice =>
    invoice.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleView = (invoice: SalesInvoiceWithItems) => {
    setSelectedInvoice(invoice);
    setIsViewDialogOpen(true);
  };

  const handlePrint = (invoice: SalesInvoiceWithItems) => {
    const isRtl = document.dir === 'rtl';
    const align = isRtl ? 'right' : 'left';
    const alignEnd = isRtl ? 'left' : 'right';
    const dir = isRtl ? 'rtl' : 'ltr';
    const dateStr = new Date(invoice.createdAt).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    const timeStr = new Date(invoice.createdAt).toLocaleTimeString(isRtl ? 'ar-SA' : 'en-US', {
      hour: '2-digit', minute: '2-digit'
    });
    const subtotal = invoice.items.reduce((s, i) => s + Number(i.lineTotal), 0);
    const totalQty = invoice.items.reduce((s, i) => s + i.quantity, 0);

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html dir="${dir}">
          <head>
            <meta charset="UTF-8">
            <title>${t("invoice")} - ${invoice.invoiceNumber}</title>
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

              /* === TOP ACCENT BAR === */
              .accent-bar {
                height: 6px;
                background: linear-gradient(90deg, #0f2744 0%, #1e3a5f 40%, #c8a42a 100%);
                border-radius: 3px;
                margin-bottom: 32px;
              }

              /* === HEADER === */
              .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 36px;
              }
              .brand { display: flex; align-items: center; gap: 18px; }
              .logo-wrap {
                width: 90px; height: 90px;
                border-radius: 16px;
                overflow: hidden;
                display: flex; align-items: center; justify-content: center;
                background: #f8fafc;
                border: 2px solid #e2e8f0;
              }
              .logo-wrap img { width: 100%; height: 100%; object-fit: contain; }
              .brand-text {}
              .brand-name {
                font-size: 32px; font-weight: 800; color: #0f2744;
                letter-spacing: -0.5px; line-height: 1;
              }
              .brand-tagline {
                font-size: 11px; font-weight: 500; color: #64748b;
                text-transform: uppercase; letter-spacing: 2px; margin-top: 4px;
              }
              .invoice-badge {
                text-align: ${alignEnd};
              }
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
              .invoice-num {
                font-size: 22px; font-weight: 700; color: #0f2744;
                font-variant-numeric: tabular-nums;
              }
              .invoice-date {
                font-size: 12px; color: #64748b; margin-top: 4px;
                font-weight: 500;
              }

              /* === INFO CARDS === */
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

              /* === TABLE === */
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

              /* === TOTALS === */
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

              /* === SIGNATURES === */
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

              /* === FOOTER === */
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
                  <div class="invoice-num">${invoice.invoiceNumber}</div>
                  <div class="invoice-date">${dateStr} &bull; ${timeStr}</div>
                </div>
              </div>

              <div class="info-row">
                <div class="info-card customer">
                  <div class="info-card-label">${t("billTo") || "Customer"}</div>
                  <div class="info-card-value">${invoice.customerName}</div>
                </div>
                <div class="info-card branch">
                  <div class="info-card-label">${t("branch")}</div>
                  <div class="info-card-value">${invoice.branch === 'ALFANI1' ? 'ALFANI 1' : invoice.branch === 'ALFANI2' ? 'ALFANI 2' : invoice.branch}</div>
                </div>
                <div class="info-card summary">
                  <div class="info-card-label">${t("items")}</div>
                  <div class="info-card-value">${totalQty} ${isRtl ? 'قطعة' : 'pcs'}</div>
                  <div class="info-card-sub">${invoice.items.length} ${isRtl ? 'منتج' : 'products'}</div>
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
                  ${invoice.items.map((item, idx) => `
                    <tr>
                      <td class="num">${String(idx + 1).padStart(2, '0')}</td>
                      <td class="name">${item.productName}</td>
                      <td class="qty">${item.quantity}</td>
                      <td class="price">${Number(item.unitPrice).toFixed(2)} <small style="color:#94a3b8">LYD</small></td>
                      <td class="total">${Number(item.lineTotal).toFixed(2)} <small style="color:#94a3b8">LYD</small></td>
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
                  <div class="totals-row grand-total">
                    <span class="label">${t("total")}</span>
                    <span class="value">${Number(invoice.totalAmount).toFixed(2)} LYD</span>
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
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 400);
    }
  };

  const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
  const totalItems = invoices.reduce((sum, inv) => sum + inv.items.reduce((s, i) => s + i.quantity, 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <Header title={t("salesHistory")} description={t("viewAllInvoices")} />
      
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("totalInvoices")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{invoices.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("totalSales")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSales.toFixed(2)} LYD</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("itemsSold")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalItems}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {t("invoices")}
            </CardTitle>
            <CardDescription>{t("allSalesInvoices")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("searchInvoices")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ltr:pl-10 rtl:pr-10"
                  data-testid="input-search-invoices"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8">{t("loading")}</div>
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("noInvoicesFound")}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("invoiceNumber")}</TableHead>
                      <TableHead>{t("customerName")}</TableHead>
                      <TableHead>{t("branch")}</TableHead>
                      <TableHead>{t("items")}</TableHead>
                      <TableHead>{t("total")}</TableHead>
                      <TableHead>{t("date")}</TableHead>
                      <TableHead>{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map(invoice => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-mono">{invoice.invoiceNumber}</TableCell>
                        <TableCell>{invoice.customerName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{invoice.branch}</Badge>
                        </TableCell>
                        <TableCell>{invoice.items.length}</TableCell>
                        <TableCell className="font-semibold">{Number(invoice.totalAmount).toFixed(2)} LYD</TableCell>
                        <TableCell>{new Date(invoice.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleView(invoice)} data-testid={`button-view-${invoice.id}`}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handlePrint(invoice)} data-testid={`button-print-${invoice.id}`}>
                              <Printer className="h-4 w-4" />
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

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("invoiceDetails")}</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t("invoiceNumber")}</p>
                  <p className="font-mono font-semibold">{selectedInvoice.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("date")}</p>
                  <p>{new Date(selectedInvoice.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("customerName")}</p>
                  <p className="font-semibold">{selectedInvoice.customerName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("branch")}</p>
                  <Badge variant="outline">{selectedInvoice.branch}</Badge>
                </div>
              </div>

              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("product")}</TableHead>
                      <TableHead>{t("quantity")}</TableHead>
                      <TableHead>{t("unitPrice")}</TableHead>
                      <TableHead>{t("total")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoice.items.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{Number(item.unitPrice).toFixed(2)} LYD</TableCell>
                        <TableCell>{Number(item.lineTotal).toFixed(2)} LYD</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <span className="text-lg font-semibold">{t("total")}</span>
                <span className="text-2xl font-bold">{Number(selectedInvoice.totalAmount).toFixed(2)} LYD</span>
              </div>

              <Button onClick={() => handlePrint(selectedInvoice)} className="w-full" data-testid="button-print-dialog">
                <Printer className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("print")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
