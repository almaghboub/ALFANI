import { useTranslation } from "react-i18next";
import logoPath from "@assets/ALFANI-removebg-preview_1768829603636.png";
import { useLydExchangeRate } from "@/hooks/use-lyd-exchange-rate";

interface OrderWithItems {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: string;
  downPayment: string;
  remainingBalance: string;
  shippingCost: string;
  profit: string;
  notes?: string;
  createdAt: string;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    country: string;
    postalCode?: string;
    shippingCode?: string;
  };
  items?: {
    id: string;
    productName: string;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
  }[];
}

interface InvoiceProps {
  order: OrderWithItems;
  lydExchangeRate?: number;
  onPrint?: () => void;
}

// Function to convert number to words (bilingual)
function numberToWords(num: number, language: string = 'en'): string {
  if (language === 'ar') {
    // Arabic number to words (corrected for proper Arabic grammar)
    const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
    const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
    const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const hundreds = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
    
    if (num === 0) return 'صفر دينار';
    
    const convert = (n: number): string => {
      if (n === 0) return '';
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      // In Arabic, ones come before tens: "خمسة وعشرون" (five and twenty) not "twenty and five"
      if (n < 100) {
        const onesPlace = n % 10;
        const tensPlace = Math.floor(n / 10);
        if (onesPlace === 0) return tens[tensPlace];
        return ones[onesPlace] + ' و' + tens[tensPlace];
      }
      if (n < 1000) {
        const hundredsPlace = Math.floor(n / 100);
        const remainder = n % 100;
        if (remainder === 0) return hundreds[hundredsPlace];
        return hundreds[hundredsPlace] + ' و' + convert(remainder);
      }
      if (n < 1000000) {
        const thousands = Math.floor(n / 1000);
        const remainder = n % 1000;
        let result = thousands === 1 ? 'ألف' : thousands === 2 ? 'ألفان' : convert(thousands) + ' آلاف';
        if (remainder !== 0) result += ' و' + convert(remainder);
        return result;
      }
      if (n < 1000000000) {
        const millions = Math.floor(n / 1000000);
        const remainder = n % 1000000;
        let result = millions === 1 ? 'مليون' : millions === 2 ? 'مليونان' : convert(millions) + ' مليون';
        if (remainder !== 0) result += ' و' + convert(remainder);
        return result;
      }
      const billions = Math.floor(n / 1000000000);
      const remainder = n % 1000000000;
      let result = billions === 1 ? 'مليار' : billions === 2 ? 'ملياران' : convert(billions) + ' مليار';
      if (remainder !== 0) result += ' و' + convert(remainder);
      return result;
    };
    
    const dollars = Math.floor(num);
    const cents = Math.round((num - dollars) * 100);
    
    let result = '';
    
    if (dollars === 0) {
      result = 'صفر دينار';
    } else {
      result = convert(dollars) + ' دينار';
    }
    
    if (cents > 0) {
      result += ' و' + convert(cents) + ' درهم';
    }
    
    return result;
  } else {
    // English number to words
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    
    if (num === 0) return 'Zero Dinars';
    
    const convert = (n: number): string => {
      if (n === 0) return '';
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
      if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convert(n % 100) : '');
      if (n < 1000000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
      if (n < 1000000000) return convert(Math.floor(n / 1000000)) + ' Million' + (n % 1000000 !== 0 ? ' ' + convert(n % 1000000) : '');
      return convert(Math.floor(n / 1000000000)) + ' Billion' + (n % 1000000000 !== 0 ? ' ' + convert(n % 1000000000) : '');
    };
    
    const dollars = Math.floor(num);
    const cents = Math.round((num - dollars) * 100);
    
    let result = '';
    
    if (dollars === 0) {
      result = 'Zero Dinars';
    } else {
      result = convert(dollars) + ' Dinar' + (dollars !== 1 ? 's' : '');
    }
    
    if (cents > 0) {
      result += ' and ' + convert(cents) + ' Dirham' + (cents !== 1 ? 's' : '');
    }
    
    return result;
  }
}

export function Invoice({ order, lydExchangeRate = 0, onPrint }: InvoiceProps) {
  const { t, i18n } = useTranslation();
  const { exchangeRate, convertToLYD } = useLydExchangeRate();
  
  // Calculate USD amounts
  const subtotalUSD = order.items?.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0) || 0;
  const shippingUSD = parseFloat(order.shippingCost || "0");
  const totalUSD = parseFloat(order.totalAmount || "0");
  const downPaymentUSD = parseFloat(order.downPayment || "0");
  const remainingBalanceUSD = parseFloat(order.remainingBalance || "0");
  
  // Convert to LYD
  const subtotal = exchangeRate > 0 ? parseFloat(convertToLYD(subtotalUSD)) : subtotalUSD;
  const shipping = exchangeRate > 0 ? parseFloat(convertToLYD(shippingUSD)) : shippingUSD;
  const total = exchangeRate > 0 ? parseFloat(convertToLYD(totalUSD)) : totalUSD;
  const downPayment = exchangeRate > 0 ? parseFloat(convertToLYD(downPaymentUSD)) : downPaymentUSD;
  const remainingBalance = exchangeRate > 0 ? parseFloat(convertToLYD(remainingBalanceUSD)) : remainingBalanceUSD;
  
  const totalInWords = numberToWords(total, i18n.language);
  const currency = exchangeRate > 0 ? "LYD" : "USD";

  return (
    <div className="invoice-container max-w-4xl mx-auto p-8 bg-white text-black">
      {/* Invoice Header with Logo and Company Info */}
      <div className="mb-8 border-b-4 pb-6" style={{ borderColor: '#FFD700' }}>
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-4">
            <img src={logoPath} alt="ALFANI Logo" className="h-24 w-auto" />
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-bold mb-2" style={{ color: '#FFD700' }}>{t('invoice')}</h2>
            <div className="text-sm space-y-1">
              <p className="font-semibold">{t('invoiceNumber')}: {order.orderNumber}</p>
              <p>{t('date')}: {new Date(order.createdAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</p>
              <p className="text-gray-600">{t('status')}: <span className="capitalize font-semibold" style={{ color: '#FFD700' }}>{t(order.status)}</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Company and Customer Information Side by Side */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* From Section */}
        <div>
          <h3 className="text-sm font-bold mb-3 uppercase tracking-wide" style={{ color: '#FFD700' }}>{t('from')}:</h3>
          <div className="space-y-1">
            <p className="font-bold text-lg">ALFANI</p>
            <p className="text-sm">{t('companyTagline')}</p>
          </div>
        </div>

        {/* Bill To Section */}
        <div>
          <h3 className="text-sm font-bold mb-3 uppercase tracking-wide" style={{ color: '#FFD700' }}>{t('billTo')}:</h3>
          <div className="bg-gray-50 p-4 rounded-lg space-y-1">
            <p className="font-bold">{order.customer.firstName} {order.customer.lastName}</p>
            {order.customer.shippingCode && <p className="text-sm font-semibold" style={{ color: '#FFD700' }}>Code: {order.customer.shippingCode}</p>}
            {order.customer.email && <p className="text-sm">{order.customer.email}</p>}
            {order.customer.phone && <p className="text-sm">{order.customer.phone}</p>}
            {order.customer.address && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-sm">{order.customer.address}</p>
                {order.customer.city && order.customer.postalCode && (
                  <p className="text-sm">{order.customer.city}, {order.customer.postalCode}</p>
                )}
                <p className="text-sm font-semibold">{order.customer.country}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order Items Table */}
      <div className="mb-8">
        <h3 className="text-sm font-bold mb-3 uppercase tracking-wide" style={{ color: '#FFD700' }}>{t('shipmentDetails')}:</h3>
        <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-white" style={{ backgroundColor: '#FFD700' }}>
                <th className="px-4 py-3 text-left font-semibold">{t('productDescription')}</th>
                <th className="px-4 py-3 text-center font-semibold">{t('qty')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('unitPrice')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {order.items?.map((item, index) => (
                <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 font-medium">{item.productName}</td>
                  <td className="px-4 py-3 text-center">{item.quantity}</td>
                  <td className="px-4 py-3 text-right">{(parseFloat(item.unitPrice) * (exchangeRate || 1)).toFixed(2)} {currency}</td>
                  <td className="px-4 py-3 text-right font-semibold">{(parseFloat(item.totalPrice) * (exchangeRate || 1)).toFixed(2)} {currency}</td>
                </tr>
              )) || (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    {t('loadingShipmentDetails')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Section */}
      <div className="flex justify-end mb-6">
        <div className="w-96">
          <div className="bg-gray-50 rounded-lg p-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('subtotal')}:</span>
              <span className="font-semibold">{subtotal.toFixed(2)} LYD</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('shippingHandling')}:</span>
              <span className="font-semibold">{shipping.toFixed(2)} LYD</span>
            </div>
            <div className="flex justify-between text-sm">
            </div>
            <div className="border-t-2 border-gray-300 pt-3 mt-3">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold" style={{ color: '#FFD700' }}>{t('total')}:</span>
                <span className="text-2xl font-bold" style={{ color: '#FFD700' }}>{total.toFixed(2)} LYD</span>
              </div>
            </div>
            <div className="border-t-2 border-gray-300 pt-3 mt-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('downPaymentLabel')}:</span>
                <span className="font-semibold text-green-600">{downPayment.toFixed(2)} LYD</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-lg font-bold text-orange-600">{t('remainingBalance')}:</span>
                <span className="text-xl font-bold text-orange-600">{remainingBalance.toFixed(2)} LYD</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Total in Words */}
      <div className="mb-8 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <p className="text-sm">
          <span className="font-semibold text-blue-800">{t('amountInWords')}: </span>
          <span className="text-blue-900">{totalInWords}</span>
        </p>
      </div>

      {/* Notes Section */}
      {order.notes && (
        <div className="mb-8 bg-amber-50 border-l-4 border-amber-500 p-4 rounded">
          <h3 className="text-sm font-bold text-amber-800 mb-2 uppercase tracking-wide">{t('notes')}:</h3>
          <p className="text-sm text-amber-900">{order.notes}</p>
        </div>
      )}

      {/* Signature Section */}
      <div className="mb-8 grid grid-cols-2 gap-12">
        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-6 uppercase tracking-wide">{t('authorizedBy')}:</h3>
          <div className="border-b-2 border-gray-400 pb-1 mb-2 h-16"></div>
          <p className="text-sm text-gray-600 text-center">{t('signature')}</p>
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-6 uppercase tracking-wide">{t('receivedBy')}:</h3>
          <div className="border-b-2 border-gray-400 pb-1 mb-2 h-16"></div>
          <p className="text-sm text-gray-600 text-center">{t('signatureDate')}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t-2 border-gray-200 pt-6 mt-8">
        <div className="text-center space-y-2">
          <p className="text-sm font-semibold" style={{ color: '#FFD700' }}>{t('thankYou')}</p>
          <p className="text-xs text-gray-600">{t('companyTagline')}</p>
          <p className="text-xs text-gray-500 mt-4">{t('autoGenerated')}</p>
        </div>
      </div>

      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            /* Hide EVERYTHING on the page first */
            body * {
              visibility: hidden !important;
            }
            
            /* Then show only the invoice and its children */
            .invoice-container,
            .invoice-container * {
              visibility: visible !important;
            }
            
            /* Position invoice at top-left of page */
            .invoice-container {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: none !important;
              margin: 0 !important;
              padding: 20px !important;
              background: white !important;
              box-shadow: none !important;
            }
            
            /* Hide dialog backdrop and modal chrome */
            [role="dialog"],
            [data-radix-dialog-overlay],
            .fixed,
            header,
            nav,
            aside,
            footer,
            button,
            .sidebar,
            .navbar,
            [data-sidebar] {
              display: none !important;
              visibility: hidden !important;
            }
            
            /* Ensure invoice container stays visible even if parent is dialog */
            .invoice-container {
              display: block !important;
              visibility: visible !important;
            }
            
            body {
              background: white !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            
            /* Prevent color override for invoice elements */
            .invoice-container * {
              color: inherit !important;
            }
            
            .invoice-container .text-gray-600,
            .invoice-container .text-gray-500 {
              color: #4b5563 !important;
            }
            
            .invoice-container .text-green-600 {
              color: #059669 !important;
            }
            
            .invoice-container .text-orange-600 {
              color: #ea580c !important;
            }
            
            .invoice-container .text-blue-800,
            .invoice-container .text-blue-900 {
              color: #1e40af !important;
            }
            
            .bg-gray-50 {
              background: #f9fafb !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            
            .bg-blue-50 {
              background: #eff6ff !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            
            .bg-amber-50 {
              background: #fffbeb !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            
            .bg-yellow-600 {
              background: #FFD700 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            
            .text-yellow-600 {
              color: #FFD700 !important;
            }
            
            .text-white {
              color: white !important;
            }
            
            .border-yellow-600 {
              border-color: #FFD700 !important;
            }
            
            .border-yellow-500 {
              border-color: #FFD700 !important;
            }
            
            .border-blue-500 {
              border-color: #3b82f6 !important;
            }
            
            .border-amber-500 {
              border-color: #f59e0b !important;
            }
            
            .border-gray-200,
            .border-gray-300,
            .border-gray-400 {
              border-color: #e5e7eb !important;
            }
            
            table {
              page-break-inside: avoid;
            }
            
            tr {
              page-break-inside: avoid;
            }
            
            img {
              max-height: 80px !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            
            @page {
              margin: 0.5in;
              size: A4;
            }
          }
        `
      }} />
    </div>
  );
}
