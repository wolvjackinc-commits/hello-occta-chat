import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: "order_confirmation" | "welcome" | "status_update";
  to: string;
  data: Record<string, unknown>;
}

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
      <p>Hi <strong>${data.full_name}</strong>,</p>
      <p>Thank you for your order! We've received your request and will be in touch shortly to confirm your installation date.</p>
      
      <div class="order-box">
        <div class="order-row">
          <span class="label">Order Number:</span>
          <span class="value">${data.order_number}</span>
        </div>
        <div class="order-row">
          <span class="label">Service:</span>
          <span class="value">${data.service_type}</span>
        </div>
        <div class="order-row">
          <span class="label">Plan:</span>
          <span class="value">${data.plan_name}</span>
        </div>
        <div class="order-row">
          <span class="label">Monthly Price:</span>
          <span class="value">£${data.plan_price}/mo</span>
        </div>
        <div class="order-row">
          <span class="label">Installation Address:</span>
          <span class="value">${data.address_line1}, ${data.city}, ${data.postcode}</span>
        </div>
      </div>
      
      <p><strong>What happens next?</strong></p>
      <ol>
        <li>Our team will review your order within 24 hours</li>
        <li>We'll contact you to confirm your preferred installation date</li>
        <li>A technician will arrive on the scheduled date to set everything up</li>
      </ol>
      
      <a href="${Deno.env.get("SITE_URL") || "https://example.com"}/auth" class="cta">Create an Account to Track Your Order</a>
      
      <p>If you have any questions, our support team is here to help.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Your Telecom Company. All rights reserved.</p>
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
      <p>Hi <strong>${data.full_name || "there"}</strong>,</p>
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
    processing: "We're processing your order and preparing everything for installation.",
    dispatched: "Your equipment has been dispatched and is on its way!",
    installed: "Great news! Your service has been installed. Welcome aboard!",
    active: "Your service is now fully active. Enjoy!",
    cancelled: "Your order has been cancelled. If you didn't request this, please contact support.",
  };

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
    .footer { background: #f4f4f4; padding: 24px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Order Update</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${data.full_name}</strong>,</p>
      
      <p>Your order <strong>${data.order_number}</strong> has been updated:</p>
      
      <span class="status-badge">${data.status}</span>
      
      <p>${statusMessages[data.status as string] || "Your order status has been updated."}</p>
      
      <div class="order-box">
        <p><strong>Plan:</strong> ${data.plan_name}</p>
        <p><strong>Service:</strong> ${data.service_type}</p>
      </div>
      
      <a href="${Deno.env.get("SITE_URL") || "https://example.com"}/dashboard" class="cta">View Order Details</a>
      
      <p>Questions? Our support team is always here to help.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Your Telecom Company. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Email function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, to, data }: EmailRequest = await req.json();
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
