import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const ADMIN_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "hello@occta.co.uk";
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@occta.co.uk";
const ADMIN_DASHBOARD_URL = "https://www.occta.co.uk/admin";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotificationPayload {
  type: "new_guest_order" | "new_order" | "new_ticket" | "failed_payment";
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

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: NotificationPayload = await req.json();
    const { type, data } = payload;

    // Capture network-level context server-side (more reliable than frontend).
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip")?.trim() ||
      "Not captured";

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
      default:
        return new Response(
          JSON.stringify({ error: `Unknown notification type: ${type}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`[admin-notify] Sending email to: ${ADMIN_EMAIL}`);
    console.log(`[admin-notify] Subject: ${emailContent.subject}`);

    const emailResponse = await resend.emails.send({
      from: `OCCTA Admin <${FROM_EMAIL}>`,
      to: [ADMIN_EMAIL],
      subject: emailContent.subject,
      html: emailContent.html,
    });

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
