import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  "09:00-12:00": "Morning (9am - 12pm)",
  "12:00-15:00": "Afternoon (12pm - 3pm)",
  "15:00-18:00": "Evening (3pm - 6pm)",
};

const getReminderEmailHtml = (booking: InstallationBooking, orderDetails: any) => {
  const slotTime = TIME_SLOT_LABELS[booking.installation_slots.slot_time] || booking.installation_slots.slot_time;
  const technicianInfo = booking.technicians 
    ? `<p><strong>Technician:</strong> ${booking.technicians.full_name} (${booking.technicians.phone})</p>`
    : '';

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
    .highlight-box { background: #f9f9f9; border: 4px solid #000; padding: 20px; margin: 20px 0; }
    .date-time { font-size: 24px; font-weight: bold; text-align: center; margin: 16px 0; }
    .details { margin: 16px 0; }
    .details p { margin: 8px 0; }
    .checklist { background: #fffbeb; border: 2px solid #fbbf24; padding: 16px; margin: 20px 0; }
    .checklist h3 { margin: 0 0 12px 0; color: #92400e; }
    .checklist ul { margin: 0; padding-left: 20px; }
    .checklist li { margin: 4px 0; }
    .footer { background: #f4f4f4; padding: 24px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏰ Installation Tomorrow!</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${booking.customer_name}</strong>,</p>
      
      <p>This is a friendly reminder that your installation is scheduled for <strong>tomorrow</strong>!</p>
      
      <div class="highlight-box">
        <div class="date-time">
          📅 ${new Date(booking.installation_slots.slot_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
        <div class="date-time">
          🕐 ${slotTime}
        </div>
      </div>
      
      <div class="details">
        <p><strong>Installation Address:</strong></p>
        <p>${orderDetails?.address_line1 || 'N/A'}<br>
        ${orderDetails?.city || ''}, ${orderDetails?.postcode || ''}</p>
        
        <p><strong>Service:</strong> ${orderDetails?.plan_name || 'N/A'}</p>
        ${technicianInfo}
      </div>
      
      <div class="checklist">
        <h3>📋 Before Your Installation</h3>
        <ul>
          <li>Ensure someone over 18 will be home during the appointment window</li>
          <li>Clear access to where you'd like the router installed</li>
          <li>Know where your main telephone socket is located</li>
          <li>Have a valid ID ready for the technician</li>
        </ul>
      </div>
      
      <p>If you need to reschedule, please contact us as soon as possible.</p>
      
      <p>We look forward to getting you connected!</p>
    </div>
    <div class="footer">
      <p>Need help? Call us at 0800 260 6627</p>
      <p>© ${new Date().getFullYear()} OCCTA Telecom. All rights reserved.</p>
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
        const slotTime = booking.installation_slots?.slot_time || "scheduled time";
        const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
        const emailResult = await resend.emails.send({
          from: `OCCTA Telecom <${fromEmail}>`,
          to: [booking.customer_email],
          subject: `⏰ Installation Reminder - Tomorrow ${slotTime}`,
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
