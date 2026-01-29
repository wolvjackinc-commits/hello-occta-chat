import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Cron job secret for protecting scheduled endpoints
const CRON_SECRET = Deno.env.get("CRON_JOB_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

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

interface InstallationBooking {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  notes: string | null;
  order_id: string;
  order_type: string;
  installation_slots: {
    slot_date: string;
    slot_time: string;
  };
  technicians: {
    full_name: string;
    phone: string;
  } | null;
}

const TIME_SLOT_LABELS: Record<string, string> = {
  "09:00-12:00": "Morning (9am – 12pm)",
  "12:00-15:00": "Afternoon (12pm – 3pm)",
  "15:00-18:00": "Evening (3pm – 6pm)",
};

// UK Companies Act 2006 compliant footer
const getStandardFooter = () => {
  const siteUrl = Deno.env.get("SITE_URL") || "https://occta.co.uk";
  const currentYear = new Date().getFullYear();
  
  return `
    <div style="background: #0d0d0d; padding: 32px;">
      <div style="text-align: center;">
        <div style="font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 4px; color: #facc15;">OCCTA</div>
        
        <div style="margin: 20px 0;">
          <a href="${siteUrl}/support" style="color: #ffffff; text-decoration: none; font-size: 12px; margin: 0 12px; text-transform: uppercase; letter-spacing: 1px;">Support</a>
          <a href="${siteUrl}/dashboard" style="color: #ffffff; text-decoration: none; font-size: 12px; margin: 0 12px; text-transform: uppercase; letter-spacing: 1px;">Dashboard</a>
          <a href="${siteUrl}/privacy-policy" style="color: #ffffff; text-decoration: none; font-size: 12px; margin: 0 12px; text-transform: uppercase; letter-spacing: 1px;">Privacy</a>
        </div>
        
        <div style="margin: 24px 0; padding-top: 20px; border-top: 1px solid #333;">
          <p style="color: #888; font-size: 12px; margin: 0 0 8px 0; line-height: 1.6;">
            Need help? Call <strong style="color: #fff;">0800 260 6626</strong> or email <a href="mailto:hello@occta.co.uk" style="color: #facc15; text-decoration: none;">hello@occta.co.uk</a>
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

const getReminderEmailHtml = (booking: InstallationBooking, orderDetails: { address_line1?: string; city?: string; postcode?: string; plan_name?: string } | null) => {
  const slotTime = TIME_SLOT_LABELS[booking.installation_slots.slot_time] || escapeHtml(booking.installation_slots.slot_time);
  const slotDate = new Date(booking.installation_slots.slot_date).toLocaleDateString('en-GB', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Installation Tomorrow - OCCTA</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700;900&display=swap');
    body { margin: 0; padding: 0; background: #f5f4ef; color: #0d0d0d; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
    .wrapper { background: #f5f4ef; padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border: 4px solid #0d0d0d; box-shadow: 8px 8px 0 0 #0d0d0d; }
    .header { background: #0d0d0d; padding: 32px; position: relative; overflow: hidden; }
    .header::before { content: ''; position: absolute; top: 0; right: 0; width: 120px; height: 120px; background: #facc15; transform: translate(30%, -30%) rotate(45deg); }
    .logo { font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: 4px; color: #ffffff; position: relative; z-index: 1; }
    .tagline { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #facc15; margin-top: 4px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo">OCCTA</div>
        <div class="tagline">Telecom • Connected</div>
      </div>
      
      <div style="background: #22c55e; padding: 16px 32px; border-bottom: 4px solid #0d0d0d;">
        <h1 style="font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 2px; text-transform: uppercase; margin: 0; color: #ffffff;">
          📅 Installation Tomorrow!
        </h1>
      </div>
      
      <div style="padding: 32px;">
        <p style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">Hi ${escapeHtml(booking.customer_name)},</p>
        
        <p style="font-size: 15px; line-height: 1.7; color: #333; margin: 16px 0;">
          This is a friendly reminder that your installation is scheduled for <strong>tomorrow</strong>! Our engineer will arrive during your chosen time slot.
        </p>
        
        <div style="background: #f5f4ef; border: 4px solid #0d0d0d; padding: 24px; margin: 24px 0; text-align: center;">
          <p style="font-family: 'Bebas Neue', sans-serif; font-size: 28px; margin: 0 0 8px 0; letter-spacing: 2px;">
            📅 ${slotDate}
          </p>
          <p style="font-family: 'Bebas Neue', sans-serif; font-size: 24px; margin: 0; color: #22c55e; letter-spacing: 2px;">
            🕐 ${slotTime}
          </p>
        </div>
        
        <div style="background: #f5f4ef; border: 3px solid #0d0d0d; margin: 24px 0;">
          <div style="background: #0d0d0d; color: #fff; padding: 12px 20px; font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 2px;">
            Appointment Details
          </div>
          <div style="padding: 20px;">
            <div style="padding: 10px 0; border-bottom: 1px dashed #ccc;">
              <span style="font-size: 12px; text-transform: uppercase; color: #666; display: block; margin-bottom: 4px;">Installation Address</span>
              <span style="font-weight: 600;">${escapeHtml(orderDetails?.address_line1) || 'N/A'}, ${escapeHtml(orderDetails?.city) || ''} ${escapeHtml(orderDetails?.postcode) || ''}</span>
            </div>
            <div style="padding: 10px 0; border-bottom: 1px dashed #ccc;">
              <span style="font-size: 12px; text-transform: uppercase; color: #666; display: block; margin-bottom: 4px;">Service</span>
              <span style="font-weight: 600;">${escapeHtml(orderDetails?.plan_name) || 'Broadband Installation'}</span>
            </div>
            ${booking.technicians ? `
            <div style="padding: 10px 0;">
              <span style="font-size: 12px; text-transform: uppercase; color: #666; display: block; margin-bottom: 4px;">Engineer</span>
              <span style="font-weight: 600;">${escapeHtml(booking.technicians.full_name)}</span>
              <span style="color: #666; font-size: 13px;"> • ${escapeHtml(booking.technicians.phone)}</span>
            </div>
            ` : ''}
          </div>
        </div>
        
        <div style="background: #fef3c7; border: 3px solid #facc15; padding: 20px; margin: 24px 0;">
          <h3 style="margin: 0 0 12px 0; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 1px; color: #92400e;">
            📋 Before Your Installation
          </h3>
          <ul style="margin: 0; padding-left: 20px; color: #78350f; font-size: 14px; line-height: 1.8;">
            <li>Ensure someone over 18 will be home during the appointment window</li>
            <li>Clear access to where you'd like the router installed</li>
            <li>Know where your main telephone socket is located</li>
            <li>Have a valid photo ID ready for the engineer</li>
          </ul>
        </div>
        
        <p style="font-size: 15px; line-height: 1.7; color: #333; margin: 16px 0;">
          If you need to reschedule, please contact us as soon as possible on <strong>0800 260 6626</strong>.
        </p>
        
        <p style="font-size: 15px; line-height: 1.7; color: #333; margin: 24px 0 0 0;">
          We look forward to getting you connected!
        </p>
        
        <p style="font-size: 15px; line-height: 1.7; color: #333; margin: 8px 0 0 0;">
          <strong>The OCCTA Team</strong>
        </p>
      </div>
      
      ${getStandardFooter()}
    </div>
  </div>
</body>
</html>
`;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Installation reminders function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify cron job secret for protection
  const cronSecret = req.headers.get("x-cron-secret");
  if (CRON_SECRET && cronSecret !== CRON_SECRET) {
    console.log("SECURITY: Unauthorized cron job request - invalid or missing secret");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    console.log(`Checking for installations on ${tomorrowStr}`);

    // Find bookings for tomorrow that haven't had reminders sent
    const { data: bookings, error: bookingsError } = await supabase
      .from("installation_bookings")
      .select(`
        id,
        customer_name,
        customer_email,
        customer_phone,
        notes,
        order_id,
        order_type,
        installation_slots!inner (
          slot_date,
          slot_time
        ),
        technicians (
          full_name,
          phone
        )
      `)
      .eq("installation_slots.slot_date", tomorrowStr)
      .eq("reminder_sent", false)
      .eq("status", "confirmed");

    if (bookingsError) {
      console.error("Error fetching bookings:", bookingsError);
      throw bookingsError;
    }

    console.log(`Found ${bookings?.length || 0} bookings needing reminders`);

    const results = [];

    for (const rawBooking of bookings || []) {
      // Type assertion - Supabase returns joined data in a specific format
      const booking = rawBooking as unknown as InstallationBooking;
      
      try {
        // Get order details
        let orderDetails = null;
        if (booking.order_type === 'guest_order') {
          const { data: order } = await supabase
            .from("guest_orders")
            .select("order_number, address_line1, city, postcode, plan_name")
            .eq("id", booking.order_id)
            .single();
          orderDetails = order;
        }

        // Send email reminder
        const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "hello@occta.co.uk";
        const slotTime = TIME_SLOT_LABELS[booking.installation_slots?.slot_time] || booking.installation_slots?.slot_time || "scheduled time";
        
        const emailResult = await resend.emails.send({
          from: `OCCTA Telecom <${fromEmail}>`,
          to: [booking.customer_email],
          subject: `📅 Installation Tomorrow – ${slotTime}`,
          html: getReminderEmailHtml(booking, orderDetails),
        });

        console.log(`Email sent to ${booking.customer_email}:`, emailResult);

        // Mark reminder as sent
        await supabase
          .from("installation_bookings")
          .update({
            reminder_sent: true,
            reminder_sent_at: new Date().toISOString(),
          })
          .eq("id", booking.id);

        results.push({
          bookingId: booking.id,
          email: booking.customer_email,
          status: "sent",
        });
      } catch (emailError) {
        console.error(`Failed to send reminder for booking ${booking.id}:`, emailError);
        results.push({
          bookingId: booking.id,
          email: booking.customer_email,
          status: "failed",
          error: emailError instanceof Error ? emailError.message : "Unknown error",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: tomorrowStr,
        processed: results.length,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Error in installation-reminders function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
