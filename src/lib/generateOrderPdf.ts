import { format } from "date-fns";

interface OrderData {
  orderNumber: string;
  customerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postcode: string;
  planName: string;
  planPrice: number;
  serviceType: string;
  createdAt: string;
  addons?: { name: string; price: number }[];
}

export function generateOrderPdf(order: OrderData): void {
  const addonsTotal = order.addons?.reduce((sum, a) => sum + a.price, 0) || 0;
  const total = order.planPrice;
  
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Order Confirmation - ${order.orderNumber}</title>
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
      max-width: 700px;
      margin: 0 auto;
      background: white;
      border: 4px solid #0d0d0d;
      box-shadow: 10px 10px 0 0 #0d0d0d;
    }
    
    .header {
      background: #0d0d0d;
      color: white;
      padding: 30px;
      text-align: center;
    }
    
    .logo {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 36px;
      letter-spacing: 2px;
    }
    
    .logo span {
      background: #ffd000;
      color: #0d0d0d;
      padding: 2px 8px;
      transform: skewX(-3deg);
      display: inline-block;
    }
    
    .confirmation-badge {
      display: inline-block;
      background: #ffd000;
      color: #0d0d0d;
      font-family: 'Bebas Neue', sans-serif;
      font-size: 24px;
      padding: 8px 20px;
      margin-top: 20px;
      transform: rotate(-2deg);
      border: 3px solid #0d0d0d;
    }
    
    .content { padding: 30px; }
    
    .order-number {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 28px;
      text-align: center;
      margin-bottom: 20px;
    }
    
    .section {
      border: 3px solid #0d0d0d;
      margin-bottom: 20px;
      padding: 20px;
    }
    
    .section-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 18px;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #0d0d0d;
    }
    
    .row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    
    .row:last-child { border-bottom: none; }
    
    .label { color: #666; }
    .value { font-weight: 600; }
    
    .plan-box {
      background: #ffd000;
      padding: 20px;
      border: 3px solid #0d0d0d;
      text-align: center;
      margin-bottom: 20px;
    }
    
    .plan-name {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 28px;
    }
    
    .plan-type {
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: 2px;
    }
    
    .plan-price {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 36px;
      margin-top: 10px;
    }
    
    .total-box {
      background: #0d0d0d;
      color: white;
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: 'Bebas Neue', sans-serif;
      font-size: 24px;
    }
    
    .footer {
      background: #f5f5f0;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    
    @media print {
      body { padding: 0; background: white; }
      .container { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        OCCTA<span>TELECOM</span>
      </div>
      <div class="confirmation-badge">ORDER CONFIRMED</div>
    </div>
    
    <div class="content">
      <div class="order-number">ORDER #${order.orderNumber}</div>
      <p style="text-align: center; margin-bottom: 30px; color: #666;">
        ${format(new Date(order.createdAt), "dd MMMM yyyy 'at' HH:mm")}
      </p>
      
      <div class="plan-box">
        <div class="plan-type">${order.serviceType.toUpperCase()}</div>
        <div class="plan-name">${order.planName}</div>
        <div class="plan-price">£${order.planPrice.toFixed(2)}/mo</div>
      </div>
      
      <div class="section">
        <div class="section-title">CUSTOMER DETAILS</div>
        <div class="row">
          <span class="label">Name</span>
          <span class="value">${order.customerName}</span>
        </div>
        <div class="row">
          <span class="label">Email</span>
          <span class="value">${order.email}</span>
        </div>
        <div class="row">
          <span class="label">Phone</span>
          <span class="value">${order.phone}</span>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">INSTALLATION ADDRESS</div>
        <div class="row">
          <span class="label">Address</span>
          <span class="value">${order.address}</span>
        </div>
        <div class="row">
          <span class="label">City</span>
          <span class="value">${order.city}</span>
        </div>
        <div class="row">
          <span class="label">Postcode</span>
          <span class="value">${order.postcode}</span>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">ORDER SUMMARY</div>
        <div class="row">
          <span class="label">${order.planName}</span>
          <span class="value">£${order.planPrice.toFixed(2)}/mo</span>
        </div>
        ${order.addons && order.addons.length > 0 ? order.addons.map(addon => `
        <div class="row">
          <span class="label">${addon.name}</span>
          <span class="value">£${addon.price.toFixed(2)}/mo</span>
        </div>
        `).join('') : ''}
        <div class="row">
          <span class="label">Installation</span>
          <span class="value" style="color: #22c55e;">FREE</span>
        </div>
      </div>
      
      <div class="total-box">
        <span>MONTHLY TOTAL</span>
        <span>£${total.toFixed(2)}/mo</span>
      </div>
    </div>
    
    <div class="footer">
      <p><strong>OCCTA Telecom</strong></p>
      <p>Keeping Yorkshire connected since 2020</p>
      <p style="margin-top: 10px;">Call us: 0800 260 6627 | Email: hello@occta.co.uk</p>
      <p style="margin-top: 10px;">This document is your order confirmation. Please keep it for your records.</p>
    </div>
  </div>
  
  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}
