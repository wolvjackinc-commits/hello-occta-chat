import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  type: "order_confirmation" | "welcome" | "status_update" | "order_message" | "ticket_reply";
  to: string;
  data: Record<string, unknown>;
  // For guest order confirmations - order verification data
  orderNumber?: string;
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
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: #000; color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; }
    .content { padding: 32px 24px; }
    .order-box { background: #f9f9f9; border: 2px solid #000; padding: 20px; margin: 20px 0; }
    .order-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .order-row:last-child { border-bottom: none; }
    .label { color: #666; }
    .value { font-weight: bold; }
    .cta { display: block; background: #000; color: white; text-align: center; padding: 16px; text-decoration: none; font-weight: bold; text-transform: uppercase; margin: 24px 0; }
    .footer { background: #f4f4f4; padding: 24px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Order Confirmed!</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${escapeHtml(data.full_name)}</strong>,</p>
      <p>Thank you for your order! We've received your request and will be in touch shortly to confirm your installation date.</p>
      
      <div class="order-box">
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
      
      <p><strong>What happens next?</strong></p>
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
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: #000; color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; }
    .content { padding: 32px 24px; }
    .cta { display: block; background: #000; color: white; text-align: center; padding: 16px; text-decoration: none; font-weight: bold; text-transform: uppercase; margin: 24px 0; }
    .footer { background: #f4f4f4; padding: 24px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome!</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${escapeHtml(data.full_name) || "there"}</strong>,</p>
      <p>Welcome to our service! Your account has been created successfully.</p>
      
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
      <p>© ${new Date().getFullYear()} Your Telecom Company. All rights reserved.</p>
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
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: #000; color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; }
    .content { padding: 32px 24px; }
    .status-badge { display: inline-block; background: #000; color: white; padding: 8px 16px; text-transform: uppercase; font-weight: bold; margin: 16px 0; }
    .order-box { background: #f9f9f9; border: 2px solid #000; padding: 20px; margin: 20px 0; }
    .cta { display: block; background: #000; color: white; text-align: center; padding: 16px; text-decoration: none; font-weight: bold; text-transform: uppercase; margin: 24px 0; }
    .cta-secondary { display: block; background: #fff; color: #000; text-align: center; padding: 16px; text-decoration: none; font-weight: bold; text-transform: uppercase; margin: 12px 0; border: 2px solid #000; }
    .footer { background: #f4f4f4; padding: 24px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Order Update</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${escapeHtml(data.full_name)}</strong>,</p>
      
      <p>Your order <strong>${escapeHtml(data.order_number)}</strong> has been updated:</p>
      
      <span class="status-badge">${safeStatus}</span>
      
      <p>${statusMessage}</p>
      
      <div class="order-box">
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
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: #000; color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; }
    .content { padding: 32px 24px; }
    .message-box { background: #f9f9f9; border: 2px solid #000; padding: 20px; margin: 20px 0; }
    .cta { display: block; background: #000; color: white; text-align: center; padding: 16px; text-decoration: none; font-weight: bold; text-transform: uppercase; margin: 24px 0; }
    .footer { background: #f4f4f4; padding: 24px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Message About Your Order</h1>
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
      <p>© ${new Date().getFullYear()} Your Telecom Company. All rights reserved.</p>
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
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: #000; color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; }
    .content { padding: 32px 24px; }
    .ticket-subject { background: #f9f9f9; border-left: 4px solid #000; padding: 12px 16px; margin: 16px 0; font-weight: bold; }
    .message-box { background: #f9f9f9; border: 2px solid #000; padding: 20px; margin: 20px 0; }
    .cta { display: block; background: #000; color: white; text-align: center; padding: 16px; text-decoration: none; font-weight: bold; text-transform: uppercase; margin: 24px 0; }
    .footer { background: #f4f4f4; padding: 24px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Support Ticket Reply</h1>
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
      <p>© ${new Date().getFullYear()} Your Telecom Company. All rights reserved.</p>
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
    const { type, to, data, orderNumber }: EmailRequest = await req.json();
    
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
      if (type === "status_update" || type === "order_message" || type === "ticket_reply") {
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

    switch (type) {
      case "order_confirmation":
        subject = `Order Confirmed - ${data.order_number}`;
        html = getOrderConfirmationHtml(data);
        break;
      case "welcome":
        subject = "Welcome to Our Service!";
        html = getWelcomeHtml(data);
        break;
      case "status_update":
        subject = `Order Update - ${data.order_number}: ${(data.status as string).toUpperCase()}`;
        html = getStatusUpdateHtml(data);
        break;
      case "order_message":
        subject = `Message About Your Order - ${data.order_number}`;
        html = getOrderMessageHtml(data);
        break;
      case "ticket_reply":
        subject = `Support Ticket Reply: ${data.ticket_subject}`;
        html = getTicketReplyHtml(data);
        break;
      default:
        throw new Error(`Unknown email type: ${type}`);
    }

    const emailResponse = await resend.emails.send({
      from: "Orders <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    });

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
