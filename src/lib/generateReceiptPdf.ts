import { format } from "date-fns";

interface ReceiptData {
  receiptId: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  accountNumber: string;
  amount: number;
  paidAt: string;
  method: string;
  reference: string;
}

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
    receiptId: escapeHtml(receipt.receiptId),
    invoiceNumber: escapeHtml(receipt.invoiceNumber),
    customerName: escapeHtml(receipt.customerName),
    customerEmail: escapeHtml(receipt.customerEmail),
    accountNumber: escapeHtml(receipt.accountNumber),
    amount: receipt.amount,
    paidAt: receipt.paidAt,
    method: escapeHtml(receipt.method),
    reference: escapeHtml(receipt.reference),
  };

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline';">
  <title>Receipt - ${safeReceipt.reference}</title>
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
    
    .receipt-badge {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 28px;
      letter-spacing: 2px;
    }
    
    .success-banner {
      background: #22c55e;
      color: white;
      text-align: center;
      padding: 20px;
      border-bottom: 4px solid #0d0d0d;
    }
    
    .success-icon {
      font-size: 48px;
      margin-bottom: 8px;
    }
    
    .success-text {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 24px;
      letter-spacing: 2px;
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
    
    .details-box {
      background: #f5f5f0;
      border: 3px solid #0d0d0d;
      padding: 24px;
      margin-bottom: 30px;
    }
    
    .details-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 18px;
      margin-bottom: 16px;
      border-bottom: 2px solid #0d0d0d;
      padding-bottom: 8px;
    }
    
    .details-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px dashed #ccc;
    }
    
    .details-row:last-child {
      border-bottom: none;
    }
    
    .amount-box {
      background: #0d0d0d;
      color: white;
      padding: 20px;
      text-align: center;
      margin-bottom: 30px;
    }
    
    .amount-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #facc15;
      margin-bottom: 8px;
    }
    
    .amount-value {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 48px;
      letter-spacing: 2px;
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
      <div class="receipt-badge">RECEIPT</div>
    </div>
    
    <div class="success-banner">
      <div class="success-icon">✓</div>
      <div class="success-text">Payment Successful</div>
    </div>
    
    <div class="content">
      <div class="meta-section">
        <div class="meta-box">
          <div class="meta-label">Receipt Reference</div>
          <div class="meta-value">${safeReceipt.reference}</div>
        </div>
        <div class="meta-box">
          <div class="meta-label">Payment Date</div>
          <div class="meta-value">${format(new Date(safeReceipt.paidAt), "dd MMMM yyyy")}</div>
        </div>
        <div class="meta-box">
          <div class="meta-label">Time</div>
          <div class="meta-value">${format(new Date(safeReceipt.paidAt), "HH:mm")}</div>
        </div>
      </div>
      
      <div class="details-box">
        <div class="details-title">Payment Details</div>
        <div class="details-row">
          <span class="meta-label">Customer</span>
          <span class="meta-value">${safeReceipt.customerName}</span>
        </div>
        <div class="details-row">
          <span class="meta-label">Account Number</span>
          <span class="meta-value">${safeReceipt.accountNumber}</span>
        </div>
        <div class="details-row">
          <span class="meta-label">Email</span>
          <span class="meta-value">${safeReceipt.customerEmail}</span>
        </div>
        <div class="details-row">
          <span class="meta-label">Invoice</span>
          <span class="meta-value">${safeReceipt.invoiceNumber}</span>
        </div>
        <div class="details-row">
          <span class="meta-label">Payment Method</span>
          <span class="meta-value">${safeReceipt.method}</span>
        </div>
      </div>
      
      <div class="amount-box">
        <div class="amount-label">Amount Paid</div>
        <div class="amount-value">£${safeReceipt.amount.toFixed(2)}</div>
      </div>
      
      <p style="text-align: center; color: #666; font-size: 13px;">
        Thank you for your payment. This receipt confirms your transaction has been processed successfully.
      </p>
    </div>
    
    <div class="footer">
      <p><strong>OCCTA Telecom</strong></p>
      <p>Keeping the UK connected since 2020</p>
      <p style="margin-top: 10px;">Call us: 0800 260 6627 | Email: hello@occta.co.uk</p>
      <p style="margin-top: 10px;">Company Number: 12345678 | VAT Registration: GB 123 4567 89</p>
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
