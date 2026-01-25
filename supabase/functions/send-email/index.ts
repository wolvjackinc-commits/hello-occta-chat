import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = new Resend(resendApiKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  type:
    | "order_confirmation"
    | "welcome"
    | "status_update"
    | "order_message"
    | "ticket_reply"
    | "password_reset"
    | "invoice_sent"
    | "invoice_paid";
  to: string;
  data: Record<string, unknown>;
  orderNumber?: string;
  redirectTo?: string;
}

// HTML escape helper to prevent injection attacks
const escapeHtml = (unsafe: unknown): string => {
  if (unsafe === null || unsafe === undefined) return '';
  const str = String(unsafe);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Sanitize numeric values
const sanitizeNumber = (value: unknown): string => {
  const num = parseFloat(String(value));
  return isNaN(num) ? '0.00' : num.toFixed(2);
};

// UK Companies Act 2006 compliant footer - GDPR & Professional Standards
const getStandardFooter = (options?: { showUnsubscribe?: boolean; accentColor?: string }) => {
  const siteUrl = Deno.env.get("SITE_URL") || "https://occta.co.uk";
  const accentColor = options?.accentColor || '#facc15';
  const currentYear = new Date().getFullYear();
  
  return `
    <div class="footer" style="background: #0d0d0d; padding: 32px;">
      <div class="footer-content" style="text-align: center;">
        <div class="footer-logo" style="font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 4px; color: ${accentColor};">OCCTA</div>
        
        <div class="footer-links" style="margin: 20px 0;">
          <a href="${siteUrl}/support" style="color: #ffffff; text-decoration: none; font-size: 12px; margin: 0 12px; text-transform: uppercase; letter-spacing: 1px;">Support</a>
          <a href="${siteUrl}/dashboard" style="color: #ffffff; text-decoration: none; font-size: 12px; margin: 0 12px; text-transform: uppercase; letter-spacing: 1px;">Dashboard</a>
          <a href="${siteUrl}/privacy-policy" style="color: #ffffff; text-decoration: none; font-size: 12px; margin: 0 12px; text-transform: uppercase; letter-spacing: 1px;">Privacy Policy</a>
          <a href="${siteUrl}/terms-of-service" style="color: #ffffff; text-decoration: none; font-size: 12px; margin: 0 12px; text-transform: uppercase; letter-spacing: 1px;">Terms</a>
        </div>
        
        <div style="margin: 24px 0; padding-top: 20px; border-top: 1px solid #333;">
          <p style="color: #888; font-size: 12px; margin: 0 0 8px 0; line-height: 1.6;">
            Need help? Call <strong style="color: #fff;">0800 260 6627</strong> or email <a href="mailto:hello@occta.co.uk" style="color: ${accentColor}; text-decoration: none;">hello@occta.co.uk</a>
          </p>
          <p style="color: #666; font-size: 11px; margin: 0; line-height: 1.6;">
            Lines open Monday–Friday 9am–6pm, Saturday 9am–1pm
          </p>
        </div>
        
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #333;">
          <p style="color: #666; font-size: 10px; margin: 0 0 6px 0; line-height: 1.6;">
            © ${currentYear} OCCTA Limited. All rights reserved.
          </p>
          <p style="color: #555; font-size: 9px; margin: 0; line-height: 1.5;">
            OCCTA Limited is a company registered in England and Wales (Company No. 13828933).<br>
            Registered office: 22 Pavilion View, Huddersfield, HD3 3WU, United Kingdom
          </p>
        </div>
        
        ${options?.showUnsubscribe ? `
        <div style="margin-top: 16px;">
          <a href="${siteUrl}/dashboard" style="color: #666; font-size: 10px; text-decoration: underline;">Manage email preferences</a>
        </div>
        ` : ''}
      </div>
    </div>`;
};

// Common email styles shared across all templates
const getCommonStyles = () => `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700;900&display=swap');
  
  body { margin: 0; padding: 0; background: #f5f4ef; color: #0d0d0d; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; -webkit-font-smoothing: antialiased; }
  .preheader { display: none !important; visibility: hidden; opacity: 0; height: 0; width: 0; max-height: 0; max-width: 0; overflow: hidden; }
  
  .wrapper { background: #f5f4ef; padding: 40px 20px; }
  .container { max-width: 600px; margin: 0 auto; background: #ffffff; border: 4px solid #0d0d0d; box-shadow: 8px 8px 0 0 #0d0d0d; }
  
  .header { background: #0d0d0d; padding: 32px; position: relative; overflow: hidden; }
  .header::before { content: ''; position: absolute; top: 0; right: 0; width: 120px; height: 120px; background: #facc15; transform: translate(30%, -30%) rotate(45deg); }
  .logo { font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: 4px; color: #ffffff; text-transform: uppercase; position: relative; z-index: 1; }
  .tagline { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #facc15; margin-top: 4px; font-weight: 600; }
  
  .content { padding: 32px; }
  .greeting { font-size: 18px; font-weight: 700; margin-bottom: 16px; color: #0d0d0d; }
  .text { font-size: 15px; line-height: 1.7; color: #333; margin: 16px 0; }
  
  .cta-wrap { text-align: center; margin: 32px 0; }
  .cta { display: inline-block; background: #0d0d0d; color: #ffffff; padding: 16px 40px; text-decoration: none; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; text-transform: uppercase; border: 3px solid #0d0d0d; box-shadow: 4px 4px 0 0 #facc15; }
`;

const getOrderConfirmationHtml = (data: Record<string, unknown>) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Order Confirmed - OCCTA</title>
  <style>
    ${getCommonStyles()}
    
    .title-banner { background: #facc15; padding: 16px 32px; border-bottom: 4px solid #0d0d0d; }
    .title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 2px; text-transform: uppercase; margin: 0; color: #0d0d0d; }
    
    .order-card { background: #f5f4ef; border: 3px solid #0d0d0d; margin: 24px 0; }
    .order-header { background: #0d0d0d; color: #fff; padding: 12px 20px; font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 2px; text-transform: uppercase; }
    .order-body { padding: 20px; }
    .order-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px dashed #ccc; }
    .order-row:last-child { border-bottom: none; padding-bottom: 0; }
    .order-label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #666; font-weight: 600; }
    .order-value { font-size: 15px; font-weight: 700; text-align: right; max-width: 60%; }
    .order-highlight { background: #facc15; padding: 2px 8px; display: inline-block; }
    
    .steps { margin: 28px 0; padding: 24px; background: linear-gradient(135deg, #f5f4ef 0%, #fff 100%); border-left: 4px solid #facc15; }
    .steps-title { font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 16px; }
    .step { display: flex; align-items: flex-start; margin: 12px 0; }
    .step-num { background: #0d0d0d; color: #facc15; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14px; margin-right: 12px; flex-shrink: 0; }
    .step-text { font-size: 14px; line-height: 1.5; padding-top: 4px; }
    
    .order-callout { text-align: center; background: #f5f4ef; border: 2px dashed #0d0d0d; padding: 16px; margin: 24px 0; }
    .order-callout-label { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #666; }
    .order-callout-number { font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 3px; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="preheader">Your OCCTA order #${escapeHtml(data.order_number)} is confirmed! We're getting everything ready for you.</div>
  
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo">OCCTA</div>
        <div class="tagline">Telecom • Connected</div>
      </div>
      
      <div class="title-banner">
        <h1 class="title">✓ Order Confirmed</h1>
      </div>
      
      <div class="content">
        <p class="greeting">Hi ${escapeHtml(data.full_name)},</p>
        <p class="text">Brilliant news! Your order is locked in and we're already on it. Here's everything you need to know:</p>
        
        <div class="order-card">
          <div class="order-header">Order Details</div>
          <div class="order-body">
            <div class="order-row">
              <span class="order-label">Order Number</span>
              <span class="order-value"><span class="order-highlight">${escapeHtml(data.order_number)}</span></span>
            </div>
            <div class="order-row">
              <span class="order-label">Service</span>
              <span class="order-value">${escapeHtml(data.service_type)}</span>
            </div>
            <div class="order-row">
              <span class="order-label">Plan</span>
              <span class="order-value">${escapeHtml(data.plan_name)}</span>
            </div>
            <div class="order-row">
              <span class="order-label">Monthly Price</span>
              <span class="order-value">£${sanitizeNumber(data.plan_price)}/mo</span>
            </div>
            <div class="order-row">
              <span class="order-label">Installation Address</span>
              <span class="order-value">${escapeHtml(data.address_line1)}, ${escapeHtml(data.city)}, ${escapeHtml(data.postcode)}</span>
            </div>
          </div>
        </div>
        
        <div class="steps">
          <div class="steps-title">What Happens Next</div>
          <div class="step">
            <div class="step-num">1</div>
            <div class="step-text">We'll review your order within 24 hours and confirm all details.</div>
          </div>
          <div class="step">
            <div class="step-num">2</div>
            <div class="step-text">Our team will reach out to schedule your installation at a time that works for you.</div>
          </div>
          <div class="step">
            <div class="step-num">3</div>
            <div class="step-text">A certified technician will arrive to set everything up — quick and hassle-free.</div>
          </div>
        </div>
        
        <div class="cta-wrap">
          <a href="${Deno.env.get("SITE_URL") || "https://occta.co.uk"}/track-order" class="cta">Track Your Order →</a>
        </div>
        
        <div class="order-callout">
          <div class="order-callout-label">Your Order Reference</div>
          <div class="order-callout-number">${escapeHtml(data.order_number)}</div>
        </div>
        
        <p class="text" style="text-align: center; color: #666; font-size: 13px;">
          Keep this number handy — you'll need it to track your order or contact support.
        </p>
      </div>
      
      ${getStandardFooter()}
    </div>
  </div>
</body>
</html>
`;

const getWelcomeHtml = (data: Record<string, unknown>) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Welcome to OCCTA</title>
  <style>
    ${getCommonStyles()}
    
    .title-banner { background: #facc15; padding: 16px 32px; border-bottom: 4px solid #0d0d0d; }
    .title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 2px; text-transform: uppercase; margin: 0; color: #0d0d0d; }
    
    .features { margin: 28px 0; }
    .feature { display: flex; align-items: flex-start; margin: 16px 0; padding: 16px; background: #f5f4ef; border-left: 4px solid #facc15; }
    .feature-icon { width: 40px; height: 40px; background: #0d0d0d; color: #facc15; display: flex; align-items: center; justify-content: center; font-size: 18px; margin-right: 16px; flex-shrink: 0; }
    .feature-text { flex: 1; }
    .feature-title { font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .feature-desc { font-size: 13px; color: #666; }
  </style>
</head>
<body>
  <div class="preheader">Welcome to OCCTA! Your account is ready — let's get you connected.</div>
  
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo">OCCTA</div>
        <div class="tagline">Telecom • Connected</div>
      </div>
      
      <div class="title-banner">
        <h1 class="title">Welcome Aboard! 🎉</h1>
      </div>
      
      <div class="content">
        <p class="greeting">Hi ${escapeHtml(data.full_name) || "there"},</p>
        <p class="text">You're officially part of the OCCTA family! Your account is all set up and ready to go.</p>
        <p class="text">No contracts, no hidden fees, no nonsense — just proper British broadband that works.</p>
        
        <div class="features">
          <div class="feature">
            <div class="feature-icon">📍</div>
            <div class="feature-text">
              <div class="feature-title">Track Orders</div>
              <div class="feature-desc">Real-time updates on your order and installation status.</div>
            </div>
          </div>
          <div class="feature">
            <div class="feature-icon">⚡</div>
            <div class="feature-text">
              <div class="feature-title">Manage Services</div>
              <div class="feature-desc">Add, upgrade, or modify your services anytime — no lock-ins.</div>
            </div>
          </div>
          <div class="feature">
            <div class="feature-icon">💬</div>
            <div class="feature-text">
              <div class="feature-title">UK-Based Support</div>
              <div class="feature-desc">Real humans ready to help, not robots reading scripts.</div>
            </div>
          </div>
        </div>
        
        <div class="cta-wrap">
          <a href="${Deno.env.get("SITE_URL") || "https://occta.co.uk"}/dashboard" class="cta">Go to Dashboard →</a>
        </div>
        
        <p class="text" style="text-align: center; color: #666; font-size: 13px;">
          Need help getting started? Our support team is just a click away.
        </p>
      </div>
      
      ${getStandardFooter()}
    </div>
  </div>
</body>
</html>
`;

const getStatusUpdateHtml = (data: Record<string, unknown>) => {
  const statusConfig: Record<string, { message: string; color: string; icon: string }> = {
    pending: { message: "We've received your order and it's being reviewed by our team.", color: "#facc15", icon: "⏳" },
    confirmed: { message: "Your order has been confirmed! We'll be in touch about installation.", color: "#22c55e", icon: "✓" },
    processing: { message: "We're processing your order and preparing everything for installation.", color: "#3b82f6", icon: "⚙️" },
    dispatched: { message: "Your equipment has been dispatched and is on its way!", color: "#8b5cf6", icon: "📦" },
    installed: { message: "Great news! Your service has been installed. Welcome aboard!", color: "#22c55e", icon: "🏠" },
    active: { message: "Your service is now fully active. Enjoy blazing-fast connectivity!", color: "#22c55e", icon: "🚀" },
    cancelled: { message: "Your order has been cancelled. If you didn't request this, please contact support immediately.", color: "#ef4444", icon: "✕" },
  };

  const config = statusConfig[data.status as string] || { message: "Your order status has been updated.", color: "#facc15", icon: "📋" };
  const safeStatus = escapeHtml(data.status);
  const siteUrl = Deno.env.get("SITE_URL") || "https://occta.co.uk";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Order Update - OCCTA</title>
  <style>
    ${getCommonStyles()}
    
    .title-banner { background: ${config.color}; padding: 16px 32px; border-bottom: 4px solid #0d0d0d; }
    .title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 2px; text-transform: uppercase; margin: 0; color: #ffffff; }
    
    .status-box { background: #f5f4ef; border: 3px solid #0d0d0d; padding: 24px; margin: 24px 0; text-align: center; }
    .status-icon { font-size: 48px; margin-bottom: 12px; }
    .status-label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #666; margin-bottom: 4px; }
    .status-value { font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 2px; text-transform: uppercase; color: ${config.color}; }
    
    .order-ref { background: #0d0d0d; color: #facc15; padding: 2px 8px; font-family: monospace; }
  </style>
</head>
<body>
  <div class="preheader">Order #${escapeHtml(data.order_number)} status update: ${safeStatus}</div>
  
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo">OCCTA</div>
        <div class="tagline">Telecom • Connected</div>
      </div>
      
      <div class="title-banner">
        <h1 class="title">${config.icon} Order Update</h1>
      </div>
      
      <div class="content">
        <p class="greeting">Hi ${escapeHtml(data.full_name)},</p>
        <p class="text">We have an update on your order <span class="order-ref">${escapeHtml(data.order_number)}</span>:</p>
        
        <div class="status-box">
          <div class="status-icon">${config.icon}</div>
          <div class="status-label">Current Status</div>
          <div class="status-value">${safeStatus}</div>
        </div>
        
        <p class="text">${config.message}</p>
        
        ${data.admin_notes ? `
        <div style="background: #fef3c7; border: 2px solid #facc15; padding: 16px; margin: 20px 0;">
          <p style="font-weight: 600; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Note from our team:</p>
          <p style="margin: 0; color: #333;">${escapeHtml(data.admin_notes)}</p>
        </div>
        ` : ''}
        
        <div class="cta-wrap">
          <a href="${siteUrl}/track-order" class="cta">Track Your Order →</a>
        </div>
        
        <p class="text" style="text-align: center; color: #666; font-size: 13px;">
          Questions about your order? We're here to help.
        </p>
      </div>
      
      ${getStandardFooter({ accentColor: config.color })}
    </div>
  </div>
</body>
</html>
`;
};

const getOrderMessageHtml = (data: Record<string, unknown>) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>New Message - OCCTA</title>
  <style>
    ${getCommonStyles()}
    
    .title-banner { background: #3b82f6; padding: 16px 32px; border-bottom: 4px solid #0d0d0d; }
    .title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 2px; text-transform: uppercase; margin: 0; color: #ffffff; }
    
    .order-ref { background: #0d0d0d; color: #facc15; padding: 2px 8px; font-family: monospace; }
    
    .message-box { background: #f5f4ef; border: 3px solid #0d0d0d; padding: 24px; margin: 24px 0; }
    .message-label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #666; margin-bottom: 12px; font-weight: 600; }
    .message-content { font-size: 15px; line-height: 1.7; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="preheader">New message regarding your OCCTA order #${escapeHtml(data.order_number)}</div>
  
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo">OCCTA</div>
        <div class="tagline">Telecom • Connected</div>
      </div>
      
      <div class="title-banner">
        <h1 class="title">💬 New Message</h1>
      </div>
      
      <div class="content">
        <p class="greeting">Hi ${escapeHtml(data.full_name)},</p>
        <p class="text">We have an update regarding your order <span class="order-ref">${escapeHtml(data.order_number)}</span>:</p>
        
        <div class="message-box">
          <div class="message-label">Message from OCCTA</div>
          <p class="message-content">${escapeHtml(data.message)}</p>
        </div>
        
        <p class="text">Have questions or need to respond? Log in to your dashboard or get in touch with our support team.</p>
        
        <div class="cta-wrap">
          <a href="${Deno.env.get("SITE_URL") || "https://occta.co.uk"}/dashboard" class="cta">View Order →</a>
        </div>
      </div>
      
      ${getStandardFooter({ accentColor: '#3b82f6' })}
    </div>
  </div>
</body>
</html>
`;

const getTicketReplyHtml = (data: Record<string, unknown>) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Support Reply - OCCTA</title>
  <style>
    ${getCommonStyles()}
    
    .title-banner { background: #22c55e; padding: 16px 32px; border-bottom: 4px solid #0d0d0d; }
    .title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 2px; text-transform: uppercase; margin: 0; color: #ffffff; }
    
    .ticket-subject { background: #0d0d0d; color: #fff; padding: 16px 20px; margin: 20px 0; }
    .ticket-label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #facc15; margin-bottom: 4px; }
    .ticket-title { font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 1px; }
    
    .message-box { background: #f5f4ef; border: 3px solid #0d0d0d; padding: 24px; margin: 20px 0; }
    .message-label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #666; margin-bottom: 12px; font-weight: 600; }
    .message-content { font-size: 15px; line-height: 1.7; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="preheader">Our support team has replied to your ticket: ${escapeHtml(data.ticket_subject)}</div>
  
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo">OCCTA</div>
        <div class="tagline">Telecom • Connected</div>
      </div>
      
      <div class="title-banner">
        <h1 class="title">✓ Support Reply</h1>
      </div>
      
      <div class="content">
        <p class="greeting">Hi ${escapeHtml(data.full_name)},</p>
        <p class="text">Good news! Our support team has replied to your ticket:</p>
        
        <div class="ticket-subject">
          <div class="ticket-label">Ticket Subject</div>
          <div class="ticket-title">RE: ${escapeHtml(data.ticket_subject)}</div>
        </div>
        
        <div class="message-box">
          <div class="message-label">Support Response</div>
          <p class="message-content">${escapeHtml(data.message)}</p>
        </div>
        
        <p class="text">You can continue the conversation from your dashboard. If your issue is resolved, you can close the ticket there.</p>
        
        <div class="cta-wrap">
          <a href="${Deno.env.get("SITE_URL") || "https://occta.co.uk"}/dashboard" class="cta">View Ticket →</a>
        </div>
      </div>
      
      ${getStandardFooter({ accentColor: '#22c55e' })}
    </div>
  </div>
</body>
</html>
`;

const getPasswordResetHtml = (data: Record<string, unknown>) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Password Reset - OCCTA</title>
  <style>
    ${getCommonStyles()}
    
    .title-banner { background: #ef4444; padding: 16px 32px; border-bottom: 4px solid #0d0d0d; }
    .title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 2px; text-transform: uppercase; margin: 0; color: #ffffff; }
    
    .security-note { background: #fef3c7; border: 3px solid #facc15; padding: 20px; margin: 24px 0; }
    .security-icon { font-size: 24px; margin-bottom: 8px; }
    .security-title { font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .security-text { font-size: 13px; color: #666; line-height: 1.6; margin: 0; }
  </style>
</head>
<body>
  <div class="preheader">Reset your OCCTA account password — this link expires in 1 hour.</div>
  
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo">OCCTA</div>
        <div class="tagline">Telecom • Connected</div>
      </div>
      
      <div class="title-banner">
        <h1 class="title">🔐 Password Reset</h1>
      </div>
      
      <div class="content">
        <p class="greeting">Hi ${escapeHtml(data.full_name) || "there"},</p>
        <p class="text">We received a request to reset your OCCTA account password. Click the button below to choose a new one:</p>
        
        <div class="cta-wrap">
          <a href="${escapeHtml(data.reset_link)}" class="cta" style="box-shadow: 4px 4px 0 0 #ef4444;">Reset Password →</a>
        </div>
        
        <div class="security-note">
          <div class="security-icon">🛡️</div>
          <div class="security-title">Security Notice</div>
          <p class="security-text">If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged. For security, this link will expire in 1 hour.</p>
        </div>
        
        <p class="text" style="text-align: center; color: #666; font-size: 13px;">
          Need help? Contact our support team anytime.
        </p>
      </div>
      
      ${getStandardFooter({ accentColor: '#ef4444' })}
    </div>
  </div>
</body>
</html>
`;

const getInvoiceSentHtml = (data: Record<string, unknown>) => {
  const siteUrl = Deno.env.get("SITE_URL") || "https://occta.co.uk";
  const lines = (data.lines as Array<{ description: string; qty: number; line_total: number }>) || [];
  
  const linesHtml = lines.map(line => `
    <tr>
      <td style="padding: 10px 16px; border-bottom: 1px solid #eee; font-size: 14px;">${escapeHtml(line.description)}</td>
      <td style="padding: 10px 16px; border-bottom: 1px solid #eee; text-align: center; font-size: 14px;">${line.qty}</td>
      <td style="padding: 10px 16px; border-bottom: 1px solid #eee; text-align: right; font-size: 14px; font-weight: 600;">£${sanitizeNumber(line.line_total)}</td>
    </tr>
  `).join('');
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Invoice ${escapeHtml(data.invoice_number)} - OCCTA</title>
  <style>
    ${getCommonStyles()}
    
    .title-banner { background: #3b82f6; padding: 16px 32px; border-bottom: 4px solid #0d0d0d; }
    .title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 2px; text-transform: uppercase; margin: 0; color: #ffffff; }
    
    .invoice-card { background: #f5f4ef; border: 3px solid #0d0d0d; margin: 24px 0; }
    .invoice-header { background: #0d0d0d; color: #fff; padding: 12px 20px; font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 2px; }
    .invoice-body { padding: 0; }
    .invoice-table { width: 100%; border-collapse: collapse; }
    .invoice-table th { background: #f5f4ef; font-size: 11px; text-transform: uppercase; padding: 12px 16px; text-align: left; letter-spacing: 1px; color: #666; }
    .totals-row { display: flex; justify-content: space-between; padding: 12px 16px; font-size: 14px; }
    .totals-row.grand { background: #0d0d0d; color: #fff; font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 1px; }
    .meta-row { display: flex; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #eee; }
    .meta-label { font-size: 11px; text-transform: uppercase; color: #666; letter-spacing: 1px; }
    .meta-value { font-weight: 600; font-size: 14px; }
    
    .payment-note { background: #fef3c7; border: 2px solid #facc15; padding: 16px; margin: 24px 0; font-size: 13px; }
  </style>
</head>
<body>
  <div class="preheader">Invoice ${escapeHtml(data.invoice_number)} — £${sanitizeNumber(data.total)} due ${data.due_date ? `by ${escapeHtml(data.due_date)}` : 'upon receipt'}</div>
  
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo">OCCTA</div>
        <div class="tagline">Telecom • Connected</div>
      </div>
      
      <div class="title-banner">
        <h1 class="title">📄 Invoice ${escapeHtml(data.invoice_number)}</h1>
      </div>
      
      <div class="content">
        <p class="greeting">Hi ${escapeHtml(data.customer_name) || "there"},</p>
        <p class="text">Please find your invoice below. Payment is due ${data.due_date ? `by <strong>${escapeHtml(data.due_date)}</strong>` : 'upon receipt'}.</p>
        
        <div class="invoice-card">
          <div class="invoice-header">Invoice Details</div>
          <div class="invoice-body">
            <div class="meta-row"><span class="meta-label">Invoice Number</span><span class="meta-value">${escapeHtml(data.invoice_number)}</span></div>
            <div class="meta-row"><span class="meta-label">Account Number</span><span class="meta-value">${escapeHtml(data.account_number)}</span></div>
            <div class="meta-row"><span class="meta-label">Issue Date</span><span class="meta-value">${escapeHtml(data.issue_date)}</span></div>
            ${data.due_date ? `<div class="meta-row"><span class="meta-label">Due Date</span><span class="meta-value" style="color: #ef4444; font-weight: 700;">${escapeHtml(data.due_date)}</span></div>` : ''}
          </div>
        </div>
        
        ${lines.length > 0 ? `
        <div class="invoice-card">
          <div class="invoice-header">Line Items</div>
          <table class="invoice-table">
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>${linesHtml}</tbody>
          </table>
        </div>
        ` : ''}
        
        <div class="invoice-card">
          <div class="totals-row"><span>Subtotal</span><span>£${sanitizeNumber(data.subtotal)}</span></div>
          <div class="totals-row"><span>VAT (20%)</span><span>£${sanitizeNumber(data.vat_total)}</span></div>
          <div class="totals-row grand"><span>TOTAL DUE</span><span>£${sanitizeNumber(data.total)}</span></div>
        </div>
        
        <div class="payment-note">
          <strong>💳 Payment Methods:</strong> Pay online via your dashboard, or call 0800 260 6627 to pay by card. Bank transfers accepted to OCCTA Ltd.
        </div>
        
        <div class="cta-wrap">
          <a href="${siteUrl}/pay-invoice?id=${escapeHtml(data.invoice_id)}" class="cta" style="box-shadow: 4px 4px 0 0 #3b82f6;">Pay Now →</a>
        </div>
        
        <p class="text" style="text-align: center; color: #666; font-size: 13px;">
          Questions about your invoice? Contact hello@occta.co.uk
        </p>
      </div>
      
      ${getStandardFooter({ accentColor: '#3b82f6' })}
    </div>
  </div>
</body>
</html>`;
};

const getInvoicePaidHtml = (data: Record<string, unknown>) => {
  const siteUrl = Deno.env.get("SITE_URL") || "https://occta.co.uk";
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Payment Confirmed - OCCTA</title>
  <style>
    ${getCommonStyles()}
    
    .title-banner { background: #22c55e; padding: 16px 32px; border-bottom: 4px solid #0d0d0d; }
    .title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 2px; text-transform: uppercase; margin: 0; color: #ffffff; }
    
    .receipt-box { background: #f0fdf4; border: 3px solid #22c55e; padding: 24px; margin: 24px 0; text-align: center; }
    .receipt-icon { font-size: 48px; margin-bottom: 12px; }
    .receipt-title { font-family: 'Bebas Neue', sans-serif; font-size: 24px; color: #22c55e; letter-spacing: 2px; }
    .receipt-details { margin-top: 20px; text-align: left; }
    .receipt-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #86efac; }
    .receipt-row:last-child { border-bottom: none; }
    .receipt-label { color: #666; font-size: 13px; }
    .receipt-value { font-weight: 600; font-size: 14px; }
  </style>
</head>
<body>
  <div class="preheader">Payment received! Invoice ${escapeHtml(data.invoice_number)} has been paid in full.</div>
  
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo">OCCTA</div>
        <div class="tagline">Telecom • Connected</div>
      </div>
      
      <div class="title-banner">
        <h1 class="title">✓ Payment Received</h1>
      </div>
      
      <div class="content">
        <p class="greeting">Hi ${escapeHtml(data.customer_name) || "there"},</p>
        <p class="text">Great news! We've received your payment. Thank you for keeping your account up to date.</p>
        
        <div class="receipt-box">
          <div class="receipt-icon">✅</div>
          <div class="receipt-title">Payment Confirmed</div>
          <div class="receipt-details">
            <div class="receipt-row"><span class="receipt-label">Invoice Number</span><span class="receipt-value">${escapeHtml(data.invoice_number)}</span></div>
            <div class="receipt-row"><span class="receipt-label">Amount Paid</span><span class="receipt-value" style="color: #22c55e;">£${sanitizeNumber(data.total)}</span></div>
            <div class="receipt-row"><span class="receipt-label">Payment Date</span><span class="receipt-value">${escapeHtml(data.paid_date) || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
            ${data.receipt_reference ? `<div class="receipt-row"><span class="receipt-label">Receipt Reference</span><span class="receipt-value">${escapeHtml(data.receipt_reference)}</span></div>` : ''}
          </div>
        </div>
        
        <div class="cta-wrap">
          <a href="${siteUrl}/dashboard" class="cta" style="box-shadow: 4px 4px 0 0 #22c55e;">View Receipt →</a>
        </div>
        
        <p class="text" style="text-align: center; color: #666; font-size: 13px;">
          This email serves as confirmation of your payment. A receipt is available in your dashboard.
        </p>
      </div>
      
      ${getStandardFooter({ accentColor: '#22c55e' })}
    </div>
  </div>
</body>
</html>`;
};


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isAdmin = async (supabase: any, userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  
  return !error && data !== null;
};

// Helper to validate email format
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Email function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, to, data, orderNumber }: EmailRequest = await req.json();

    if (!resendApiKey) {
      console.error("Missing RESEND_API_KEY");
      return new Response(
        JSON.stringify({ error: "Email service is not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    if (!isValidEmail(to)) {
      console.error("Invalid email format:", to);
      return new Response(
        JSON.stringify({ error: "Invalid email address format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Handle order_confirmation for guest orders (no auth required, but verify order exists)
    if (type === "order_confirmation" && orderNumber) {
      const { data: guestOrder, error: orderError } = await supabaseAdmin
        .from("guest_orders")
        .select("email, order_number")
        .eq("order_number", orderNumber)
        .single();
      
      if (orderError || !guestOrder) {
        console.error("Order not found:", orderNumber);
        return new Response(
          JSON.stringify({ error: "Order not found" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      if (guestOrder.email.toLowerCase() !== to.toLowerCase()) {
        console.error("Email mismatch for order confirmation");
        return new Response(
          JSON.stringify({ error: "Forbidden - Email recipient mismatch" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      console.log(`Verified guest order confirmation for ${orderNumber}`);
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        console.error("No authorization header provided");
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      
      if (authError || !user) {
        console.error("Auth verification failed:", authError);
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // For admin-only actions like ticket_reply, order_message, invoice_sent/paid, verify admin role
      const adminOnlyTypes = ["ticket_reply", "order_message", "invoice_sent", "invoice_paid"];
      if (adminOnlyTypes.includes(type)) {
        const userIsAdmin = await isAdmin(supabaseAdmin, user.id);
        if (!userIsAdmin) {
          console.error("User is not an admin:", user.id);
          return new Response(
            JSON.stringify({ error: "Forbidden - Admin access required" }),
            { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }
    }

    // Generate HTML based on type
    let html: string;
    let subject: string;

    switch (type) {
      case "order_confirmation":
        html = getOrderConfirmationHtml(data);
        subject = `Order Confirmed - #${escapeHtml(data.order_number)}`;
        break;
      case "welcome":
        html = getWelcomeHtml(data);
        subject = "Welcome to OCCTA! 🎉";
        break;
      case "status_update":
        html = getStatusUpdateHtml(data);
        subject = `Order Update - #${escapeHtml(data.order_number)} is now ${escapeHtml(data.status)}`;
        break;
      case "order_message":
        html = getOrderMessageHtml(data);
        subject = `New Message - Order #${escapeHtml(data.order_number)}`;
        break;
      case "ticket_reply":
        html = getTicketReplyHtml(data);
        subject = `Support Reply: ${escapeHtml(data.ticket_subject)}`;
        break;
      case "password_reset":
        html = getPasswordResetHtml(data);
        subject = "Reset Your OCCTA Password";
        break;
      case "invoice_sent":
        html = getInvoiceSentHtml(data);
        subject = `Invoice ${escapeHtml(data.invoice_number)} - £${sanitizeNumber(data.total)} Due`;
        break;
      case "invoice_paid":
        html = getInvoicePaidHtml(data);
        subject = `Payment Received - Invoice ${escapeHtml(data.invoice_number)}`;
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Unknown email type" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
    }

    // Use RESEND_FROM_EMAIL for all emails - this must be a verified domain in Resend
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@occta.co.uk";
    
    // Get admin email for BCC (if configured)
    const adminEmail = Deno.env.get("ADMIN_EMAIL");
    const bccList = type === "order_confirmation" && adminEmail ? [adminEmail] : undefined;
    
    const emailResponse = await resend.emails.send({
      from: `OCCTA Telecom <${fromEmail}>`,
      to: [to],
      bcc: bccList,
      subject,
      html,
    });

    console.log(`Email sent successfully: ${type} to ${to}`);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error) {
    console.error("Error in email function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
