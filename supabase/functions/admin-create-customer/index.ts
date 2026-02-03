import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateCustomerRequest {
  email: string;
  full_name: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  postcode?: string;
  date_of_birth?: string;
  admin_notes?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if caller is admin using has_role function
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: CreateCustomerRequest = await req.json();

    if (!body.email || !body.full_name) {
      return new Response(JSON.stringify({ error: "Email and full name are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a secure random password (customer won't use it - managed account)
    const randomPassword = crypto.randomUUID() + crypto.randomUUID();

    // Create the auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email.toLowerCase().trim(),
      password: randomPassword,
      email_confirm: true, // Auto-confirm since admin is creating
      user_metadata: {
        full_name: body.full_name.trim(),
        created_by_admin: caller.id,
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = newUser.user.id;

    // Update the profile with additional details (profile is auto-created by trigger)
    // Wait a moment for the trigger to complete
    await new Promise((r) => setTimeout(r, 500));

    const updateData: Record<string, unknown> = {
      full_name: body.full_name.trim(),
    };

    if (body.phone) updateData.phone = body.phone.trim();
    if (body.address_line1) updateData.address_line1 = body.address_line1.trim();
    if (body.address_line2) updateData.address_line2 = body.address_line2.trim();
    if (body.city) updateData.city = body.city.trim();
    if (body.postcode) updateData.postcode = body.postcode.toUpperCase().trim();
    if (body.date_of_birth) updateData.date_of_birth = body.date_of_birth;
    if (body.admin_notes) updateData.admin_notes = body.admin_notes.trim();

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(updateData)
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating profile:", updateError);
      // Don't fail - user was created, just profile update failed
    }

    // Fetch the created profile to return
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    // Log the action
    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: caller.id,
      action: "create",
      entity: "customer",
      entity_id: userId,
      metadata: {
        email: body.email,
        full_name: body.full_name,
        created_by_admin: true,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        account_number: profile?.account_number,
        profile,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
