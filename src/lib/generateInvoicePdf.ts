import { format } from "date-fns";
import { CONTACT_PHONE_DISPLAY } from "@/lib/constants";

interface InvoiceLineData {
  description: string;
  qty: number;
  unit_price: number;
  line_total: number;
  vat_rate?: number;
}

interface InvoiceData {
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  accountNumber: string;
  address?: string;
  city?: string;
  postcode?: string;
  issueDate: string;
  dueDate?: string;
  status: string;
  lines: InvoiceLineData[];
  subtotal: number;
  vatTotal: number;
  total: number;
  notes?: string;
  vatEnabled?: boolean;
  vatRate?: number;
  paymentUrl?: string;
}

// HTML escape function to prevent XSS attacks
function escapeHtml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function generateInvoicePdf(invoice: InvoiceData): void {
  const vatEnabled = invoice.vatEnabled !== false; // Default true for backward compat
  const vatRate = invoice.vatRate ?? 20;
  
  const safeInvoice = {
    invoiceNumber: escapeHtml(invoice.invoiceNumber),
    customerName: escapeHtml(invoice.customerName),
    customerEmail: escapeHtml(invoice.customerEmail),
    accountNumber: escapeHtml(invoice.accountNumber),
    address: escapeHtml(invoice.address || ""),
    city: escapeHtml(invoice.city || ""),
    postcode: escapeHtml(invoice.postcode || ""),
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    status: escapeHtml(invoice.status),
    lines: invoice.lines.map((line) => ({
      description: escapeHtml(line.description),
      qty: line.qty,
      unit_price: line.unit_price,
      line_total: line.line_total,
      vat_rate: line.vat_rate || vatRate,
    })),
    subtotal: invoice.subtotal,
    vatTotal: invoice.vatTotal,
    total: invoice.total,
    notes: escapeHtml(invoice.notes || ""),
    vatEnabled,
    vatRate,
    paymentUrl: invoice.paymentUrl || "",
  };

  const linesHtml = safeInvoice.lines
    .map(
      (line) => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #eee;">${line.description}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #eee; text-align: center;">${line.qty}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #eee; text-align: right;">£${line.unit_price.toFixed(2)}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #eee; text-align: right;">£${line.line_total.toFixed(2)}</td>
    </tr>
  `
    )
    .join("");

  const statusColor =
    safeInvoice.status === "paid"
      ? "#22c55e"
      : safeInvoice.status === "overdue"
      ? "#ef4444"
      : safeInvoice.status === "cancelled"
      ? "#6b7280"
      : "#facc15";

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline';">
  <title>Invoice - ${safeInvoice.invoiceNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', sans-serif;
      background: #f5f5f0;
      color: #0d0d0d;
      padding: 40px;
    }
    
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border: 4px solid #0d0d0d;
      box-shadow: 10px 10px 0 0 #0d0d0d;
    }
    
    .header {
      background: #0d0d0d;
      color: white;
      padding: 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .logo {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 36px;
      letter-spacing: 2px;
    }
    
    .logo span {
      background: #facc15;
      color: #0d0d0d;
      padding: 2px 8px;
      transform: skewX(-3deg);
      display: inline-block;
    }
    
    .invoice-badge {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 28px;
      letter-spacing: 2px;
    }
    
    .status-badge {
      display: inline-block;
      background: ${statusColor};
      color: ${safeInvoice.status === "paid" || safeInvoice.status === "overdue" ? "white" : "#0d0d0d"};
      font-family: 'Bebas Neue', sans-serif;
      font-size: 16px;
      padding: 4px 12px;
      text-transform: uppercase;
      border: 2px solid #0d0d0d;
    }
    
    .content { padding: 30px; }
    
    .meta-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      gap: 20px;
    }
    
    .meta-box {
      flex: 1;
    }
    
    .meta-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #666;
      margin-bottom: 4px;
    }
    
    .meta-value {
      font-weight: 600;
      font-size: 14px;
    }
    
    .customer-box {
      background: #f5f5f0;
      border: 2px solid #0d0d0d;
      padding: 20px;
      margin-bottom: 30px;
    }
    
    .customer-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 18px;
      margin-bottom: 10px;
      border-bottom: 2px solid #0d0d0d;
      padding-bottom: 8px;
    }
    
    .line-items {
      border: 2px solid #0d0d0d;
      margin-bottom: 20px;
    }
    
    .line-items table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .line-items thead {
      background: #0d0d0d;
      color: white;
    }
    
    .line-items th {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 14px;
      letter-spacing: 1px;
      padding: 12px 16px;
      text-align: left;
    }
    
    .line-items th.right {
      text-align: right;
    }
    
    .line-items th.center {
      text-align: center;
    }
    
    .totals-section {
      display: flex;
      justify-content: flex-end;
    }
    
    .totals-box {
      width: 280px;
      border: 3px solid #0d0d0d;
    }
    
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid #eee;
    }
    
    .total-row:last-child {
      border-bottom: none;
      background: #0d0d0d;
      color: white;
    }
    
    .total-row.grand {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 20px;
    }
    
    .notes-section {
      margin-top: 30px;
      padding: 20px;
      background: #f5f5f0;
      border: 2px solid #0d0d0d;
    }
    
    .notes-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 14px;
      margin-bottom: 8px;
    }
    
    .notes-text {
      font-size: 13px;
      color: #666;
    }
    
    .footer {
      background: #f5f5f0;
      padding: 20px 30px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-top: 2px solid #0d0d0d;
    }
    
    @media print {
      body { padding: 0; background: white; }
      .container { box-shadow: none; border: 2px solid #0d0d0d; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="logo">
          OCCTA<span>TELECOM</span>
        </div>
      </div>
      <div style="text-align: right;">
        <div class="invoice-badge">INVOICE</div>
        <div class="status-badge">${safeInvoice.status}</div>
      </div>
    </div>
    
    <div class="content">
      <div class="meta-section">
        <div class="meta-box">
          <div class="meta-label">Invoice Number</div>
          <div class="meta-value">${safeInvoice.invoiceNumber}</div>
        </div>
        <div class="meta-box">
          <div class="meta-label">Issue Date</div>
          <div class="meta-value">${format(new Date(safeInvoice.issueDate), "dd MMMM yyyy")}</div>
        </div>
        <div class="meta-box">
          <div class="meta-label">Due Date</div>
          <div class="meta-value">${safeInvoice.dueDate ? format(new Date(safeInvoice.dueDate), "dd MMMM yyyy") : "On Receipt"}</div>
        </div>
      </div>
      
      <div class="customer-box">
        <div class="customer-title">Bill To</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <div class="meta-label">Account Number</div>
            <div class="meta-value" style="font-size: 16px;">${safeInvoice.accountNumber}</div>
          </div>
          <div>
            <div class="meta-label">Customer</div>
            <div class="meta-value">${safeInvoice.customerName}</div>
          </div>
          <div>
            <div class="meta-label">Email</div>
            <div class="meta-value">${safeInvoice.customerEmail}</div>
          </div>
          ${
            safeInvoice.address
              ? `
          <div>
            <div class="meta-label">Address</div>
            <div class="meta-value">${safeInvoice.address}${safeInvoice.city ? `, ${safeInvoice.city}` : ""}${safeInvoice.postcode ? ` ${safeInvoice.postcode}` : ""}</div>
          </div>
          `
              : ""
          }
        </div>
      </div>
      
      <div class="line-items">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="center">Qty</th>
              <th class="right">Unit Price</th>
              <th class="right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${linesHtml}
          </tbody>
        </table>
      </div>
      
      <div class="totals-section">
        <div class="totals-box">
          <div class="total-row">
            <span>Subtotal</span>
            <span>£${safeInvoice.subtotal.toFixed(2)}</span>
          </div>
          ${
            safeInvoice.vatEnabled
              ? `
          <div class="total-row">
            <span>VAT (${safeInvoice.vatRate}%)</span>
            <span>£${safeInvoice.vatTotal.toFixed(2)}</span>
          </div>
          `
              : ""
          }
          <div class="total-row grand">
            <span>TOTAL</span>
            <span>£${safeInvoice.total.toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      ${
        safeInvoice.paymentUrl
          ? `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${safeInvoice.paymentUrl}" style="display: inline-block; background: #facc15; color: #0d0d0d; padding: 16px 40px; font-size: 18px; font-weight: bold; text-decoration: none; border: 4px solid #0d0d0d; text-transform: uppercase; letter-spacing: 1px;">
          Pay Now →
        </a>
        <p style="margin-top: 10px; font-size: 12px; color: #666;">
          Or visit: ${safeInvoice.paymentUrl}
        </p>
      </div>
      `
          : ""
      }
      
      ${
        safeInvoice.notes
          ? `
      <div class="notes-section">
        <div class="notes-title">Notes</div>
        <div class="notes-text">${safeInvoice.notes}</div>
      </div>
      `
          : ""
      }
    </div>
    
    <div class="footer">
      <p><strong>OCCTA Telecom</strong></p>
      <p>Keeping the UK connected</p>
      <p style="margin-top: 10px;">Call us: ${CONTACT_PHONE_DISPLAY} | Email: billing@occta.co.uk</p>
      <p style="margin-top: 10px;">OCCTA Limited | Company No. 13828933 | Registered in England & Wales</p>
      <p>22 Pavilion View, Huddersfield, HD3 3WU</p>
    </div>
  </div>
  
  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}

export type { InvoiceData, InvoiceLineData };
