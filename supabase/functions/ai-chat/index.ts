import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Business knowledge base
const businessInfo = {
  company: "OCCTA Telecom",
  phone: "0800 260 6627",
  email: "hello@occtatele.com",
  services: ["Broadband", "SIM/Mobile Plans", "Landline"],
  features: [
    "No contracts - cancel anytime",
    "24/7 UK-based support",
    "Free installation",
    "Competitive pricing (£1-2 cheaper than market average)",
  ],
  broadbandPlans: [
    { name: "ESSENTIAL", speed: "36Mbps", price: "£22.99/mo", description: "Perfect for light browsing" },
    { name: "SUPERFAST", speed: "150Mbps", price: "£26.99/mo", description: "For households that use internet properly", popular: true },
    { name: "ULTRAFAST", speed: "500Mbps", price: "£38.99/mo", description: "For gamers, streamers, WFH" },
    { name: "GIGABIT", speed: "900Mbps", price: "£52.99/mo", description: "The fastest internet" },
  ],
  simPlans: [
    { name: "Starter", data: "5GB", price: "£7.99/mo", description: "For light users" },
    { name: "Essential", data: "15GB", price: "£11.99/mo", description: "Perfect for everyday use" },
    { name: "Plus", data: "50GB", price: "£17.99/mo", description: "For social media enthusiasts", popular: true },
    { name: "Unlimited", data: "Unlimited", price: "£27.99/mo", description: "Never worry about data again" },
  ],
  landlinePlans: [
    { name: "Pay As You Go", price: "£7.99/mo", callRate: "8p/min" },
    { name: "Evening & Weekend", price: "£12.99/mo", callRate: "Free evenings" },
    { name: "Anytime", price: "£17.99/mo", callRate: "Always free", popular: true },
    { name: "International", price: "£26.99/mo", callRate: "300 mins to 50+ countries" },
  ],
  bundleDiscounts: "10% off for 2 services, 15% off for 3+ services",
  faqs: [
    { q: "How do I check my broadband speed?", a: "Use speedtest.net or our app. Test with ethernet for accurate results." },
    { q: "Can I keep my phone number?", a: "Yes! For mobile, text 'PAC' to 65075. For landlines, we handle the transfer." },
    { q: "What happens if I go over my data limit?", a: "No extra charges - just speed reduction to 1Mbps until next billing date." },
    { q: "How do I cancel?", a: "Log in to dashboard or call us. 30 days notice, no exit fees on rolling contracts." },
  ],
};

// Tools definitions for the AI
const tools = [
  {
    type: "function",
    function: {
      name: "lookup_account",
      description: "Look up a customer's account using their email and date of birth for verification. Use this when the customer wants to view their bills, orders, or account details.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Customer's email address" },
          date_of_birth: { type: "string", description: "Customer's date of birth in YYYY-MM-DD format" },
        },
        required: ["email", "date_of_birth"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_orders_for_account",
      description: "Get all orders for a verified customer account. Only call this after successful account verification.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Customer's verified email address" },
        },
        required: ["email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_support_ticket",
      description: "Create a new support ticket for the customer. Use this when they need help with an issue that can't be resolved immediately.",
      parameters: {
        type: "object",
        properties: {
          subject: { type: "string", description: "Brief summary of the issue" },
          description: { type: "string", description: "Detailed description of the issue" },
          category: { 
            type: "string", 
            enum: ["broadband", "mobile", "landline", "billing", "payments", "account"],
            description: "Category of the issue" 
          },
          priority: { 
            type: "string", 
            enum: ["low", "medium", "high", "urgent"],
            description: "Priority level of the ticket" 
          },
        },
        required: ["subject", "description", "category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_plans",
      description: "Compare plans within a service type to help customers choose the best option.",
      parameters: {
        type: "object",
        properties: {
          service_type: { 
            type: "string", 
            enum: ["broadband", "sim", "landline"],
            description: "Type of service to compare" 
          },
          usage_needs: { 
            type: "string", 
            description: "Customer's usage needs (e.g., 'light browsing', 'gaming', 'work from home')" 
          },
        },
        required: ["service_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate_bundle_price",
      description: "Calculate the total price for a bundle of services with applicable discounts.",
      parameters: {
        type: "object",
        properties: {
          broadband_plan: { type: "string", description: "Name of broadband plan (optional)" },
          sim_plan: { type: "string", description: "Name of SIM plan (optional)" },
          landline_plan: { type: "string", description: "Name of landline plan (optional)" },
        },
        required: [],
      },
    },
  },
];

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  date_of_birth: string | null;
}

interface GuestOrder {
  order_number: string;
  plan_name: string;
  plan_price: number;
  service_type: string;
  status: string;
  created_at: string;
}

interface SupportTicket {
  id: string;
}

// Tool execution functions
// deno-lint-ignore no-explicit-any
async function executeTool(
  toolName: string, 
  args: Record<string, unknown>, 
  supabaseClient: any,
  userId?: string
): Promise<string> {
  switch (toolName) {
    case "lookup_account": {
      const { email, date_of_birth } = args as { email: string; date_of_birth: string };
      
      // Check profiles table for matching email and DOB
      const { data, error } = await supabaseClient
        .from("profiles")
        .select("id, email, full_name, date_of_birth")
        .eq("email", email.toLowerCase())
        .eq("date_of_birth", date_of_birth)
        .single();
      
      const profile = data as Profile | null;
      
      if (error || !profile) {
        return JSON.stringify({ 
          success: false, 
          message: "Unable to verify account. Please check your email and date of birth are correct." 
        });
      }
      
      return JSON.stringify({ 
        success: true, 
        message: `Account verified for ${profile.full_name || email}. I can now help you with your orders and account details.`,
        verified_email: email
      });
    }

    case "get_orders_for_account": {
      const { email } = args as { email: string };
      
      // Get orders from guest_orders (linked orders have user_id but we match by email)
      const { data, error } = await supabaseClient
        .from("guest_orders")
        .select("order_number, plan_name, plan_price, service_type, status, created_at")
        .eq("email", email.toLowerCase())
        .order("created_at", { ascending: false })
        .limit(5);
      
      const orders = data as GuestOrder[] | null;
      
      if (error) {
        return JSON.stringify({ success: false, message: "Unable to retrieve orders." });
      }
      
      if (!orders || orders.length === 0) {
        return JSON.stringify({ success: true, orders: [], message: "No orders found for this account." });
      }
      
      const formattedOrders = orders.map(o => ({
        orderNumber: o.order_number,
        plan: o.plan_name,
        price: `£${o.plan_price}/mo`,
        service: o.service_type,
        status: o.status,
        date: new Date(o.created_at).toLocaleDateString('en-GB')
      }));
      
      return JSON.stringify({ success: true, orders: formattedOrders });
    }

    case "create_support_ticket": {
      if (!userId) {
        return JSON.stringify({ 
          success: false, 
          message: "You need to be signed in to create a support ticket. Please sign in or call us at 0800 260 6627." 
        });
      }
      
      const { subject, description, category, priority } = args as { 
        subject: string; description: string; category: string; priority?: string 
      };
      
      const { data, error } = await supabaseClient
        .from("support_tickets")
        .insert({
          user_id: userId,
          subject,
          description,
          category,
          priority: priority || "medium",
          status: "open",
        })
        .select("id")
        .single();
      
      const ticket = data as SupportTicket | null;
      
      if (error || !ticket) {
        return JSON.stringify({ success: false, message: "Failed to create ticket. Please try again or call us." });
      }
      
      return JSON.stringify({ 
        success: true, 
        message: `Support ticket created successfully! Ticket reference: ${ticket.id.slice(0, 8).toUpperCase()}. We'll get back to you within 24 hours.` 
      });
    }

    case "compare_plans": {
      const { service_type, usage_needs } = args as { service_type: string; usage_needs?: string };
      
      let plans: Array<{ name: string; price: string; [key: string]: unknown }> = [];
      let recommendation = "";
      
      switch (service_type) {
        case "broadband":
          plans = businessInfo.broadbandPlans;
          if (usage_needs?.toLowerCase().includes("gaming") || usage_needs?.toLowerCase().includes("stream")) {
            recommendation = "Based on your needs, I recommend ULTRAFAST (500Mbps) for smooth gaming and 4K streaming.";
          } else if (usage_needs?.toLowerCase().includes("work") || usage_needs?.toLowerCase().includes("wfh")) {
            recommendation = "For working from home with video calls, SUPERFAST (150Mbps) is perfect and our most popular choice.";
          } else {
            recommendation = "SUPERFAST (150Mbps) is our most popular plan - great value for most households.";
          }
          break;
        case "sim":
          plans = businessInfo.simPlans;
          if (usage_needs?.toLowerCase().includes("social") || usage_needs?.toLowerCase().includes("video")) {
            recommendation = "Plus (50GB) is ideal for social media and video streaming - our most popular SIM plan.";
          } else if (usage_needs?.toLowerCase().includes("light") || usage_needs?.toLowerCase().includes("basic")) {
            recommendation = "Starter (5GB) or Essential (15GB) would suit light usage perfectly.";
          } else {
            recommendation = "Plus (50GB) offers great value for most users.";
          }
          break;
        case "landline":
          plans = businessInfo.landlinePlans;
          recommendation = "Anytime is our most popular landline plan - unlimited UK calls 24/7.";
          break;
      }
      
      return JSON.stringify({ plans, recommendation });
    }

    case "calculate_bundle_price": {
      const { broadband_plan, sim_plan, landline_plan } = args as { 
        broadband_plan?: string; sim_plan?: string; landline_plan?: string 
      };
      
      let total = 0;
      const selectedPlans: Array<{ name: string; price: number; service: string }> = [];
      
      if (broadband_plan) {
        const plan = businessInfo.broadbandPlans.find(p => 
          p.name.toLowerCase() === broadband_plan.toLowerCase()
        );
        if (plan) {
          const price = parseFloat(plan.price.replace("£", "").replace("/mo", ""));
          total += price;
          selectedPlans.push({ name: plan.name, price, service: "Broadband" });
        }
      }
      
      if (sim_plan) {
        const plan = businessInfo.simPlans.find(p => 
          p.name.toLowerCase() === sim_plan.toLowerCase()
        );
        if (plan) {
          const price = parseFloat(plan.price.replace("£", "").replace("/mo", ""));
          total += price;
          selectedPlans.push({ name: plan.name, price, service: "SIM" });
        }
      }
      
      if (landline_plan) {
        const plan = businessInfo.landlinePlans.find(p => 
          p.name.toLowerCase() === landline_plan.toLowerCase()
        );
        if (plan) {
          const price = parseFloat(plan.price.replace("£", "").replace("/mo", ""));
          total += price;
          selectedPlans.push({ name: plan.name, price, service: "Landline" });
        }
      }
      
      const serviceCount = selectedPlans.length;
      let discount = 0;
      let discountPercentage = 0;
      
      if (serviceCount >= 3) {
        discountPercentage = 15;
      } else if (serviceCount === 2) {
        discountPercentage = 10;
      }
      
      discount = total * (discountPercentage / 100);
      const finalTotal = total - discount;
      
      return JSON.stringify({
        plans: selectedPlans,
        originalTotal: `£${total.toFixed(2)}/mo`,
        discount: discountPercentage > 0 ? `${discountPercentage}% off (saving £${discount.toFixed(2)}/mo)` : "No bundle discount (add more services for savings!)",
        finalTotal: `£${finalTotal.toFixed(2)}/mo`,
      });
    }

    default:
      return JSON.stringify({ error: "Unknown tool" });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Create Supabase client for tool execution
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // System prompt with business knowledge
    const systemPrompt = `You are OCCTA's friendly AI assistant. You help customers with questions about our telecom services, account inquiries, and support.

BUSINESS INFORMATION:
- Company: ${businessInfo.company}
- Phone: ${businessInfo.phone}
- Email: ${businessInfo.email}
- Services: ${businessInfo.services.join(", ")}

KEY FEATURES:
${businessInfo.features.map(f => `- ${f}`).join("\n")}

BROADBAND PLANS:
${businessInfo.broadbandPlans.map(p => `- ${p.name}: ${p.speed} @ ${p.price} - ${p.description}${p.popular ? " (POPULAR)" : ""}`).join("\n")}

SIM PLANS:
${businessInfo.simPlans.map(p => `- ${p.name}: ${p.data} data @ ${p.price} - ${p.description}${p.popular ? " (POPULAR)" : ""}`).join("\n")}

LANDLINE PLANS:
${businessInfo.landlinePlans.map(p => `- ${p.name}: ${p.price} - ${p.callRate}${p.popular ? " (POPULAR)" : ""}`).join("\n")}

BUNDLE DISCOUNT: ${businessInfo.bundleDiscounts}

COMMON FAQS:
${businessInfo.faqs.map(f => `Q: ${f.q}\nA: ${f.a}`).join("\n\n")}

GUIDELINES:
1. Be friendly, helpful, and concise. Use a conversational British tone.
2. For account-specific queries (bills, orders, account details), use the lookup_account tool first to verify the customer. Ask for their email and date of birth.
3. Use compare_plans when customers need help choosing a plan.
4. Use calculate_bundle_price to show bundle savings.
5. Create support tickets for issues that need human follow-up.
6. If a customer is signed in (userId is provided), they don't need to verify for creating tickets.
7. Always mention our phone number (0800 260 6627) for urgent matters.
8. Keep responses concise - aim for 2-3 sentences unless more detail is needed.
9. Use emojis sparingly but appropriately to be friendly.
10. If you don't know something, be honest and offer to connect them with human support.`;

    let currentMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Call AI with tools
    let response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: currentMessages,
        tools,
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable. Please call us at 0800 260 6627." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI service error");
    }

    let data = await response.json();
    let assistantMessage = data.choices[0].message;

    // Handle tool calls in a loop
    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolResults: Array<{ role: string; tool_call_id: string; content: string }> = [];
      
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        
        console.log(`Executing tool: ${toolName}`, toolArgs);
        
        const result = await executeTool(toolName, toolArgs, supabaseClient, userId);
        
        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      // Add assistant message with tool calls and tool results
      currentMessages.push(assistantMessage);
      currentMessages.push(...toolResults);

      // Call AI again with tool results
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: currentMessages,
          tools,
          tool_choice: "auto",
        }),
      });

      if (!response.ok) {
        throw new Error("AI service error during tool follow-up");
      }

      data = await response.json();
      assistantMessage = data.choices[0].message;
    }

    return new Response(
      JSON.stringify({ 
        content: assistantMessage.content,
        role: "assistant"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("AI chat error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Sorry, I'm having trouble right now. Please try again or call us at 0800 260 6627." 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
