import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const ADMIN_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL") || Deno.env.get("ADMIN_EMAIL") || "hello@occta.co.uk";
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@occta.co.uk";
const ADMIN_DASHBOARD_URL = "https://www.occta.co.uk/admin";

// Module-scoped service client — used by BOTH the public rate-limit path and
// the notification/logging paths below. (Previously it was declared inside the
// public-caller branch, so every internal DB-trigger call threw a
// ReferenceError and no admin email was ever sent.)
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotificationPayload {
  type:
    | "new_guest_order"
    | "new_order"
    | "new_ticket"
    | "failed_payment"
    | "customer_proceeded_quote"
    | "new_business_enquiry"
    | "new_quote_request"
    | "human_chat_request"
    | "dd_mandate_submitted"
    | "invoice_paid"
    | "contract_signed"
    | "order_live";
  data: Record<string, unknown>;
}

function escapeHtml(text: string | null | undefined): string {
  if (!text) return "N/A";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "N/A";
  return `£${Number(amount).toFixed(2)}`;
}

function formatDate(date: string | null | undefined): string {
  if (!date) return "N/A";
  try {
    return new Date(date).toLocaleString("en-GB", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Europe/London",
    });
  } catch {
    return String(date);
  }
}

function formatDateShort(date: string | null | undefined): string {
  if (!date) return "N/A";
  try {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(date);
  }
}

function generateOrderEmail(data: Record<string, unknown>, isGuest: boolean): { subject: string; html: string } {
  // Extract all order details
  const orderNumber = escapeHtml(String(data.order_number || data.orderNumber || "N/A"));
  const orderId = escapeHtml(String(data.id || data.orderId || "N/A"));
  const customerName = escapeHtml(String(data.customer_name || data.full_name || "Unknown"));
  const customerEmail = escapeHtml(String(data.customer_email || data.email || "N/A"));
  const customerPhone = escapeHtml(String(data.phone || data.customer_phone || "N/A"));
  const dateOfBirth = formatDateShort(String(data.date_of_birth || ""));
  
  // Plan details
  const planName = escapeHtml(String(data.plan_name || "N/A"));
  const planPrice = formatCurrency(data.plan_price as number);
  const serviceType = escapeHtml(String(data.service_type || "N/A"));
  
  // Address details
  const addressLine1 = escapeHtml(String(data.address_line1 || "N/A"));
  const addressLine2 = escapeHtml(String(data.address_line2 || ""));
  const city = escapeHtml(String(data.city || ""));
  const postcode = escapeHtml(String(data.postcode || ""));
  const fullAddress = [addressLine1, addressLine2, city, postcode].filter(Boolean).join(", ");
  
  // Provider/switching details
  const currentProvider = escapeHtml(String(data.current_provider || "Not specified"));
  const inContract = data.in_contract ? "Yes" : "No";
  const contractEndDate = formatDateShort(String(data.contract_end_date || ""));
  const preferredSwitchDate = formatDateShort(String(data.preferred_switch_date || ""));
  
  // Selected addons
  const selectedAddons = data.selected_addons 
    ? (Array.isArray(data.selected_addons) 
        ? data.selected_addons.map((a: { name?: string; price?: number }) => 
            `${escapeHtml(a.name || "Addon")} (${formatCurrency(a.price)})`
          ).join(", ")
        : escapeHtml(JSON.stringify(data.selected_addons)))
    : "None";
  
  // Notes and consent
  const additionalNotes = escapeHtml(String(data.additional_notes || data.notes || "None"));
  const gdprConsent = data.gdpr_consent ? "✓ Granted" : "✗ Not granted";
  const marketingConsent = data.marketing_consent ? "✓ Opted in" : "✗ Opted out";
  
  // Technical details
  const ipAddress = escapeHtml(String(data.ip_address || data.ipAddress || "Not captured"));
  const ipCountry = escapeHtml(String(data.ip_country || data.ipCountry || "Unknown"));
  const userAgent = escapeHtml(String(data.user_agent || data.userAgent || "Not captured"));
  const submittedAt = formatDate(String(data.created_at || data.submittedAt || new Date().toISOString()));
  const accountNumber = escapeHtml(String(data.account_number || "Pending assignment"));
  
  // User ID for logged-in orders
  const userId = escapeHtml(String(data.user_id || "Guest"));

  const subject = `🆕 New ${isGuest ? "Guest " : ""}Order Received | #${orderNumber}`;
  
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.55; color: #111827; font-size: 16px; max-width: 720px; margin: 0 auto; padding: 0; background: #f5f5f5;">
      <!-- Header -->
      <div style="background-color:#0B1220; background-image: linear-gradient(135deg, #0B1220 0%, #0F1B3D 55%, #0B1220 100%); padding: 32px 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
          New ${isGuest ? "Guest " : ""}Order Received
        </h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 16px;">
          Order #${orderNumber} • ${formatDateShort(String(data.created_at || new Date().toISOString()))}
        </p>
      </div>
      
      <!-- Main Content -->
      <div style="padding: 32px 24px; background: white;">
        <!-- Priority Banner -->
        <div style="background: #FFF3CD; border-left: 4px solid #FFC107; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0; font-weight: 600; color: #856404;">
            ⚡ Action Required: Review and process this order
          </p>
        </div>
        
        <!-- Order Summary Card -->
        <div style="background: #F8F9FA; border: 1px solid #E9ECEF; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px; font-size: 14px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.6px;">
            Order Summary
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; color: #374151; width: 40%; font-size: 15px;">Order Number:</td>
              <td style="padding: 8px 0; font-weight: 600; font-size: 14px; color: #0066FF;">#${orderNumber}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #374151; font-size: 15px;">Order ID:</td>
              <td style="padding: 8px 0; font-size: 14px; font-family: monospace; color: #495057;">${orderId}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #374151; font-size: 15px;">Service Type:</td>
              <td style="padding: 8px 0; font-size: 14px;">
                <span style="background: #E3F2FD; color: #1565C0; padding: 4px 12px; border-radius: 4px; font-weight: 500; text-transform: capitalize;">${serviceType}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #374151; font-size: 15px;">Selected Plan:</td>
              <td style="padding: 8px 0; font-weight: 600; font-size: 14px;">${planName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #374151; font-size: 15px;">Monthly Price:</td>
              <td style="padding: 8px 0; font-weight: 700; font-size: 18px; color: #28A745;">${planPrice}/mo</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #374151; font-size: 15px;">Add-ons:</td>
              <td style="padding: 8px 0; font-size: 14px;">${selectedAddons}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #374151; font-size: 15px;">Account Number:</td>
              <td style="padding: 8px 0; font-size: 14px; font-family: monospace;">${accountNumber}</td>
            </tr>
          </table>
        </div>
        
        <!-- Customer Information -->
        <div style="background: #F8F9FA; border: 1px solid #E9ECEF; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px; font-size: 14px; font-weight: 600; color: #6C757D; text-transform: uppercase; letter-spacing: 0.5px;">
            👤 Customer Information
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6C757D; width: 40%; font-size: 14px;">Full Name:</td>
              <td style="padding: 8px 0; font-weight: 600; font-size: 14px;">${customerName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 14px;">Email Address:</td>
              <td style="padding: 8px 0; font-size: 14px;">
                <a href="mailto:${customerEmail}" style="color: #0066FF; text-decoration: none;">${customerEmail}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 14px;">Phone Number:</td>
              <td style="padding: 8px 0; font-size: 14px;">
                <a href="tel:${customerPhone}" style="color: #0066FF; text-decoration: none;">${customerPhone}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 14px;">Date of Birth:</td>
              <td style="padding: 8px 0; font-size: 14px;">${dateOfBirth}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 14px;">User Type:</td>
              <td style="padding: 8px 0; font-size: 14px;">
                <span style="background: ${isGuest ? '#FFF3CD' : '#D4EDDA'}; color: ${isGuest ? '#856404' : '#155724'}; padding: 4px 12px; border-radius: 4px; font-weight: 500;">
                  ${isGuest ? '👤 Guest Customer' : '✓ Registered User'}
                </span>
              </td>
            </tr>
            ${!isGuest ? `<tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 14px;">User ID:</td>
              <td style="padding: 8px 0; font-size: 14px; font-family: monospace; color: #495057;">${userId}</td>
            </tr>` : ''}
          </table>
        </div>
        
        <!-- Installation Address -->
        <div style="background: #F8F9FA; border: 1px solid #E9ECEF; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px; font-size: 14px; font-weight: 600; color: #6C757D; text-transform: uppercase; letter-spacing: 0.5px;">
            📍 Installation Address
          </h2>
          <p style="margin: 0; font-size: 14px; line-height: 1.8;">
            ${addressLine1}<br>
            ${addressLine2 ? addressLine2 + '<br>' : ''}
            ${city}<br>
            <strong>${postcode}</strong>
          </p>
        </div>
        
        <!-- Switching Details -->
        <div style="background: #F8F9FA; border: 1px solid #E9ECEF; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px; font-size: 14px; font-weight: 600; color: #6C757D; text-transform: uppercase; letter-spacing: 0.5px;">
            🔄 Provider & Switching Details
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6C757D; width: 40%; font-size: 14px;">Current Provider:</td>
              <td style="padding: 8px 0; font-size: 14px;">${currentProvider}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 14px;">Currently in Contract:</td>
              <td style="padding: 8px 0; font-size: 14px;">
                <span style="background: ${data.in_contract ? '#FFEBEE' : '#E8F5E9'}; color: ${data.in_contract ? '#C62828' : '#2E7D32'}; padding: 4px 12px; border-radius: 4px; font-weight: 500;">${inContract}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 14px;">Contract End Date:</td>
              <td style="padding: 8px 0; font-size: 14px;">${contractEndDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 14px;">Preferred Switch Date:</td>
              <td style="padding: 8px 0; font-size: 14px;">${preferredSwitchDate}</td>
            </tr>
          </table>
        </div>
        
        <!-- Consent & Compliance -->
        <div style="background: #F8F9FA; border: 1px solid #E9ECEF; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px; font-size: 14px; font-weight: 600; color: #6C757D; text-transform: uppercase; letter-spacing: 0.5px;">
            📋 Consent & Compliance
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6C757D; width: 40%; font-size: 14px;">GDPR Consent:</td>
              <td style="padding: 8px 0; font-size: 14px;">
                <span style="color: ${data.gdpr_consent ? '#28A745' : '#DC3545'}; font-weight: 600;">${gdprConsent}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 14px;">Marketing Consent:</td>
              <td style="padding: 8px 0; font-size: 14px;">
                <span style="color: ${data.marketing_consent ? '#28A745' : '#6C757D'}; font-weight: 500;">${marketingConsent}</span>
              </td>
            </tr>
          </table>
        </div>
        
        <!-- Additional Notes -->
        ${additionalNotes !== "None" ? `
        <div style="background: #FFF8E1; border: 1px solid #FFE082; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #F57C00; text-transform: uppercase; letter-spacing: 0.5px;">
            📝 Customer Notes
          </h2>
          <p style="margin: 0; font-size: 14px; color: #5D4037; white-space: pre-wrap;">${additionalNotes}</p>
        </div>
        ` : ''}
        
        <!-- Technical Details -->
        <div style="background: #ECEFF1; border: 1px solid #CFD8DC; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px; font-size: 14px; font-weight: 600; color: #6C757D; text-transform: uppercase; letter-spacing: 0.5px;">
            🔧 Technical & Audit Information
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6C757D; width: 40%; font-size: 13px;">Submitted At:</td>
              <td style="padding: 8px 0; font-size: 13px; font-family: monospace;">${submittedAt}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 13px;">IP Address:</td>
              <td style="padding: 8px 0; font-size: 13px; font-family: monospace;">${ipAddress}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 13px;">IP Country:</td>
              <td style="padding: 8px 0; font-size: 13px; font-family: monospace;">${ipCountry}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 13px;">User Agent:</td>
              <td style="padding: 8px 0; font-size: 12px; font-family: monospace; word-break: break-all; color: #607D8B;">${userAgent}</td>
            </tr>
          </table>
        </div>
        
        <!-- CTA Button -->
        <div style="text-align: center; margin: 32px 0;">
          <a href="${ADMIN_DASHBOARD_URL}/orders" 
             style="display: inline-block; background: linear-gradient(135deg, #0066FF 0%, #0052CC 100%); color: white; padding: 16px 40px; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 102, 255, 0.3);">
            View Order in Dashboard →
          </a>
        </div>
        
        <!-- Quick Actions -->
        <div style="border-top: 1px solid #E9ECEF; padding-top: 20px; text-align: center;">
          <p style="margin: 0 0 12px; font-size: 13px; color: #6C757D;">Quick Actions:</p>
          <a href="mailto:${customerEmail}" style="display: inline-block; margin: 0 8px; padding: 8px 16px; background: #F8F9FA; color: #495057; text-decoration: none; border-radius: 4px; font-size: 13px;">📧 Email Customer</a>
          <a href="tel:${customerPhone}" style="display: inline-block; margin: 0 8px; padding: 8px 16px; background: #F8F9FA; color: #495057; text-decoration: none; border-radius: 4px; font-size: 13px;">📞 Call Customer</a>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="padding: 24px; text-align: center; background: #1a1a1a; color: #9CA3AF;">
        <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: white;">OCCTA Admin Notifications</p>
        <p style="margin: 0; font-size: 12px;">This is an automated message from your admin system.</p>
        <p style="margin: 12px 0 0; font-size: 11px; color: #6B7280;">
          OCCTA Limited • Company No. 13828933 • 22 Pavilion View, Huddersfield, HD3 3WU
        </p>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

function generateTicketEmail(data: Record<string, unknown>): { subject: string; html: string } {
  const ticketId = escapeHtml(String(data.id || data.ticketId || "N/A"));
  const ticketSubject = escapeHtml(String(data.subject || "No subject"));
  const category = escapeHtml(String(data.category || "General"));
  const priority = String(data.priority || "medium");
  const customerName = escapeHtml(String(data.customer_name || "Unknown"));
  const customerEmail = escapeHtml(String(data.customer_email || "N/A"));
  const customerPhone = escapeHtml(String(data.customer_phone || data.phone || "N/A"));
  const accountNumber = escapeHtml(String(data.account_number || "N/A"));
  const description = escapeHtml(String(data.description || "No description provided"));
  const userId = escapeHtml(String(data.user_id || "N/A"));
  const submittedAt = formatDate(String(data.created_at || new Date().toISOString()));
  const ipAddress = escapeHtml(String(data.ip_address || data.ipAddress || "Not captured"));
  const userAgent = escapeHtml(String(data.user_agent || data.userAgent || "Not captured"));

  const priorityConfig: Record<string, { color: string; bg: string; label: string }> = {
    low: { color: "#155724", bg: "#D4EDDA", label: "🟢 Low" },
    medium: { color: "#856404", bg: "#FFF3CD", label: "🟡 Medium" },
    high: { color: "#721C24", bg: "#F8D7DA", label: "🟠 High" },
    urgent: { color: "#FFFFFF", bg: "#DC3545", label: "🔴 Urgent" },
  };
  const pConfig = priorityConfig[priority] || priorityConfig.medium;

  const subject = `🎫 New Support Ticket | ${ticketSubject}`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 700px; margin: 0 auto; padding: 0; background: #f5f5f5;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #FF5500 0%, #E64A00 100%); padding: 32px 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
          New Support Ticket
        </h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 16px;">
          Requires attention
        </p>
      </div>
      
      <!-- Main Content -->
      <div style="padding: 32px 24px; background: white;">
        <!-- Priority Banner -->
        <div style="background: ${pConfig.bg}; border-left: 4px solid ${pConfig.color === '#FFFFFF' ? '#DC3545' : pConfig.color}; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0; font-weight: 600; color: ${pConfig.color === '#FFFFFF' ? '#721C24' : pConfig.color};">
            ${pConfig.label} Priority - ${priority === 'urgent' ? 'Immediate action required!' : 'Please review and respond'}
          </p>
        </div>
        
        <!-- Ticket Summary -->
        <div style="background: #F8F9FA; border: 1px solid #E9ECEF; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px; font-size: 14px; font-weight: 600; color: #6C757D; text-transform: uppercase; letter-spacing: 0.5px;">
            Ticket Details
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6C757D; width: 35%; font-size: 14px;">Ticket ID:</td>
              <td style="padding: 8px 0; font-size: 14px; font-family: monospace; color: #495057;">${ticketId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 14px;">Subject:</td>
              <td style="padding: 8px 0; font-weight: 600; font-size: 14px;">${ticketSubject}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 14px;">Category:</td>
              <td style="padding: 8px 0; font-size: 14px;">
                <span style="background: #E3F2FD; color: #1565C0; padding: 4px 12px; border-radius: 4px; font-weight: 500; text-transform: capitalize;">${category}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 14px;">Priority:</td>
              <td style="padding: 8px 0; font-size: 14px;">
                <span style="background: ${pConfig.bg}; color: ${pConfig.color}; padding: 4px 12px; border-radius: 4px; font-weight: 600; text-transform: uppercase;">${priority}</span>
              </td>
            </tr>
          </table>
        </div>
        
        <!-- Customer Information -->
        <div style="background: #F8F9FA; border: 1px solid #E9ECEF; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px; font-size: 14px; font-weight: 600; color: #6C757D; text-transform: uppercase; letter-spacing: 0.5px;">
            👤 Customer Information
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6C757D; width: 35%; font-size: 14px;">Full Name:</td>
              <td style="padding: 8px 0; font-weight: 600; font-size: 14px;">${customerName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 14px;">Email:</td>
              <td style="padding: 8px 0; font-size: 14px;">
                <a href="mailto:${customerEmail}" style="color: #0066FF; text-decoration: none;">${customerEmail}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 14px;">Phone:</td>
              <td style="padding: 8px 0; font-size: 14px;">
                <a href="tel:${customerPhone}" style="color: #0066FF; text-decoration: none;">${customerPhone}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 14px;">Account Number:</td>
              <td style="padding: 8px 0; font-size: 14px; font-family: monospace;">${accountNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 14px;">User ID:</td>
              <td style="padding: 8px 0; font-size: 14px; font-family: monospace; color: #6C757D;">${userId}</td>
            </tr>
          </table>
        </div>
        
        <!-- Description -->
        <div style="background: #FFFBF0; border: 1px solid #FFE082; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #5D4037; text-transform: uppercase; letter-spacing: 0.5px;">
            📝 Issue Description
          </h2>
          <p style="margin: 0; font-size: 14px; color: #37474F; white-space: pre-wrap; line-height: 1.7;">${description}</p>
        </div>
        
        <!-- Technical Details -->
        <div style="background: #ECEFF1; border: 1px solid #CFD8DC; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px; font-size: 14px; font-weight: 600; color: #6C757D; text-transform: uppercase; letter-spacing: 0.5px;">
            🔧 Technical & Audit Information
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6C757D; width: 35%; font-size: 13px;">Submitted At:</td>
              <td style="padding: 8px 0; font-size: 13px; font-family: monospace;">${submittedAt}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 13px;">IP Address:</td>
              <td style="padding: 8px 0; font-size: 13px; font-family: monospace;">${ipAddress}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 13px;">User Agent:</td>
              <td style="padding: 8px 0; font-size: 12px; font-family: monospace; word-break: break-all; color: #607D8B;">${userAgent}</td>
            </tr>
          </table>
        </div>
        
        <!-- CTA Button -->
        <div style="text-align: center; margin: 32px 0;">
          <a href="${ADMIN_DASHBOARD_URL}/tickets" 
             style="display: inline-block; background: linear-gradient(135deg, #FF5500 0%, #E64A00 100%); color: white; padding: 16px 40px; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(255, 85, 0, 0.3);">
            View Ticket in Dashboard →
          </a>
        </div>
        
        <!-- Quick Actions -->
        <div style="border-top: 1px solid #E9ECEF; padding-top: 20px; text-align: center;">
          <p style="margin: 0 0 12px; font-size: 13px; color: #6C757D;">Quick Actions:</p>
          <a href="mailto:${customerEmail}" style="display: inline-block; margin: 0 8px; padding: 8px 16px; background: #F8F9FA; color: #495057; text-decoration: none; border-radius: 4px; font-size: 13px;">📧 Reply to Customer</a>
          <a href="tel:${customerPhone}" style="display: inline-block; margin: 0 8px; padding: 8px 16px; background: #F8F9FA; color: #495057; text-decoration: none; border-radius: 4px; font-size: 13px;">📞 Call Customer</a>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="padding: 24px; text-align: center; background: #1a1a1a; color: #9CA3AF;">
        <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: white;">OCCTA Admin Notifications</p>
        <p style="margin: 0; font-size: 12px;">This is an automated message from your admin system.</p>
        <p style="margin: 12px 0 0; font-size: 11px; color: #6B7280;">
          OCCTA Limited • Company No. 13828933 • 22 Pavilion View, Huddersfield, HD3 3WU
        </p>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

function generateFailedPaymentEmail(data: Record<string, unknown>): { subject: string; html: string } {
  const customerName = escapeHtml(String(data.customer_name || "Unknown"));
  const customerEmail = escapeHtml(String(data.customer_email || "N/A"));
  const amount = formatCurrency(data.amount as number);
  const invoiceNumber = escapeHtml(String(data.invoice_number || "N/A"));
  const failureReason = escapeHtml(String(data.reason || "Unknown error"));
  const provider = escapeHtml(String(data.provider || "N/A"));
  const attemptedAt = formatDate(String(data.attempted_at || new Date().toISOString()));

  const subject = `⚠️ Failed Payment Alert | ${customerName} - ${amount}`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 700px; margin: 0 auto; padding: 0; background: #f5f5f5;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #DC3545 0%, #C82333 100%); padding: 32px 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">
          ⚠️ Payment Failed
        </h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 16px;">
          Immediate attention required
        </p>
      </div>
      
      <!-- Main Content -->
      <div style="padding: 32px 24px; background: white;">
        <div style="background: #F8D7DA; border-left: 4px solid #DC3545; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0; font-weight: 600; color: #721C24;">
            A payment attempt has failed. Please review and take appropriate action.
          </p>
        </div>
        
        <div style="background: #F8F9FA; border: 1px solid #E9ECEF; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6C757D; width: 40%; font-size: 14px;">Customer:</td>
              <td style="padding: 8px 0; font-weight: 600; font-size: 14px;">${customerName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 14px;">Email:</td>
              <td style="padding: 8px 0; font-size: 14px;">
                <a href="mailto:${customerEmail}" style="color: #0066FF; text-decoration: none;">${customerEmail}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 14px;">Amount:</td>
              <td style="padding: 8px 0; font-weight: 700; font-size: 18px; color: #DC3545;">${amount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 14px;">Invoice:</td>
              <td style="padding: 8px 0; font-size: 14px; font-family: monospace;">${invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 14px;">Provider:</td>
              <td style="padding: 8px 0; font-size: 14px;">${provider}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 14px;">Attempted:</td>
              <td style="padding: 8px 0; font-size: 14px;">${attemptedAt}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6C757D; font-size: 14px;">Failure Reason:</td>
              <td style="padding: 8px 0; font-size: 14px; color: #DC3545; font-weight: 500;">${failureReason}</td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${ADMIN_DASHBOARD_URL}/billing" 
             style="display: inline-block; background: linear-gradient(135deg, #DC3545 0%, #C82333 100%); color: white; padding: 16px 40px; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
            View in Billing Dashboard →
          </a>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="padding: 24px; text-align: center; background: #1a1a1a; color: #9CA3AF;">
        <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: white;">OCCTA Admin Notifications</p>
        <p style="margin: 0; font-size: 12px;">This is an automated message from your admin system.</p>
        <p style="margin: 12px 0 0; font-size: 11px; color: #6B7280;">
          OCCTA Limited • Company No. 13828933 • 22 Pavilion View, Huddersfield, HD3 3WU
        </p>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

function generateProceededQuoteEmail(data: Record<string, unknown>): { subject: string; html: string } {
  const quoteNumber = escapeHtml(data.quote_number as string);
  const planName = escapeHtml(data.plan_name as string);
  const monthly = formatCurrency(data.monthly_gross as number);
  const customerName = escapeHtml(data.customer_name as string);
  const customerEmail = escapeHtml(data.customer_email as string);
  const postcode = escapeHtml(data.postcode as string);
  const reference = escapeHtml(data.request_reference as string);
  const subject = `Customer proceeded — ${quoteNumber} ready for Contract Summary`;
  const html = `<!DOCTYPE html><html><body style="margin:0;font-family:Arial,sans-serif;background:#f4f4f5;padding:24px;color:#111">
    <div style="max-width:600px;margin:0 auto;background:#fff;border:4px solid #111;padding:24px">
      <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px;color:#666">OCCTA Admin</p>
      <h1 style="font-size:20px;margin:0 0 16px">Customer accepted final quote</h1>
      <p style="margin:0 0 12px">A customer has chosen to proceed with their quote. Time to generate the Contract Summary.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:6px 0;color:#666;width:140px">Quote</td><td><strong>${quoteNumber}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666">Plan</td><td>${planName} — ${monthly}/mo</td></tr>
        <tr><td style="padding:6px 0;color:#666">Customer</td><td>${customerName} &lt;${customerEmail}&gt;</td></tr>
        <tr><td style="padding:6px 0;color:#666">Postcode</td><td>${postcode}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Request</td><td>${reference}</td></tr>
      </table>
      <a href="${ADMIN_DASHBOARD_URL}/quote-requests?search=${encodeURIComponent(String(data.request_reference ?? ""))}"
         style="display:inline-block;background:#111;color:#fff;padding:14px 28px;text-decoration:none;font-weight:600;border:2px solid #111">
        Open in admin →
      </a>
      <p style="margin:24px 0 0;font-size:12px;color:#666">No payment, supplier order, or service has been created. Generate the Contract Summary when ready.</p>
    </div></body></html>`;
  return { subject, html };
}

function generateBusinessEnquiryEmail(data: Record<string, unknown>): { subject: string; html: string } {
  const leadId = escapeHtml(String(data.lead_id || data.order_number || "N/A"));
  const enquiryType = escapeHtml(String(data.enquiry_type || "Business enquiry"));
  const businessName = escapeHtml(String(data.business_name || "N/A"));
  const contactName = escapeHtml(String(data.contact_name || "N/A"));
  const customerEmail = escapeHtml(String(data.customer_email || data.email || "N/A"));
  const customerPhone = escapeHtml(String(data.customer_phone || data.phone || "N/A"));
  const postcode = escapeHtml(String(data.postcode || "N/A"));
  const address = escapeHtml(String(data.address || "N/A"));
  const plan = escapeHtml(String(data.plan || "N/A"));
  const services = escapeHtml(String(data.services || "None selected"));
  const notes = escapeHtml(String(data.notes || data.message || "None"));
  const ipAddress = escapeHtml(String(data.ip_address || "Not captured"));
  const subject = `🏢 New Business Enquiry | ${businessName}`;

  const html = `<!DOCTYPE html><html><body style="margin:0;font-family:Arial,sans-serif;background:#f4f4f5;padding:24px;color:#111">
    <div style="max-width:640px;margin:0 auto;background:#fff;border:4px solid #111">
      <div style="background:#111;color:#facc15;padding:18px 24px;font-weight:900;letter-spacing:3px;text-transform:uppercase">OCCTA Admin</div>
      <div style="padding:24px">
        <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px;color:#666">Business enquiry</p>
        <h1 style="font-size:22px;margin:0 0 16px">${enquiryType}</h1>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:7px 0;color:#666;width:150px">Lead</td><td><strong>${leadId}</strong></td></tr>
          <tr><td style="padding:7px 0;color:#666">Business</td><td><strong>${businessName}</strong></td></tr>
          <tr><td style="padding:7px 0;color:#666">Contact</td><td>${contactName}</td></tr>
          <tr><td style="padding:7px 0;color:#666">Email</td><td><a href="mailto:${customerEmail}" style="color:#111">${customerEmail}</a></td></tr>
          <tr><td style="padding:7px 0;color:#666">Phone</td><td><a href="tel:${customerPhone}" style="color:#111">${customerPhone}</a></td></tr>
          <tr><td style="padding:7px 0;color:#666">Address</td><td>${address}</td></tr>
          <tr><td style="padding:7px 0;color:#666">Postcode</td><td>${postcode}</td></tr>
          <tr><td style="padding:7px 0;color:#666">Plan</td><td>${plan}</td></tr>
          <tr><td style="padding:7px 0;color:#666">Services</td><td>${services}</td></tr>
          <tr><td style="padding:7px 0;color:#666;vertical-align:top">Notes</td><td>${notes}</td></tr>
          <tr><td style="padding:7px 0;color:#666">IP</td><td>${ipAddress}</td></tr>
        </table>
        <a href="${ADMIN_DASHBOARD_URL}/orders" style="display:inline-block;background:#111;color:#fff;padding:14px 28px;text-decoration:none;font-weight:700;border:2px solid #111">Open admin →</a>
      </div>
    </div></body></html>`;
  return { subject, html };
}

function generateQuoteRequestEmail(data: Record<string, unknown>): { subject: string; html: string } {
  const reference = escapeHtml(String(data.reference || "N/A"));
  const customerName = escapeHtml(String(data.full_name || data.customer_name || "N/A"));
  const customerEmail = escapeHtml(String(data.email || data.customer_email || "N/A"));
  const phone = escapeHtml(String(data.phone || "N/A"));
  const service = escapeHtml(String(data.service_interest || "N/A"));
  const customerType = escapeHtml(String(data.customer_type || "N/A"));
  const postcode = escapeHtml(String(data.postcode || "N/A"));
  const preferredContact = escapeHtml(String(data.preferred_contact_method || "N/A"));
  const source = escapeHtml(String(data.source || "web"));
  const message = escapeHtml(String(data.message || "None"));
  const createdAt = formatDate(String(data.created_at || new Date().toISOString()));
  const subject = `📩 New Quote Enquiry | ${reference}`;

  const html = `<!DOCTYPE html><html><body style="margin:0;font-family:Arial,sans-serif;background:#f4f4f5;padding:24px;color:#111">
    <div style="max-width:640px;margin:0 auto;background:#fff;border:4px solid #111">
      <div style="background:#111;color:#facc15;padding:18px 24px;font-weight:900;letter-spacing:3px;text-transform:uppercase">OCCTA Admin</div>
      <div style="padding:24px">
        <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px;color:#666">Quote enquiry</p>
        <h1 style="font-size:22px;margin:0 0 16px">${reference}</h1>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:7px 0;color:#666;width:150px">Customer</td><td><strong>${customerName}</strong></td></tr>
          <tr><td style="padding:7px 0;color:#666">Email</td><td><a href="mailto:${customerEmail}" style="color:#111">${customerEmail}</a></td></tr>
          <tr><td style="padding:7px 0;color:#666">Phone</td><td><a href="tel:${phone}" style="color:#111">${phone}</a></td></tr>
          <tr><td style="padding:7px 0;color:#666">Service</td><td>${service} · ${customerType}</td></tr>
          <tr><td style="padding:7px 0;color:#666">Postcode</td><td>${postcode}</td></tr>
          <tr><td style="padding:7px 0;color:#666">Preferred contact</td><td>${preferredContact}</td></tr>
          <tr><td style="padding:7px 0;color:#666">Source</td><td>${source}</td></tr>
          <tr><td style="padding:7px 0;color:#666">Submitted</td><td>${createdAt}</td></tr>
          <tr><td style="padding:7px 0;color:#666;vertical-align:top">Message</td><td>${message}</td></tr>
        </table>
        <a href="${ADMIN_DASHBOARD_URL}/quote-requests" style="display:inline-block;background:#111;color:#fff;padding:14px 28px;text-decoration:none;font-weight:700;border:2px solid #111">Open quote requests →</a>
      </div>
    </div></body></html>`;
  return { subject, html };
}

// Generic branded admin email for lightweight event notifications.
function generateGenericAdminEmail(
  subjectPrefix: string,
  eyebrow: string,
  heading: string,
  rows: Array<[string, string]>,
  ctaHref: string,
  ctaLabel: string,
): { subject: string; html: string } {
  const subject = `${subjectPrefix} | ${heading}`;
  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:7px 0;color:#666;width:150px">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const html = `<!DOCTYPE html><html><body style="margin:0;font-family:Arial,sans-serif;background:#f4f4f5;padding:24px;color:#111">
    <div style="max-width:640px;margin:0 auto;background:#fff;border:4px solid #111">
      <div style="background:#111;color:#facc15;padding:18px 24px;font-weight:900;letter-spacing:3px;text-transform:uppercase">OCCTA Admin</div>
      <div style="padding:24px">
        <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px;color:#666">${escapeHtml(eyebrow)}</p>
        <h1 style="font-size:22px;margin:0 0 16px">${escapeHtml(heading)}</h1>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">${rowsHtml}</table>
        <a href="${ctaHref}" style="display:inline-block;background:#111;color:#fff;padding:14px 28px;text-decoration:none;font-weight:700;border:2px solid #111">${escapeHtml(ctaLabel)}</a>
      </div>
    </div></body></html>`;
  return { subject, html };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Capture client IP for rate limiting and audit
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip")?.trim() ||
      req.headers.get("cf-connecting-ip")?.trim() ||
      "unknown";

    // Rate limit: 20 admin-notify requests per IP per hour. Internal callers
    // (other edge functions / cron jobs) may bypass by supplying CRON_JOB_SECRET.
    const internalSecret = req.headers.get("x-internal-secret");
    const expectedSecret = Deno.env.get("CRON_JOB_SECRET");
    const isInternal =
      (expectedSecret && internalSecret === expectedSecret) ||
      req.headers.get("x-internal-trigger") === "db";

    if (!isInternal) {
      const { data: allowed } = await supabase.rpc("check_rate_limit", {
        _identifier: ipAddress,
        _action: "admin_notify",
        _max_requests: 5,
        _window_minutes: 60,
      });

      if (allowed === false) {
        console.warn(`[admin-notify] Rate limit exceeded for IP: ${ipAddress}`);
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // SECURITY: For public callers, require the payload to reference a real
      // DB record that was just created by the same flow. This prevents
      // arbitrary attackers from injecting fabricated content into admin
      // notification emails (the record must actually exist in one of the
      // whitelisted tables). Internal callers (edge functions / cron) with the
      // shared secret bypass this check.
      let earlyPayload: NotificationPayload | null = null;
      try {
        earlyPayload = await req.clone().json();
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid JSON body" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = earlyPayload?.type;
      const rid = String((earlyPayload?.data as Record<string, unknown>)?.id ?? "");
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const tableForType: Record<string, string> = {
        new_guest_order: "guest_orders",
        new_order: "orders",
        new_ticket: "support_tickets",
        new_business_enquiry: "guest_orders",
        new_quote_request: "quote_requests",
        customer_proceeded_quote: "quotes",
        human_chat_request: "chat_conversations",
        dd_mandate_submitted: "dd_mandates",
        invoice_paid: "invoices",
        contract_signed: "contract_acceptances",
        order_live: "orders",
      };
      const table = t ? tableForType[t] : undefined;
      if (!table || !uuidRe.test(rid)) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: row } = await supabase.from(table).select("id").eq("id", rid).maybeSingle();
      if (!row) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const payload: NotificationPayload = await req.json();
    const { type, data } = payload;

    // Capture network-level context server-side (more reliable than frontend).
    // Common edge header; varies by provider but harmless if missing.
    const ipCountry =
      req.headers.get("cf-ipcountry")?.trim() ||
      req.headers.get("x-vercel-ip-country")?.trim() ||
      req.headers.get("x-country")?.trim() ||
      "Unknown";

    // Merge server-captured fields into the payload for email rendering.
    const enrichedData: Record<string, unknown> = {
      ...data,
      ip_address: ipAddress,
      ip_country: ipCountry,
    };

    console.log(`[admin-notify] Processing notification type: ${type}`);
    console.log(`[admin-notify] Data:`, JSON.stringify(enrichedData, null, 2));

    if (!type || !data) {
      return new Response(
        JSON.stringify({ error: "Missing type or data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let emailContent: { subject: string; html: string };

    switch (type) {
      case "new_guest_order":
        emailContent = generateOrderEmail(enrichedData, true);
        break;
      case "new_order":
        emailContent = generateOrderEmail(enrichedData, false);
        break;
      case "new_ticket":
        emailContent = generateTicketEmail(enrichedData);
        break;
      case "failed_payment":
        emailContent = generateFailedPaymentEmail(enrichedData);
        break;
      case "customer_proceeded_quote":
        emailContent = generateProceededQuoteEmail(enrichedData);
        break;
      case "new_business_enquiry":
        emailContent = generateBusinessEnquiryEmail(enrichedData);
        break;
      case "human_chat_request":
        {
        // Find the latest message id in this conversation for a jump-to-message deep link.
        let msgId: string | null = null;
        try {
          const convId = String(enrichedData.id || "");
          if (convId) {
            const { data: last } = await supabase
              .from("chat_messages")
              .select("id")
              .eq("conversation_id", convId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            msgId = (last?.id as string) ?? null;
          }
        } catch { /* non-fatal */ }
        const convId = encodeURIComponent(String(enrichedData.id || ""));
        const deep = `${ADMIN_DASHBOARD_URL}/live-chat?c=${convId}${msgId ? `&m=${encodeURIComponent(msgId)}` : ""}`;
        emailContent = generateGenericAdminEmail(
          "🙋 Customer wants a human",
          "Live chat handoff",
          `Conversation ${String(enrichedData.reference || enrichedData.id || "")}`,
          [
            ["Customer", String(enrichedData.customer_name || "Guest visitor")],
            ["Email", String(enrichedData.customer_email || "—")],
            ["Trigger", String(enrichedData.trigger_reason || "requested_human")],
            ["Last message", String(enrichedData.last_message || "—")],
            ["Summary", String(enrichedData.summary || "—")],
          ],
          deep,
          "Jump to conversation →",
        );
        }
        break;
      case "dd_mandate_submitted":
        emailContent = generateGenericAdminEmail(
          "🏦 New Direct Debit mandate",
          "Direct Debit",
          `Mandate ${String(enrichedData.reference || enrichedData.id || "")}`,
          [
            ["Customer", String(enrichedData.customer_name || "—")],
            ["Email", String(enrichedData.customer_email || "—")],
            ["Sort code", String(enrichedData.sort_code_masked || "••-••-••")],
            ["Account", String(enrichedData.account_masked || "••••••••")],
            ["Status", String(enrichedData.status || "pending")],
          ],
          `${ADMIN_DASHBOARD_URL}/payments-dd?highlight=${encodeURIComponent(String(enrichedData.id || ""))}`,
          "Open this mandate →",
        );
        break;
      case "invoice_paid":
        emailContent = generateGenericAdminEmail(
          "✅ Invoice paid",
          "Payments",
          String(enrichedData.reference || enrichedData.invoice_number || "Invoice"),
          [
            ["Customer", String(enrichedData.customer_name || "—")],
            ["Amount", formatCurrency(enrichedData.amount as number)],
            ["Method", String(enrichedData.payment_method || "—")],
            ["Paid at", formatDate(String(enrichedData.paid_at || new Date().toISOString()))],
          ],
          `${ADMIN_DASHBOARD_URL}/billing?invoice=${encodeURIComponent(String(enrichedData.id || enrichedData.invoice_number || ""))}`,
          "Open this invoice →",
        );
        break;
      case "contract_signed":
        emailContent = generateGenericAdminEmail(
          "📝 Contract signed",
          "Contracts",
          String(enrichedData.reference || enrichedData.id || "Contract"),
          [
            ["Customer", String(enrichedData.customer_name || "—")],
            ["Email", String(enrichedData.customer_email || "—")],
            ["Plan", String(enrichedData.plan_name || "—")],
            ["Signed at", formatDate(String(enrichedData.signed_at || new Date().toISOString()))],
          ],
          `${ADMIN_DASHBOARD_URL}/orders?highlight=${encodeURIComponent(String(enrichedData.order_id || enrichedData.id || ""))}`,
          "Open this order →",
        );
        break;
      case "order_live":
        emailContent = generateGenericAdminEmail(
          "🚀 Order is live",
          "Provisioning",
          String(enrichedData.reference || enrichedData.order_number || "Order"),
          [
            ["Customer", String(enrichedData.customer_name || "—")],
            ["Product", String(enrichedData.product_name || enrichedData.service_type || "—")],
            ["Status", String(enrichedData.status || "live")],
            ["Activated", formatDate(String(enrichedData.activated_at || new Date().toISOString()))],
          ],
          `${ADMIN_DASHBOARD_URL}/orders?highlight=${encodeURIComponent(String(enrichedData.id || enrichedData.order_number || ""))}`,
          "Open this order →",
        );
        break;
      case "new_quote_request":
        emailContent = generateQuoteRequestEmail(enrichedData);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unknown notification type: ${type}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`[admin-notify] Sending email to: ${ADMIN_EMAIL}`);
    console.log(`[admin-notify] Subject: ${emailContent.subject}`);

    // Resolve recipients from admin_notification_prefs. Admins can opt out of
    // specific event types; if no explicit prefs exist we fall back to the
    // default ADMIN_EMAIL so nothing is missed.
    let recipients: string[] = [ADMIN_EMAIL];
    try {
      const { data: prefsRows } = await supabase
        .from("admin_notification_prefs")
        .select("user_id, email_enabled")
        .eq("event_type", type)
        .eq("email_enabled", true);
      if (prefsRows && prefsRows.length > 0) {
        const ids = prefsRows.map((r: any) => r.user_id);
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", ids);
        const emails = (profs ?? []).map((p: any) => p.email).filter(Boolean);
        if (emails.length > 0) recipients = Array.from(new Set([...emails, ADMIN_EMAIL]));
      }
    } catch (e) {
      console.warn("[admin-notify] pref lookup failed, using default recipient", e);
    }

    const emailResponse = await resend.emails.send({
      from: `OCCTA <${FROM_EMAIL}>`,
      to: recipients,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    // Log this admin notification event so it can be reviewed / CSV-exported.
    try {
      const sendErr = (emailResponse as any)?.error?.message ?? null;
      const refUrlMatch = /href="([^"]+)"/.exec(emailContent.html || "");
      await supabase.from("admin_notification_events").insert({
        event_type: type,
        subject: emailContent.subject,
        recipients,
        success: !sendErr,
        error_message: sendErr,
        reference_url: refUrlMatch?.[1] ?? null,
        metadata: {
          message_id: (emailResponse as any)?.data?.id ?? null,
          reference: (enrichedData as any)?.reference ?? (enrichedData as any)?.id ?? null,
        },
      });
    } catch (logErr) {
      console.warn("[admin-notify] failed to log notification event", logErr);
    }

    console.log(`[admin-notify] Email sent successfully:`, emailResponse);

    // Handle potential error in response
    if (emailResponse.error) {
      throw new Error(emailResponse.error.message || "Failed to send email");
    }

    return new Response(
      JSON.stringify({ success: true, messageId: emailResponse.data?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[admin-notify] Error:", errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
