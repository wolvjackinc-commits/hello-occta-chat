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

function generateOrderEmail(data: Record<string, unknown>, isGuest: boolean): { subject: string; html: string } {
  const orderNumber = data.order_number || data.orderNumber || "N/A";
  const customerName = data.customer_name || data.full_name || "Unknown";
  const customerEmail = data.customer_email || data.email || "N/A";
  const planName = data.plan_name || "N/A";
  const planPrice = data.plan_price ? `£${Number(data.plan_price).toFixed(2)}` : "N/A";
  const address = data.address_line1 || "N/A";
  const city = data.city || "";
  const postcode = data.postcode || "";
  const fullAddress = [address, city, postcode].filter(Boolean).join(", ");

  const subject = `🆕 New ${isGuest ? "Guest " : ""}Order Received | #${orderNumber}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #0066FF; padding: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🆕 New ${isGuest ? "Guest " : ""}Order Received</h1>
      </div>
      
      <div style="padding: 24px; background: #f8f9fa; border: 2px solid #1a1a1a;">
        <p style="margin-top: 0;">Hi Team,</p>
        <p>A new ${isGuest ? "guest " : ""}order has been placed and requires attention:</p>
        
        <div style="background: white; border: 2px solid #1a1a1a; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; width: 35%;">Order Number:</td>
              <td style="padding: 8px 0; font-weight: bold;">#${orderNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Customer:</td>
              <td style="padding: 8px 0; font-weight: bold;">${customerName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Email:</td>
              <td style="padding: 8px 0;"><a href="mailto:${customerEmail}" style="color: #0066FF;">${customerEmail}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Plan:</td>
              <td style="padding: 8px 0; font-weight: bold;">${planName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Monthly Price:</td>
              <td style="padding: 8px 0; font-weight: bold;">${planPrice}/mo</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Address:</td>
              <td style="padding: 8px 0;">${fullAddress}</td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center; margin: 24px 0;">
          <a href="${ADMIN_DASHBOARD_URL}/orders" 
             style="display: inline-block; background: #0066FF; color: white; padding: 14px 28px; text-decoration: none; font-weight: bold; border: 2px solid #1a1a1a;">
            View Order in Dashboard →
          </a>
        </div>
      </div>
      
      <div style="padding: 16px; text-align: center; color: #666; font-size: 12px;">
        <p style="margin: 0;">OCCTA Admin Notifications</p>
        <p style="margin: 4px 0 0;">This is an automated message from your admin system.</p>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

function generateTicketEmail(data: Record<string, unknown>): { subject: string; html: string } {
  const ticketSubject = data.subject || "No subject";
  const category = data.category || "General";
  const priority = data.priority || "medium";
  const customerName = data.customer_name || "Unknown";
  const customerEmail = data.customer_email || "N/A";
  const description = data.description || "No description provided";

  const priorityColors: Record<string, string> = {
    low: "#22c55e",
    medium: "#eab308",
    high: "#f97316",
    urgent: "#ef4444",
  };
  const priorityColor = priorityColors[String(priority)] || "#eab308";

  const subject = `🎫 New Support Ticket | ${ticketSubject}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #FF5500; padding: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🎫 New Support Ticket</h1>
      </div>
      
      <div style="padding: 24px; background: #f8f9fa; border: 2px solid #1a1a1a;">
        <p style="margin-top: 0;">Hi Team,</p>
        <p>A new support ticket has been submitted and requires attention:</p>
        
        <div style="background: white; border: 2px solid #1a1a1a; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; width: 35%;">Subject:</td>
              <td style="padding: 8px 0; font-weight: bold;">${ticketSubject}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Category:</td>
              <td style="padding: 8px 0;">${String(category).charAt(0).toUpperCase() + String(category).slice(1)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Priority:</td>
              <td style="padding: 8px 0;">
                <span style="background: ${priorityColor}; color: white; padding: 4px 12px; font-size: 12px; font-weight: bold; text-transform: uppercase;">
                  ${priority}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Customer:</td>
              <td style="padding: 8px 0; font-weight: bold;">${customerName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Email:</td>
              <td style="padding: 8px 0;"><a href="mailto:${customerEmail}" style="color: #0066FF;">${customerEmail}</a></td>
            </tr>
          </table>
          
          <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee;">
            <p style="color: #666; margin: 0 0 8px;">Description:</p>
            <p style="margin: 0; white-space: pre-wrap;">${description}</p>
          </div>
        </div>
        
        <div style="text-align: center; margin: 24px 0;">
          <a href="${ADMIN_DASHBOARD_URL}/tickets" 
             style="display: inline-block; background: #FF5500; color: white; padding: 14px 28px; text-decoration: none; font-weight: bold; border: 2px solid #1a1a1a;">
            View Ticket in Dashboard →
          </a>
        </div>
      </div>
      
      <div style="padding: 16px; text-align: center; color: #666; font-size: 12px;">
        <p style="margin: 0;">OCCTA Admin Notifications</p>
        <p style="margin: 4px 0 0;">This is an automated message from your admin system.</p>
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

    console.log(`[admin-notify] Processing notification type: ${type}`);
    console.log(`[admin-notify] Data:`, JSON.stringify(data, null, 2));

    if (!type || !data) {
      return new Response(
        JSON.stringify({ error: "Missing type or data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let emailContent: { subject: string; html: string };

    switch (type) {
      case "new_guest_order":
        emailContent = generateOrderEmail(data, true);
        break;
      case "new_order":
        emailContent = generateOrderEmail(data, false);
        break;
      case "new_ticket":
        emailContent = generateTicketEmail(data);
        break;
      case "failed_payment":
        // Placeholder for future implementation
        emailContent = {
          subject: "⚠️ Failed Payment Alert",
          html: `<p>A payment has failed. Check the admin dashboard for details.</p>`,
        };
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
