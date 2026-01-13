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
    | "password_reset";
  to: string;
  data: Record<string, unknown>;
  // For guest order confirmations - order verification data
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

const getOrderConfirmationHtml = (data: Record<string, unknown>) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 0; background: #f6f4ef; color: #0f172a; }
    .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; }
    .container { max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #0f172a; }
    .brand { background: #0f172a; color: #ffffff; padding: 24px 28px; }
    .brand span { display: block; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #f59e0b; }
    .brand h1 { margin: 8px 0 0; font-size: 24px; letter-spacing: 1px; text-transform: uppercase; }
    .content { padding: 32px 28px; font-size: 16px; line-height: 1.6; }
    .card { background: #f8fafc; border: 2px solid #0f172a; padding: 20px; margin: 20px 0; }
    .order-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; gap: 16px; }
    .order-row:last-child { border-bottom: none; }
    .label { color: #475569; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
    .value { font-weight: 600; text-align: right; }
    .cta { display: block; background: #0f172a; color: #ffffff; text-align: center; padding: 14px 16px; text-decoration: none; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0; }
    .footer { background: #0f172a; padding: 20px 24px; text-align: center; color: #e2e8f0; font-size: 12px; }
  </style>
</head>
<body>
  <div class="preheader">Your OCCTA order is confirmed. Track status and next steps inside.</div>
  <div class="container">
    <div class="brand">
      <span>OCCTA Telecom</span>
      <h1>Order Confirmed</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${escapeHtml(data.full_name)}</strong>,</p>
      <p>Thanks for choosing OCCTA. We’ve received your order and we’re already getting things ready for you.</p>
      
      <div class="card">
        <div class="order-row">
          <span class="label">Order Number:</span>
          <span class="value">${escapeHtml(data.order_number)}</span>
        </div>
        <div class="order-row">
          <span class="label">Service:</span>
          <span class="value">${escapeHtml(data.service_type)}</span>
        </div>
        <div class="order-row">
          <span class="label">Plan:</span>
          <span class="value">${escapeHtml(data.plan_name)}</span>
        </div>
        <div class="order-row">
          <span class="label">Monthly Price:</span>
          <span class="value">£${sanitizeNumber(data.plan_price)}/mo</span>
        </div>
        <div class="order-row">
          <span class="label">Installation Address:</span>
          <span class="value">${escapeHtml(data.address_line1)}, ${escapeHtml(data.city)}, ${escapeHtml(data.postcode)}</span>
        </div>
      </div>
      
      <p><strong>What happens next</strong></p>
      <ol>
        <li>Our team will review your order within 24 hours</li>
        <li>We'll contact you to confirm your preferred installation date</li>
        <li>A technician will arrive on the scheduled date to set everything up</li>
      </ol>
      
      <a href="${Deno.env.get("SITE_URL") || "https://example.com"}/track-order" class="cta">Track Your Order</a>
      
      <p style="text-align: center; color: #666; font-size: 14px;">
        Use your order number <strong>${escapeHtml(data.order_number)}</strong> and email to track your order anytime.
      </p>
      
      <p>If you have any questions, our support team is here to help.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} OCCTA Telecom. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

const getWelcomeHtml = (data: Record<string, unknown>) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 0; background: #f6f4ef; color: #0f172a; }
    .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; }
    .container { max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #0f172a; }
    .brand { background: #0f172a; color: #ffffff; padding: 24px 28px; }
    .brand span { display: block; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #f59e0b; }
    .brand h1 { margin: 8px 0 0; font-size: 24px; letter-spacing: 1px; text-transform: uppercase; }
    .content { padding: 32px 28px; font-size: 16px; line-height: 1.6; }
    .cta { display: block; background: #0f172a; color: #ffffff; text-align: center; padding: 14px 16px; text-decoration: none; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0; }
    .footer { background: #0f172a; padding: 20px 24px; text-align: center; color: #e2e8f0; font-size: 12px; }
  </style>
</head>
<body>
  <div class="preheader">Welcome to OCCTA. Your account is ready.</div>
  <div class="container">
    <div class="brand">
      <span>OCCTA Telecom</span>
      <h1>Welcome</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${escapeHtml(data.full_name) || "there"}</strong>,</p>
      <p>Welcome to OCCTA! Your account has been created successfully.</p>
      
      <p>With your account, you can:</p>
      <ul>
        <li>Track your order status in real-time</li>
        <li>Manage your services and add-ons</li>
        <li>View and pay bills online</li>
        <li>Get priority customer support</li>
      </ul>
      
      <a href="${Deno.env.get("SITE_URL") || "https://example.com"}/dashboard" class="cta">Go to Your Dashboard</a>
      
      <p>If you have any questions, we're here to help!</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} OCCTA Telecom. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

const getStatusUpdateHtml = (data: Record<string, unknown>) => {
  const statusMessages: Record<string, string> = {
    pending: "We've received your order and it's being reviewed.",
    processing: "We're processing your order and preparing everything for installation.",
    dispatched: "Your equipment has been dispatched and is on its way!",
    installed: "Great news! Your service has been installed. Welcome aboard!",
    active: "Your service is now fully active. Enjoy!",
    cancelled: "Your order has been cancelled. If you didn't request this, please contact support.",
  };

  const safeStatus = escapeHtml(data.status);
  const statusMessage = statusMessages[data.status as string] || "Your order status has been updated.";
  const siteUrl = Deno.env.get("SITE_URL") || "https://example.com";

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 0; background: #f6f4ef; color: #0f172a; }
    .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; }
    .container { max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #0f172a; }
    .brand { background: #0f172a; color: #ffffff; padding: 24px 28px; }
    .brand span { display: block; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #f59e0b; }
    .brand h1 { margin: 8px 0 0; font-size: 24px; letter-spacing: 1px; text-transform: uppercase; }
    .content { padding: 32px 28px; font-size: 16px; line-height: 1.6; }
    .status-badge { display: inline-block; background: #0f172a; color: #ffffff; padding: 8px 16px; text-transform: uppercase; font-weight: 700; margin: 16px 0; letter-spacing: 1px; }
    .card { background: #f8fafc; border: 2px solid #0f172a; padding: 20px; margin: 20px 0; }
    .cta { display: block; background: #0f172a; color: #ffffff; text-align: center; padding: 14px 16px; text-decoration: none; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0; }
    .cta-secondary { display: block; background: #ffffff; color: #0f172a; text-align: center; padding: 14px 16px; text-decoration: none; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 12px 0; border: 2px solid #0f172a; }
    .footer { background: #0f172a; padding: 20px 24px; text-align: center; color: #e2e8f0; font-size: 12px; }
  </style>
</head>
<body>
  <div class="preheader">An update on your OCCTA order is ready.</div>
  <div class="container">
    <div class="brand">
      <span>OCCTA Telecom</span>
      <h1>Order Update</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${escapeHtml(data.full_name)}</strong>,</p>
      
      <p>Your order <strong>${escapeHtml(data.order_number)}</strong> has been updated:</p>
      
      <span class="status-badge">${safeStatus}</span>
      
      <p>${statusMessage}</p>
      
      <div class="card">
        <p><strong>Plan:</strong> ${escapeHtml(data.plan_name)}</p>
        <p><strong>Service:</strong> ${escapeHtml(data.service_type)}</p>
      </div>
      
      <a href="${siteUrl}/track-order" class="cta">Track Your Order</a>
      <a href="${siteUrl}/auth" class="cta-secondary">Create Account for More Features</a>
      
      <p>Questions? Our support team is always here to help.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} OCCTA Telecom. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;
};

const getOrderMessageHtml = (data: Record<string, unknown>) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 0; background: #f6f4ef; color: #0f172a; }
    .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; }
    .container { max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #0f172a; }
    .brand { background: #0f172a; color: #ffffff; padding: 24px 28px; }
    .brand span { display: block; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #f59e0b; }
    .brand h1 { margin: 8px 0 0; font-size: 24px; letter-spacing: 1px; text-transform: uppercase; }
    .content { padding: 32px 28px; font-size: 16px; line-height: 1.6; }
    .message-box { background: #f8fafc; border: 2px solid #0f172a; padding: 20px; margin: 20px 0; }
    .cta { display: block; background: #0f172a; color: #ffffff; text-align: center; padding: 14px 16px; text-decoration: none; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0; }
    .footer { background: #0f172a; padding: 20px 24px; text-align: center; color: #e2e8f0; font-size: 12px; }
  </style>
</head>
<body>
  <div class="preheader">A message about your OCCTA order is waiting.</div>
  <div class="container">
    <div class="brand">
      <span>OCCTA Telecom</span>
      <h1>Order Message</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${escapeHtml(data.full_name)}</strong>,</p>
      
      <p>We have a message regarding your order <strong>${escapeHtml(data.order_number)}</strong>:</p>
      
      <div class="message-box">
        <p>${escapeHtml(data.message)}</p>
      </div>
      
      <p>If you have any questions or need to respond, please log in to your account or contact our support team.</p>
      
      <a href="${Deno.env.get("SITE_URL") || "https://example.com"}/dashboard" class="cta">View Your Order</a>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} OCCTA Telecom. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

const getTicketReplyHtml = (data: Record<string, unknown>) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 0; background: #f6f4ef; color: #0f172a; }
    .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; }
    .container { max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #0f172a; }
    .brand { background: #0f172a; color: #ffffff; padding: 24px 28px; }
    .brand span { display: block; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #f59e0b; }
    .brand h1 { margin: 8px 0 0; font-size: 24px; letter-spacing: 1px; text-transform: uppercase; }
    .content { padding: 32px 28px; font-size: 16px; line-height: 1.6; }
    .ticket-subject { background: #f8fafc; border-left: 4px solid #0f172a; padding: 12px 16px; margin: 16px 0; font-weight: 600; }
    .message-box { background: #f8fafc; border: 2px solid #0f172a; padding: 20px; margin: 20px 0; }
    .cta { display: block; background: #0f172a; color: #ffffff; text-align: center; padding: 14px 16px; text-decoration: none; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0; }
    .footer { background: #0f172a; padding: 20px 24px; text-align: center; color: #e2e8f0; font-size: 12px; }
  </style>
</head>
<body>
  <div class="preheader">Your OCCTA support ticket has a new reply.</div>
  <div class="container">
    <div class="brand">
      <span>OCCTA Telecom</span>
      <h1>Support Reply</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${escapeHtml(data.full_name)}</strong>,</p>
      
      <p>Our support team has replied to your ticket:</p>
      
      <div class="ticket-subject">
        RE: ${escapeHtml(data.ticket_subject)}
      </div>
      
      <div class="message-box">
        <p>${escapeHtml(data.message)}</p>
      </div>
      
      <p>You can reply to this ticket from your dashboard.</p>
      
      <a href="${Deno.env.get("SITE_URL") || "https://example.com"}/dashboard" class="cta">View Ticket</a>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} OCCTA Telecom. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

const getPasswordResetHtml = (data: Record<string, unknown>) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 0; background: #f6f4ef; color: #0f172a; }
    .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; }
    .container { max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #0f172a; }
    .brand { background: #0f172a; color: #ffffff; padding: 24px 28px; }
    .brand span { display: block; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #f59e0b; }
    .brand h1 { margin: 8px 0 0; font-size: 24px; letter-spacing: 1px; text-transform: uppercase; }
    .content { padding: 32px 28px; font-size: 16px; line-height: 1.6; }
    .cta { display: block; background: #0f172a; color: #ffffff; text-align: center; padding: 14px 16px; text-decoration: none; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0; }
    .note { background: #f8fafc; border: 2px solid #0f172a; padding: 16px; margin: 16px 0; font-size: 14px; color: #475569; }
    .footer { background: #0f172a; padding: 20px 24px; text-align: center; color: #e2e8f0; font-size: 12px; }
  </style>
</head>
<body>
  <div class="preheader">Reset your OCCTA account password.</div>
  <div class="container">
    <div class="brand">
      <span>OCCTA Telecom</span>
      <h1>Password Reset</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${escapeHtml(data.full_name) || "there"}</strong>,</p>
      <p>We received a request to reset your OCCTA password. Click the button below to choose a new one.</p>

      <a href="${escapeHtml(data.reset_link)}" class="cta">Reset My Password</a>

      <div class="note">
        If you didn’t request this, you can safely ignore this email. For security, this link will expire shortly.
      </div>

      <p>Need help? Reply to this email or reach out via your dashboard.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} OCCTA Telecom. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

// Helper to verify user is admin
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
    // Parse request body first to determine auth requirements
    const { type, to, data, orderNumber, redirectTo }: EmailRequest = await req.json();

    if (!resendApiKey) {
      console.error("Missing RESEND_API_KEY");
      return new Response(
        JSON.stringify({ error: "Email service is not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    // Validate email format
    if (!isValidEmail(to)) {
      console.error("Invalid email format:", to);
      return new Response(
        JSON.stringify({ error: "Invalid email address format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create unauthenticated Supabase client for verification
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Handle order_confirmation for guest orders (no auth required, but verify order exists)
    if (type === "order_confirmation" && orderNumber) {
      // Verify the order exists and email matches
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
      // All other email types require authentication
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        console.error("No authorization header provided");
        return new Response(
          JSON.stringify({ error: "Unauthorized - No authorization header" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );

      // Verify JWT token
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      
      if (claimsError || !claimsData?.claims) {
        console.error("Invalid token:", claimsError?.message);
        return new Response(
          JSON.stringify({ error: "Unauthorized - Invalid token" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const userId = claimsData.claims.sub as string;
      console.log(`Authenticated user: ${userId}`);

      // Authorization checks based on email type
      if (type === "status_update" || type === "order_message" || type === "ticket_reply" || type === "password_reset") {
        // Only admins can send these email types
        const userIsAdmin = await isAdmin(supabase, userId);
        if (!userIsAdmin) {
          console.error("User is not admin, cannot send this email type");
          return new Response(
            JSON.stringify({ error: "Forbidden - Admin access required" }),
            { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        console.log(`Admin verified for ${type} email`);
      } else if (type === "order_confirmation") {
        // For authenticated order confirmations, verify the email matches the order recipient
        const orderEmail = data.email as string | undefined;
        if (orderEmail && orderEmail.toLowerCase() !== to.toLowerCase()) {
          console.error("Email mismatch: order email vs recipient");
          return new Response(
            JSON.stringify({ error: "Forbidden - Email recipient mismatch" }),
            { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      } else if (type === "welcome") {
        // Welcome emails should only be sent to the authenticated user's email
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", userId)
          .single();
        
        if (profile?.email && profile.email.toLowerCase() !== to.toLowerCase()) {
          console.error("Welcome email can only be sent to user's own email");
          return new Response(
            JSON.stringify({ error: "Forbidden - Can only send welcome email to own address" }),
            { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }
    }

    console.log(`Sending ${type} email to ${to}`);

    let subject: string;
    let html: string;
    let emailData: Record<string, unknown> = { ...data };

    if (type === "password_reset") {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: to,
        options: redirectTo ? { redirectTo } : undefined,
      });

      const resetLink = linkData?.properties?.action_link;

      if (linkError || !resetLink) {
        console.error("Failed to generate password reset link", linkError?.message);
        return new Response(
          JSON.stringify({ error: "Unable to generate password reset link" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      emailData = { ...emailData, reset_link: resetLink };
    }

    switch (type) {
      case "order_confirmation":
        subject = `Order Confirmed - ${data.order_number}`;
        html = getOrderConfirmationHtml(emailData);
        break;
      case "welcome":
        subject = "Welcome to OCCTA!";
        html = getWelcomeHtml(emailData);
        break;
      case "status_update":
        subject = `Order Update - ${data.order_number}: ${(data.status as string).toUpperCase()}`;
        html = getStatusUpdateHtml(emailData);
        break;
      case "order_message":
        subject = `Message About Your Order - ${data.order_number}`;
        html = getOrderMessageHtml(emailData);
        break;
      case "ticket_reply":
        subject = `Support Ticket Reply: ${data.ticket_subject}`;
        html = getTicketReplyHtml(emailData);
        break;
      case "password_reset":
        subject = "Reset your OCCTA password";
        html = getPasswordResetHtml(emailData);
        break;
      default:
        throw new Error(`Unknown email type: ${type}`);
    }

    // Use RESEND_FROM_EMAIL for all emails - this must be a verified domain in Resend
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
    
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

    if ("error" in emailResponse && emailResponse.error) {
      console.error("Resend email error:", emailResponse.error);
      return new Response(
        JSON.stringify({ error: emailResponse.error.message || "Email send failed" }),
        {
          status: 502,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-email function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
