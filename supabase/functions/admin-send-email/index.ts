import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = new Resend(resendApiKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdminEmailRequest {
  to: string;
  subject: string;
  greeting: string;
  html_body: string;
  title?: string;
  userId?: string;
  logToCommunications?: boolean;
  adminSecret?: string; // Secret key for validation
}

// HTML escape helper
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
  
  .title-banner { background: #facc15; padding: 16px 32px; border-bottom: 4px solid #0d0d0d; }
  .title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 2px; text-transform: uppercase; margin: 0; color: #0d0d0d; }
  
  .custom-content { font-size: 15px; line-height: 1.7; color: #333; }
  .custom-content p { margin: 16px 0; }
  .custom-content ul, .custom-content ol { margin: 16px 0; padding-left: 24px; }
  .custom-content li { margin: 8px 0; }
  .custom-content hr { border: none; border-top: 2px dashed #ccc; margin: 24px 0; }
  .custom-content strong { font-weight: 700; }
  .custom-content code { background: #f5f4ef; padding: 2px 6px; font-family: monospace; }
  .custom-content a { color: #0d0d0d; text-decoration: underline; }
`;

const getStandardFooter = () => {
  const siteUrl = Deno.env.get("SITE_URL") || "https://occta.co.uk";
  const accentColor = '#facc15';
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
            Need help? Call <strong style="color: #fff;">0800 260 6626</strong> or email <a href="mailto:hello@occta.co.uk" style="color: ${accentColor}; text-decoration: none;">hello@occta.co.uk</a>
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
      </div>
    </div>`;
};

const getAdminEmailHtml = (data: AdminEmailRequest) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(data.subject)}</title>
  <style>
    ${getCommonStyles()}
  </style>
</head>
<body>
  <div class="preheader">${escapeHtml(data.subject)}</div>
  
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo">OCCTA</div>
        <div class="tagline">Telecom • Connected</div>
      </div>
      
      ${data.title ? `
      <div class="title-banner">
        <h1 class="title">${escapeHtml(data.title)}</h1>
      </div>
      ` : ''}
      
      <div class="content">
        <p class="greeting">${escapeHtml(data.greeting)},</p>
        
        <div class="custom-content">
          ${data.html_body}
        </div>
      </div>
      
      ${getStandardFooter()}
    </div>
  </div>
</body>
</html>`;
};

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Admin send-email function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: AdminEmailRequest = await req.json();
    const { to, subject, greeting, html_body, title, userId, logToCommunications, adminSecret } = requestData;

    // Validate admin secret (simple shared secret validation)
    const expectedSecret = Deno.env.get("ADMIN_EMAIL_SECRET");
    if (!expectedSecret || adminSecret !== expectedSecret) {
      console.error("Invalid admin secret");
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid admin secret" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

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

    if (!subject || !greeting || !html_body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: subject, greeting, html_body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Generate HTML
    const html = getAdminEmailHtml(requestData);

    // Send email
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@occta.co.uk";
    
    const emailResponse = await resend.emails.send({
      from: `OCCTA Accounts <${fromEmail}>`,
      to: [to],
      subject,
      html,
    });

    console.log(`Admin email sent successfully to ${to}`);

    // Log to communications_log if requested
    if (logToCommunications && userId) {
      try {
        await supabaseAdmin.from("communications_log").insert({
          user_id: userId,
          template_name: "custom_admin",
          recipient_email: to,
          status: "sent",
          provider_message_id: (emailResponse as { id?: string })?.id || null,
          sent_at: new Date().toISOString(),
          metadata: { subject, title: title || null },
        });
        console.log("Logged to communications_log for user:", userId);
      } catch (logErr) {
        console.error("Failed to log to communications_log:", logErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error) {
    console.error("Error in admin send-email function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
