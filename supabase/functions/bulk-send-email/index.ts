import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = new Resend(resendApiKey);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "OCCTA <hello@occta.co.uk>";
const SITE_URL = Deno.env.get("SITE_URL") || "https://www.occta.co.uk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Company config constants (replicated to avoid import issues)
const COMPANY_CONFIG = {
  name: "OCCTA Limited",
  tradingName: "OCCTA",
  supportEmail: "support@occta.co.uk",
  supportPhone: "0800 260 6626",
  generalEmail: "hello@occta.co.uk",
  address: "22 Pavilion View, Huddersfield, HD3 3WU",
  companyNumber: "13828933",
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

// Render template variables
const renderTemplate = (
  template: string,
  variables: Record<string, string>
): string => {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key];
    return value !== undefined ? escapeHtml(value) : match;
  });
};

// Extract first and last name from full name
const parseFullName = (fullName: string | null): { firstName: string; lastName: string } => {
  if (!fullName) return { firstName: "Customer", lastName: "" };
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] || "Customer",
    lastName: parts.slice(1).join(" ") || "",
  };
};

// Build variables object for a recipient
const buildVariables = (
  profile: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
    account_number: string | null;
  },
  trackingPixelUrl: string
): Record<string, string> => {
  const { firstName, lastName } = parseFullName(profile.full_name);
  return {
    first_name: firstName,
    last_name: lastName,
    full_name: profile.full_name || "Customer",
    account_number: profile.account_number || "",
    email: profile.email || "",
    phone: profile.phone || "",
    support_email: COMPANY_CONFIG.supportEmail,
    support_phone: COMPANY_CONFIG.supportPhone,
    company_name: COMPANY_CONFIG.name,
    tracking_pixel: `<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`,
  };
};

// Get email wrapper HTML
const getEmailWrapper = (content: string, trackingPixel: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>OCCTA</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700&display=swap');
    body { margin: 0; padding: 0; background: #f5f4ef; color: #0d0d0d; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; -webkit-font-smoothing: antialiased; }
    .wrapper { background: #f5f4ef; padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border: 4px solid #0d0d0d; box-shadow: 8px 8px 0 0 #0d0d0d; }
    .header { background: #0d0d0d; padding: 32px; position: relative; overflow: hidden; }
    .header::before { content: ''; position: absolute; top: 0; right: 0; width: 120px; height: 120px; background: #facc15; transform: translate(30%, -30%) rotate(45deg); }
    .logo { font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: 4px; color: #ffffff; text-transform: uppercase; position: relative; z-index: 1; }
    .tagline { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #facc15; margin-top: 4px; font-weight: 600; }
    .content { padding: 32px; font-size: 15px; line-height: 1.7; color: #333; }
    .content p { margin: 16px 0; }
    .footer { background: #0d0d0d; padding: 32px; text-align: center; }
    .footer-logo { font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 4px; color: #facc15; }
    .footer-links { margin: 20px 0; }
    .footer-links a { color: #ffffff; text-decoration: none; font-size: 12px; margin: 0 12px; text-transform: uppercase; letter-spacing: 1px; }
    .footer-contact { margin: 24px 0; padding-top: 20px; border-top: 1px solid #333; }
    .footer-contact p { color: #888; font-size: 12px; margin: 0 0 8px 0; line-height: 1.6; }
    .footer-contact a { color: #facc15; text-decoration: none; }
    .footer-legal { margin-top: 24px; padding-top: 16px; border-top: 1px solid #333; }
    .footer-legal p { color: #666; font-size: 10px; margin: 0 0 6px 0; line-height: 1.6; }
    .footer-legal .small { color: #555; font-size: 9px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo">OCCTA</div>
        <div class="tagline">Telecom • Connected</div>
      </div>
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        <div class="footer-logo">OCCTA</div>
        <div class="footer-links">
          <a href="${SITE_URL}/support">Support</a>
          <a href="${SITE_URL}/dashboard">Dashboard</a>
          <a href="${SITE_URL}/privacy-policy">Privacy Policy</a>
        </div>
        <div class="footer-contact">
          <p>Need help? Call <strong style="color: #fff;">${COMPANY_CONFIG.supportPhone}</strong> or email <a href="mailto:${COMPANY_CONFIG.generalEmail}">${COMPANY_CONFIG.generalEmail}</a></p>
          <p style="color: #666; font-size: 11px;">Lines open Monday–Friday 9am–6pm, Saturday 9am–1pm</p>
        </div>
        <div class="footer-legal">
          <p>© ${new Date().getFullYear()} ${COMPANY_CONFIG.name}. All rights reserved.</p>
          <p class="small">${COMPANY_CONFIG.name} is a company registered in England and Wales (Company No. ${COMPANY_CONFIG.companyNumber}).<br>Registered office: ${COMPANY_CONFIG.address}, United Kingdom</p>
        </div>
      </div>
    </div>
  </div>
  ${trackingPixel}
</body>
</html>
`;

interface BulkSendRequest {
  template_id: string;
  campaign_name: string;
  recipient_user_ids?: string[];
  filter?: { all?: boolean; status?: string };
}

const handler = async (req: Request): Promise<Response> => {
  console.log("bulk-send-email: Request received");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the user is an admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      console.error("bulk-send-email: Auth error", authError);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      console.error("bulk-send-email: Not an admin", roleError);
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: BulkSendRequest = await req.json();
    console.log("bulk-send-email: Processing request", { 
      template_id: body.template_id, 
      campaign_name: body.campaign_name,
      recipientCount: body.recipient_user_ids?.length || "filter mode"
    });

    // Fetch template
    const { data: template, error: templateError } = await supabaseClient
      .from("email_templates")
      .select("*")
      .eq("id", body.template_id)
      .eq("is_active", true)
      .single();

    if (templateError || !template) {
      console.error("bulk-send-email: Template not found", templateError);
      return new Response(JSON.stringify({ error: "Template not found or inactive" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch recipients
    let recipientQuery = supabaseClient
      .from("profiles")
      .select("id, full_name, email, phone, account_number");

    if (body.recipient_user_ids && body.recipient_user_ids.length > 0) {
      recipientQuery = recipientQuery.in("id", body.recipient_user_ids);
    } else if (body.filter?.status) {
      // Filter by service status - get users with services in that status
      const { data: serviceUsers } = await supabaseClient
        .from("services")
        .select("user_id")
        .eq("status", body.filter.status);
      
      const userIds = [...new Set(serviceUsers?.map(s => s.user_id) || [])];
      if (userIds.length > 0) {
        recipientQuery = recipientQuery.in("id", userIds);
      } else {
        return new Response(JSON.stringify({ error: "No recipients match filter" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    // If filter.all is true, we get all profiles (no additional filter)

    const { data: recipients, error: recipientsError } = await recipientQuery;

    if (recipientsError || !recipients || recipients.length === 0) {
      console.error("bulk-send-email: No recipients found", recipientsError);
      return new Response(JSON.stringify({ error: "No recipients found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter out recipients without email
    const validRecipients = recipients.filter(r => r.email);
    console.log(`bulk-send-email: Found ${validRecipients.length} valid recipients`);

    // Create campaign record
    const { data: campaign, error: campaignError } = await supabaseClient
      .from("campaigns")
      .insert({
        campaign_name: body.campaign_name,
        template_id: body.template_id,
        status: "sending",
        total_recipients: validRecipients.length,
        sent_count: 0,
        failed_count: 0,
        created_by: user.id,
        started_at: new Date().toISOString(),
        recipient_filter: body.filter || { user_ids: body.recipient_user_ids },
      })
      .select()
      .single();

    if (campaignError || !campaign) {
      console.error("bulk-send-email: Failed to create campaign", campaignError);
      return new Response(JSON.stringify({ error: "Failed to create campaign" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`bulk-send-email: Created campaign ${campaign.id}`);

    // Process recipients in batches
    const BATCH_SIZE = 50;
    let sentCount = 0;
    let failedCount = 0;
    let deliveredCount = 0;

    for (let i = 0; i < validRecipients.length; i += BATCH_SIZE) {
      const batch = validRecipients.slice(i, i + BATCH_SIZE);
      console.log(`bulk-send-email: Processing batch ${Math.floor(i / BATCH_SIZE) + 1}`);

      const batchPromises = batch.map(async (recipient) => {
        try {
          // Create campaign recipient record first (queued status)
          const { data: campaignRecipient, error: recipientError } = await supabaseClient
            .from("campaign_recipients")
            .insert({
              campaign_id: campaign.id,
              user_id: recipient.id,
              email: recipient.email!,
              full_name: recipient.full_name,
              account_number: recipient.account_number,
              status: "queued",
              queued_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (recipientError || !campaignRecipient) {
            console.error(`bulk-send-email: Failed to create recipient record for ${recipient.email}`, recipientError);
            throw new Error("Failed to create recipient record");
          }

          // Build tracking pixel URL using the campaign_recipient id
          const trackingUrl = `${SUPABASE_URL}/functions/v1/email-open-track?id=${campaignRecipient.id}`;
          
          // Build variables and render template
          const variables = buildVariables(recipient, trackingUrl);
          const renderedSubject = renderTemplate(template.subject, variables);
          const renderedBody = renderTemplate(template.html_body, variables);
          const trackingPixel = variables.tracking_pixel;
          
          // Wrap in email template
          const fullHtml = getEmailWrapper(renderedBody, trackingPixel);

          // Send email via Resend
          const emailResponse = await resend.emails.send({
            from: FROM_EMAIL,
            to: [recipient.email!],
            subject: renderedSubject,
            html: fullHtml,
            text: template.text_body ? renderTemplate(template.text_body, variables) : undefined,
          });

          console.log(`bulk-send-email: Sent to ${recipient.email}`, emailResponse);

          // Update recipient record to sent
          await supabaseClient
            .from("campaign_recipients")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              provider_message_id: (emailResponse as any).id || null,
            })
            .eq("id", campaignRecipient.id);

          return { success: true, email: recipient.email };
        } catch (error: any) {
          console.error(`bulk-send-email: Failed to send to ${recipient.email}`, error);

          // Update recipient record to failed
          await supabaseClient
            .from("campaign_recipients")
            .update({
              status: "failed",
              failed_at: new Date().toISOString(),
              error_message: error.message || "Unknown error",
            })
            .eq("campaign_id", campaign.id)
            .eq("email", recipient.email!);

          return { success: false, email: recipient.email, error: error.message };
        }
      });

      const results = await Promise.all(batchPromises);
      sentCount += results.filter(r => r.success).length;
      failedCount += results.filter(r => !r.success).length;

      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < validRecipients.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Update campaign with final counts
    const finalStatus = failedCount === validRecipients.length ? "failed" : "completed";
    await supabaseClient
      .from("campaigns")
      .update({
        status: finalStatus,
        sent_count: sentCount,
        failed_count: failedCount,
        delivered_count: deliveredCount,
        completed_at: new Date().toISOString(),
      })
      .eq("id", campaign.id);

    console.log(`bulk-send-email: Campaign ${campaign.id} completed. Sent: ${sentCount}, Failed: ${failedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        campaign_id: campaign.id,
        total: validRecipients.length,
        sent: sentCount,
        failed: failedCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("bulk-send-email: Unexpected error", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
