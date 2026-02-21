import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// Status-specific email configurations
const STATUS_EMAIL_CONFIG: Record<string, { subject: string; headline: string; message: string; color: string; icon: string }> = {
  pending: {
    subject: "We've received your Direct Debit mandate",
    headline: "Mandate Received",
    message: "Thank you for setting up your Direct Debit with OCCTA. We've received your mandate and are currently reviewing the details. You'll hear from us once it's verified.",
    color: "#facc15",
    icon: "📋",
  },
  verified: {
    subject: "Your Direct Debit mandate has been verified",
    headline: "Mandate Verified",
    message: "Great news! Your Direct Debit mandate has been verified and is being prepared for activation. We'll submit it to our payment provider shortly.",
    color: "#3b82f6",
    icon: "✓",
  },
  submitted_to_provider: {
    subject: "Your Direct Debit has been submitted to our provider",
    headline: "Submitted to Provider",
    message: "Your Direct Debit mandate has been submitted to our payment provider for processing. This typically takes 2-3 working days. We'll notify you once it's active.",
    color: "#8b5cf6",
    icon: "📤",
  },
  active: {
    subject: "Your Direct Debit is now active",
    headline: "Direct Debit Active! 🎉",
    message: "Your Direct Debit mandate is now fully active. Future payments will be collected automatically from your bank account. You'll receive advance notice before each collection.",
    color: "#22c55e",
    icon: "✓",
  },
  failed: {
    subject: "Action required: Direct Debit issue",
    headline: "Action Required",
    message: "We encountered an issue with your Direct Debit mandate. Please log into your dashboard or contact our support team to resolve this and avoid any service disruption.",
    color: "#ef4444",
    icon: "⚠️",
  },
  cancelled: {
    subject: "Your Direct Debit has been cancelled",
    headline: "Direct Debit Cancelled",
    message: "Your Direct Debit mandate has been cancelled. If you didn't request this or have any questions, please contact our support team immediately.",
    color: "#ef4444",
    icon: "✕",
  },
};

// HTML escape helper
const escapeHtml = (unsafe: unknown): string => {
  if (unsafe === null || unsafe === undefined) return "";
  const str = String(unsafe);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Generate branded DD status email HTML
const generateDDStatusEmail = (
  customerName: string,
  status: string,
  mandateRef: string | null,
  bankLast4: string | null,
  accountHolder: string | null
): string => {
  const config = STATUS_EMAIL_CONFIG[status] || STATUS_EMAIL_CONFIG.pending;
  const siteUrl = Deno.env.get("SITE_URL") || "https://www.occta.co.uk";
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(config.subject)} - OCCTA</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700;900&display=swap');
    
    body { margin: 0; padding: 0; background: #f5f4ef; color: #0d0d0d; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; -webkit-font-smoothing: antialiased; }
    .preheader { display: none !important; visibility: hidden; opacity: 0; height: 0; width: 0; max-height: 0; max-width: 0; overflow: hidden; }
    
    .wrapper { background: #f5f4ef; padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border: 4px solid #0d0d0d; box-shadow: 8px 8px 0 0 #0d0d0d; }
    
    .header { background: #0d0d0d; padding: 32px; position: relative; overflow: hidden; }
    .header::before { content: ''; position: absolute; top: 0; right: 0; width: 120px; height: 120px; background: #facc15; transform: translate(30%, -30%) rotate(45deg); }
    .logo { font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: 4px; color: #ffffff; text-transform: uppercase; position: relative; z-index: 1; }
    .tagline { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #facc15; margin-top: 4px; font-weight: 600; }
    
    .title-banner { background: ${config.color}; padding: 16px 32px; border-bottom: 4px solid #0d0d0d; }
    .title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 2px; text-transform: uppercase; margin: 0; color: ${config.color === "#facc15" ? "#0d0d0d" : "#ffffff"}; }
    
    .content { padding: 32px; }
    .greeting { font-size: 18px; font-weight: 700; margin-bottom: 16px; color: #0d0d0d; }
    .text { font-size: 15px; line-height: 1.7; color: #333; margin: 16px 0; }
    
    .dd-card { background: #f5f4ef; border: 3px solid #0d0d0d; margin: 24px 0; }
    .dd-header { background: #0d0d0d; color: #fff; padding: 12px 20px; font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 2px; text-transform: uppercase; }
    .dd-body { padding: 20px; }
    .dd-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px dashed #ccc; }
    .dd-row:last-child { border-bottom: none; }
    .dd-label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #666; font-weight: 600; }
    .dd-value { font-size: 15px; font-weight: 700; text-align: right; }
    
    .status-badge { display: inline-block; background: ${config.color}; color: ${config.color === "#facc15" ? "#0d0d0d" : "#ffffff"}; padding: 4px 12px; font-family: 'Bebas Neue', sans-serif; font-size: 14px; letter-spacing: 1px; text-transform: uppercase; }
    
    .cta-wrap { text-align: center; margin: 32px 0; }
    .cta { display: inline-block; background: #0d0d0d; color: #ffffff; padding: 16px 40px; text-decoration: none; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; text-transform: uppercase; border: 3px solid #0d0d0d; box-shadow: 4px 4px 0 0 #facc15; }
    
    .footer { background: #0d0d0d; padding: 32px; }
    .footer-content { text-align: center; }
    .footer-logo { font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 4px; color: #facc15; }
    .footer-links { margin: 20px 0; }
    .footer-links a { color: #ffffff; text-decoration: none; font-size: 12px; margin: 0 12px; text-transform: uppercase; letter-spacing: 1px; }
  </style>
</head>
<body>
  <div class="preheader">${escapeHtml(config.message.substring(0, 100))}...</div>
  
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo">OCCTA</div>
        <div class="tagline">Telecom • Connected</div>
      </div>
      
      <div class="title-banner">
        <h1 class="title">${config.icon} ${escapeHtml(config.headline)}</h1>
      </div>
      
      <div class="content">
        <p class="greeting">Hi ${escapeHtml(customerName)},</p>
        <p class="text">${escapeHtml(config.message)}</p>
        
        <div class="dd-card">
          <div class="dd-header">Direct Debit Details</div>
          <div class="dd-body">
            <div class="dd-row">
              <span class="dd-label">Status</span>
              <span class="dd-value"><span class="status-badge">${escapeHtml(status.replace(/_/g, " "))}</span></span>
            </div>
            ${mandateRef ? `
            <div class="dd-row">
              <span class="dd-label">Mandate Reference</span>
              <span class="dd-value" style="font-family: monospace;">${escapeHtml(mandateRef)}</span>
            </div>
            ` : ""}
            ${accountHolder ? `
            <div class="dd-row">
              <span class="dd-label">Account Holder</span>
              <span class="dd-value">${escapeHtml(accountHolder)}</span>
            </div>
            ` : ""}
            ${bankLast4 ? `
            <div class="dd-row">
              <span class="dd-label">Bank Account</span>
              <span class="dd-value">****${escapeHtml(bankLast4)}</span>
            </div>
            ` : ""}
          </div>
        </div>
        
        <div class="cta-wrap">
          <a href="${siteUrl}/dashboard" class="cta">View Your Dashboard →</a>
        </div>
        
        <p class="text" style="text-align: center; color: #666; font-size: 13px;">
          Questions? Contact our UK-based support team at <a href="mailto:hello@occta.co.uk" style="color: #0d0d0d;">hello@occta.co.uk</a> or call <strong>0800 260 6626</strong>.
        </p>
      </div>
      
      <div class="footer">
        <div class="footer-content">
          <div class="footer-logo">OCCTA</div>
          <div class="footer-links">
            <a href="${siteUrl}/support">Support</a>
            <a href="${siteUrl}/dashboard">Dashboard</a>
            <a href="${siteUrl}/privacy-policy">Privacy</a>
          </div>
          <p style="color: #666; font-size: 10px; margin: 16px 0 0 0;">
            © ${currentYear} OCCTA Limited. Company No. 13828933.<br>
            22 Pavilion View, Huddersfield, HD3 3WU
          </p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "OCCTA <noreply@occta.co.uk>";

  const supabase = createClient(supabaseUrl, supabaseKey);
  const resend = new Resend(resendApiKey);

  try {
    const body = await req.json();
    console.log("DD Status Notify received:", JSON.stringify(body));

    const { mandateId, newStatus, oldStatus, userId } = body;

    if (!mandateId || !newStatus) {
      console.error("Missing required fields:", { mandateId, newStatus });
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip if status hasn't changed
    if (newStatus === oldStatus) {
      console.log("Status unchanged, skipping notification");
      return new Response(JSON.stringify({ skipped: true, reason: "Status unchanged" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch mandate details
    const { data: mandate, error: mandateError } = await supabase
      .from("dd_mandates")
      .select("*")
      .eq("id", mandateId)
      .single();

    if (mandateError || !mandate) {
      console.error("Failed to fetch mandate:", mandateError);
      return new Response(JSON.stringify({ error: "Mandate not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch customer profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name, account_number")
      .eq("id", mandate.user_id)
      .single();

    if (profileError || !profile || !profile.email) {
      console.error("Failed to fetch profile or no email:", profileError);
      return new Response(JSON.stringify({ error: "Customer email not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = STATUS_EMAIL_CONFIG[newStatus];
    if (!config) {
      console.log("No email config for status:", newStatus);
      return new Response(JSON.stringify({ skipped: true, reason: `No email template for status: ${newStatus}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for duplicate in communications_log (same mandate + template within 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const templateName = `dd_status_${newStatus}`;

    const { data: existingLog } = await supabase
      .from("communications_log")
      .select("id")
      .eq("user_id", mandate.user_id)
      .eq("template_name", templateName)
      .gte("created_at", oneHourAgo)
      .limit(1);

    if (existingLog && existingLog.length > 0) {
      console.log("Duplicate email prevented for template:", templateName);
      return new Response(JSON.stringify({ skipped: true, reason: "Duplicate prevented" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate email HTML
    const emailHtml = generateDDStatusEmail(
      profile.full_name || "Valued Customer",
      newStatus,
      mandate.mandate_reference,
      mandate.bank_last4,
      mandate.account_holder
    );

    // Send email via Resend
    let emailStatus = "pending";
    let providerMessageId: string | null = null;
    let errorMessage: string | null = null;

    try {
      const emailResult = await resend.emails.send({
        from: fromEmail,
        to: [profile.email],
        subject: config.subject,
        html: emailHtml,
      });

      if (emailResult.error) {
        throw new Error(emailResult.error.message);
      }

      providerMessageId = emailResult.data?.id || null;
      emailStatus = "sent";
      console.log("DD status email sent successfully:", providerMessageId);
    } catch (emailError) {
      errorMessage = emailError instanceof Error ? emailError.message : "Unknown error";
      emailStatus = "failed";
      console.error("Failed to send DD status email:", errorMessage);
    }

    // Log to communications_log
    const { error: logError } = await supabase.from("communications_log").insert({
      user_id: mandate.user_id,
      recipient_email: profile.email,
      template_name: templateName,
      status: emailStatus,
      sent_at: emailStatus === "sent" ? new Date().toISOString() : null,
      provider_message_id: providerMessageId,
      error_message: errorMessage,
      metadata: {
        mandate_id: mandateId,
        mandate_reference: mandate.mandate_reference,
        old_status: oldStatus,
        new_status: newStatus,
        account_number: profile.account_number,
      },
    });

    if (logError) {
      console.error("Failed to log communication:", logError);
    }

    return new Response(
      JSON.stringify({
        success: emailStatus === "sent",
        emailStatus,
        providerMessageId,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("DD Status Notify error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
