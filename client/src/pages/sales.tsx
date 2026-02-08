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

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html dir="${dir}">
          <head>
            <meta charset="UTF-8">
            <title>${t("invoice")} - ${invoice.invoiceNumber}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                padding: 30px;
                color: #1a1a2e;
                direction: ${dir};
                background: white;
              }
              .invoice-wrapper {
                max-width: 800px;
                margin: 0 auto;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                border-bottom: 3px solid #1e3a5f;
                padding-bottom: 20px;
                margin-bottom: 24px;
              }
              .header-left { display: flex; align-items: center; gap: 16px; }
              .logo { height: 80px; width: auto; }
              .company-name { font-size: 28px; font-weight: 700; color: #1e3a5f; }
              .company-sub { font-size: 12px; color: #64748b; margin-top: 2px; }
              .header-right { text-align: ${alignEnd}; }
              .invoice-title {
                font-size: 24px; font-weight: 700; color: #d4a017;
                text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;
              }
              .invoice-meta { font-size: 13px; color: #475569; line-height: 1.8; }
              .invoice-meta strong { color: #1e3a5f; }
              .info-section {
                display: flex; justify-content: space-between;
                margin-bottom: 24px; gap: 24px;
              }
              .info-box {
                flex: 1; background: #f8fafc; border-radius: 8px;
                padding: 16px; border: 1px solid #e2e8f0;
              }
              .info-label {
                font-size: 11px; font-weight: 600; text-transform: uppercase;
                letter-spacing: 1px; color: #d4a017; margin-bottom: 8px;
              }
              .info-value { font-size: 14px; color: #334155; line-height: 1.6; }
              .info-value strong { color: #1e3a5f; font-size: 16px; }
              table {
                width: 100%; border-collapse: collapse;
                margin-bottom: 24px; border-radius: 8px; overflow: hidden;
              }
              thead { background: #1e3a5f; }
              th {
                padding: 12px 16px; font-size: 12px; font-weight: 600;
                text-transform: uppercase; letter-spacing: 0.5px; color: white;
                text-align: ${align};
              }
              th:nth-child(1) { width: 8%; text-align: center; }
              th:nth-child(3), th:nth-child(4), th:nth-child(5) { text-align: ${alignEnd}; }
              td {
                padding: 10px 16px; font-size: 13px; color: #334155;
                border-bottom: 1px solid #e2e8f0; text-align: ${align};
              }
              td:nth-child(1) { text-align: center; font-weight: 600; color: #64748b; }
              td:nth-child(3), td:nth-child(4), td:nth-child(5) { text-align: ${alignEnd}; }
              tbody tr:nth-child(even) { background: #f8fafc; }
              tbody tr:hover { background: #f1f5f9; }
              .totals-section {
                display: flex; justify-content: flex-end; margin-bottom: 24px;
              }
              .totals-box {
                width: 320px; background: #f8fafc; border-radius: 8px;
                padding: 16px; border: 1px solid #e2e8f0;
              }
              .total-row {
                display: flex; justify-content: space-between;
                padding: 6px 0; font-size: 13px; color: #475569;
              }
              .total-row.grand {
                border-top: 2px solid #1e3a5f; margin-top: 8px; padding-top: 12px;
                font-size: 18px; font-weight: 700; color: #1e3a5f;
              }
              .total-row.grand .amount { color: #d4a017; }
              .footer {
                border-top: 2px solid #e2e8f0; padding-top: 20px;
                margin-top: 32px; text-align: center;
              }
              .footer-thanks {
                font-size: 14px; font-weight: 600; color: #d4a017; margin-bottom: 4px;
              }
              .footer-note { font-size: 11px; color: #94a3b8; }
              .signatures {
                display: flex; justify-content: space-between;
                margin-top: 40px; gap: 60px;
              }
              .sig-block { flex: 1; text-align: center; }
              .sig-line {
                border-bottom: 2px solid #cbd5e1;
                height: 50px; margin-bottom: 8px;
              }
              .sig-label { font-size: 12px; color: #64748b; }
              @media print {
                body { padding: 15px; }
                @page { margin: 0.4in; size: A4; }
              }
            </style>
          </head>
          <body>
            <div class="invoice-wrapper">
              <div class="header">
                <div class="header-left">
                  <img src="${logoBase64}" alt="ALFANI" class="logo" />
                  <div>
                    <div class="company-name">ALFANI</div>
                    <div class="company-sub">${t("carAccessories") || "Car Accessories"}</div>
                  </div>
                </div>
                <div class="header-right">
                  <div class="invoice-title">${t("invoice")}</div>
                  <div class="invoice-meta">
                    <strong>#</strong> ${invoice.invoiceNumber}<br/>
                    <strong>${t("date")}:</strong> ${dateStr}<br/>
                    <strong>${t("branch")}:</strong> ${invoice.branch}
                  </div>
                </div>
              </div>

              <div class="info-section">
                <div class="info-box">
                  <div class="info-label">${t("billTo") || "Bill To"}</div>
                  <div class="info-value">
                    <strong>${invoice.customerName}</strong>
                  </div>
                </div>
                <div class="info-box">
                  <div class="info-label">${t("invoiceDetails") || "Invoice Details"}</div>
                  <div class="info-value">
                    ${t("items")}: ${invoice.items.length}<br/>
                    ${t("totalItems") || "Total Pieces"}: ${invoice.items.reduce((s, i) => s + i.quantity, 0)}
                  </div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>${t("product")}</th>
                    <th>${t("quantity")}</th>
                    <th>${t("unitPrice")}</th>
                    <th>${t("total")}</th>
                  </tr>
                </thead>
                <tbody>
                  ${invoice.items.map((item, idx) => `
                    <tr>
                      <td>${idx + 1}</td>
                      <td>${item.productName}</td>
                      <td>${item.quantity}</td>
                      <td>$${Number(item.unitPrice).toFixed(2)}</td>
                      <td>$${Number(item.lineTotal).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>

              <div class="totals-section">
                <div class="totals-box">
                  <div class="total-row">
                    <span>${t("subtotal")}:</span>
                    <span>$${invoice.items.reduce((s, i) => s + Number(i.lineTotal), 0).toFixed(2)}</span>
                  </div>
                  <div class="total-row grand">
                    <span>${t("total")}:</span>
                    <span class="amount">$${Number(invoice.totalAmount).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div class="signatures">
                <div class="sig-block">
                  <div class="sig-line"></div>
                  <div class="sig-label">${t("authorizedBy") || "Authorized By"}</div>
                </div>
                <div class="sig-block">
                  <div class="sig-line"></div>
                  <div class="sig-label">${t("receivedBy") || "Received By"}</div>
                </div>
              </div>

              <div class="footer">
                <div class="footer-thanks">${t("thankYou") || "Thank you for your business!"}</div>
                <div class="footer-note">${t("autoGenerated") || "This is a computer-generated invoice."}</div>
              </div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 300);
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
              <div className="text-2xl font-bold">${totalSales.toFixed(2)}</div>
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
                        <TableCell className="font-semibold">${Number(invoice.totalAmount).toFixed(2)}</TableCell>
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
                        <TableCell>${Number(item.unitPrice).toFixed(2)}</TableCell>
                        <TableCell>${Number(item.lineTotal).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <span className="text-lg font-semibold">{t("total")}</span>
                <span className="text-2xl font-bold">${Number(selectedInvoice.totalAmount).toFixed(2)}</span>
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
