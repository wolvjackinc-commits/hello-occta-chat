import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// 1x1 transparent GIF (smallest valid GIF)
const TRANSPARENT_GIF = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
  0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
  0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b
]);

const handler = async (req: Request): Promise<Response> => {
  // Extract tracking ID from query params
  const url = new URL(req.url);
  const trackingId = url.searchParams.get("id");

  console.log(`email-open-track: Received request for id=${trackingId}`);

  // Always return the transparent GIF regardless of success/failure
  const gifResponse = () => new Response(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
      // Allow cross-origin requests for email clients
      "Access-Control-Allow-Origin": "*",
    },
  });

  if (!trackingId) {
    console.log("email-open-track: No tracking ID provided");
    return gifResponse();
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Try to update campaign_recipients table first (for campaign emails)
    const { data: campaignRecipient, error: campaignError } = await supabase
      .from("campaign_recipients")
      .update({
        status: "opened",
        opened_at: new Date().toISOString(),
        open_count: 1, // Will be handled by increment on subsequent opens
      })
      .eq("id", trackingId)
      .is("opened_at", null) // Only update if not already opened
      .select()
      .maybeSingle();

    if (campaignRecipient) {
      console.log(`email-open-track: Marked campaign recipient ${trackingId} as opened`);
      
      // Also increment the campaign's opened_count
      const { error: campaignUpdateError } = await supabase.rpc("increment_campaign_opened_count", {
        p_campaign_id: campaignRecipient.campaign_id,
      }).maybeSingle();

      if (campaignUpdateError) {
        // Fallback: direct update
        await supabase
          .from("campaigns")
          .update({ opened_count: (campaignRecipient as any).campaign?.opened_count + 1 || 1 })
          .eq("id", campaignRecipient.campaign_id);
      }
    } else if (!campaignError) {
      // If already opened, just increment the open count
      const { error: incrementError } = await supabase
        .from("campaign_recipients")
        .update({
          open_count: supabase.rpc("increment", { x: 1 }) as any,
        })
        .eq("id", trackingId);

      if (!incrementError) {
        console.log(`email-open-track: Incremented open count for ${trackingId}`);
      }
    }

    // Also try to update communications_log if this is a log ID
    const { data: commLog, error: commError } = await supabase
      .from("communications_log")
      .update({
        opened_at: new Date().toISOString(),
      })
      .eq("id", trackingId)
      .is("opened_at", null)
      .select()
      .maybeSingle();

    if (commLog) {
      console.log(`email-open-track: Marked communications_log ${trackingId} as opened`);
    }

    return gifResponse();
  } catch (error) {
    console.error("email-open-track: Error updating tracking", error);
    // Still return the GIF even on error
    return gifResponse();
  }
};

serve(handler);
