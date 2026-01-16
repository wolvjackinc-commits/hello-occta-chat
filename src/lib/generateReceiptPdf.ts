import { format } from "date-fns";

interface ReceiptData {
  receiptNumber: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  accountNumber: string;
  amount: number;
  currency: string;
  paidAt: string;
  paymentMethod?: string;
  transactionRef?: string;
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

export function generateReceiptPdf(receipt: ReceiptData): void {
  const safeReceipt = {
    receiptNumber: escapeHtml(receipt.receiptNumber),
    invoiceNumber: escapeHtml(receipt.invoiceNumber),
    customerName: escapeHtml(receipt.customerName),
    customerEmail: escapeHtml(receipt.customerEmail),
    accountNumber: escapeHtml(receipt.accountNumber),
    amount: receipt.amount,
    currency: receipt.currency || 'GBP',
    paidAt: receipt.paidAt,
    paymentMethod: escapeHtml(receipt.paymentMethod || 'Card'),
    transactionRef: escapeHtml(receipt.transactionRef || ''),
  };

  const formattedAmount = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: safeReceipt.currency,
  }).format(safeReceipt.amount);

  const formattedDate = format(new Date(safeReceipt.paidAt), "dd MMMM yyyy 'at' HH:mm");

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline';">
  <title>Payment Receipt - ${safeReceipt.receiptNumber}</title>
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
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border: 4px solid #0d0d0d;
      box-shadow: 10px 10px 0 0 #0d0d0d;
    }
    
    .header {
      background: #22c55e;
      color: white;
      padding: 30px;
      text-align: center;
      position: relative;
    }
    
    .header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: repeating-linear-gradient(
        45deg,
        transparent,
        transparent 10px,
        rgba(255,255,255,0.1) 10px,
        rgba(255,255,255,0.1) 20px
      );
    }
    
    .header-content {
      position: relative;
      z-index: 1;
    }
    
    .success-icon {
      width: 80px;
      height: 80px;
      background: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      border: 4px solid #0d0d0d;
    }
    
    .success-icon svg {
      width: 40px;
      height: 40px;
      stroke: #22c55e;
      stroke-width: 3;
    }
    
    .header-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 32px;
      letter-spacing: 3px;
      margin-bottom: 4px;
    }
    
    .header-subtitle {
      font-size: 14px;
      opacity: 0.9;
    }
    
    .content {
      padding: 30px;
    }
    
    .amount-section {
      text-align: center;
      padding: 30px;
      background: #f5f5f0;
      border: 3px solid #0d0d0d;
      margin-bottom: 24px;
    }
    
    .amount-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #666;
      margin-bottom: 8px;
    }
    
    .amount-value {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 48px;
      color: #22c55e;
      letter-spacing: 2px;
    }
    
    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }
    
    .detail-box {
      padding: 16px;
      background: #f5f5f0;
      border: 2px solid #0d0d0d;
    }
    
    .detail-box.full-width {
      grid-column: span 2;
    }
    
    .detail-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #666;
      margin-bottom: 4px;
    }
    
    .detail-value {
      font-weight: 600;
      font-size: 14px;
    }
    
    .logo-section {
      text-align: center;
      padding: 24px;
      background: #0d0d0d;
      color: white;
    }
    
    .logo {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 28px;
      letter-spacing: 2px;
    }
    
    .logo span {
      background: #facc15;
      color: #0d0d0d;
      padding: 2px 8px;
      display: inline-block;
    }
    
    .footer {
      background: #f5f5f0;
      padding: 20px 30px;
      text-align: center;
      font-size: 11px;
      color: #666;
      border-top: 2px solid #0d0d0d;
    }
    
    .footer p {
      margin: 4px 0;
    }
    
    .thank-you {
      text-align: center;
      padding: 20px;
      font-size: 14px;
      color: #666;
      font-style: italic;
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
      <div class="header-content">
        <div class="success-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 6L9 17L4 12" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="header-title">PAYMENT SUCCESSFUL</div>
        <div class="header-subtitle">Thank you for your payment</div>
      </div>
    </div>
    
    <div class="content">
      <div class="amount-section">
        <div class="amount-label">Amount Paid</div>
        <div class="amount-value">${formattedAmount}</div>
      </div>
      
      <div class="details-grid">
        <div class="detail-box">
          <div class="detail-label">Receipt Number</div>
          <div class="detail-value">${safeReceipt.receiptNumber}</div>
        </div>
        <div class="detail-box">
          <div class="detail-label">Invoice Reference</div>
          <div class="detail-value">${safeReceipt.invoiceNumber}</div>
        </div>
        <div class="detail-box">
          <div class="detail-label">Payment Date</div>
          <div class="detail-value">${formattedDate}</div>
        </div>
        <div class="detail-box">
          <div class="detail-label">Payment Method</div>
          <div class="detail-value">${safeReceipt.paymentMethod}</div>
        </div>
        <div class="detail-box full-width">
          <div class="detail-label">Account Number</div>
          <div class="detail-value">${safeReceipt.accountNumber}</div>
        </div>
        <div class="detail-box full-width">
          <div class="detail-label">Customer</div>
          <div class="detail-value">${safeReceipt.customerName} (${safeReceipt.customerEmail})</div>
        </div>
        ${safeReceipt.transactionRef ? `
        <div class="detail-box full-width">
          <div class="detail-label">Transaction Reference</div>
          <div class="detail-value" style="font-family: monospace;">${safeReceipt.transactionRef}</div>
        </div>
        ` : ''}
      </div>
      
      <div class="thank-you">
        This receipt confirms your payment has been processed successfully.<br>
        A copy has also been sent to your registered email address.
      </div>
    </div>
    
    <div class="logo-section">
      <div class="logo">
        OCCTA<span>TELECOM</span>
      </div>
    </div>
    
    <div class="footer">
      <p><strong>OCCTA Telecom</strong> — Keeping Yorkshire connected since 2020</p>
      <p>Call us: 0800 260 6627 | Email: hello@occta.co.uk</p>
      <p style="margin-top: 8px;">Company Number: 12345678 | VAT Registration: GB 123 4567 89</p>
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

export type { ReceiptData };
