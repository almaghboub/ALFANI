import { useQuery } from "@tanstack/react-query";
import { useState, useRef } from "react";
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

export default function Sales() {
  const { t } = useTranslation();
  const printRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoiceWithItems | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

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
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${t("invoice")} - ${invoice.invoiceNumber}</title>
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
            <div class="header">
              <img src="${logoPath}" alt="ALFANI" class="logo" />
              <h1>ALFANI - ${invoice.branch}</h1>
              <p>${t("invoiceNumber")}: ${invoice.invoiceNumber}</p>
              <p>${new Date(invoice.createdAt).toLocaleDateString()}</p>
            </div>
            <div class="info">
              <p><strong>${t("customerName")}:</strong> ${invoice.customerName}</p>
              <p><strong>${t("branch")}:</strong> ${invoice.branch}</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>${t("product")}</th>
                  <th>${t("quantity")}</th>
                  <th>${t("unitPrice")}</th>
                  <th>${t("total")}</th>
                </tr>
              </thead>
              <tbody>
                ${invoice.items.map(item => `
                  <tr>
                    <td>${item.productName}</td>
                    <td>${item.quantity}</td>
                    <td>$${Number(item.unitPrice).toFixed(2)}</td>
                    <td>$${Number(item.lineTotal).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="total">
              ${t("total")}: $${Number(invoice.totalAmount).toFixed(2)}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
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
