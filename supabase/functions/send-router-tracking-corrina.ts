
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const customerId = "67ac9cf4-f5f6-4df3-9e42-523899d71cdf";
const recipientEmail = "phoenixs83@yahoo.com";
const fullName = "Corrina Marie Hughes";

const emailData = {
  type: "custom_admin",
  to: recipientEmail,
  userId: customerId,
  logToCommunications: true,
  data: {
    full_name: fullName,
    subject: "Router Delivery Update - OCC06467058",
    message: `We apologize for any inconvenience caused. Your router is scheduled to be delivered tomorrow, 18th August.

Tracking Information:
Consignment / Tracking Number: 0253912
Tracking Link: https://apcchoice.apc-overnight.com/APCChoice`
  }
};

console.log("Sending email to Corrina Marie Hughes...");

const { data, error } = await supabase.functions.invoke("send-email", {
  body: emailData
});

if (error) {
  console.error("Failed to send email:", error);
  Deno.exit(1);
}

console.log("Email sent successfully:", data);
