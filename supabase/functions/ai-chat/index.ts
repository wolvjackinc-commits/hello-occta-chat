import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

// Allowed origins for CORS - restrict to known domains
const ALLOWED_ORIGINS = [
  Deno.env.get('SITE_URL') || '',
  'http://localhost:5173',
  'http://localhost:8080',
].filter(Boolean);

const getCorsHeaders = (origin: string | null) => {
  const isAllowed = origin && ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0] || '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
};

// In-memory rate limiting for verification attempts (per account/IP)
const verificationAttempts = new Map<string, { count: number; firstAttempt: number }>();
const VERIFICATION_RATE_LIMIT = 5; // Max attempts
const VERIFICATION_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkVerificationRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = verificationAttempts.get(identifier);
  
  if (!record) {
    verificationAttempts.set(identifier, { count: 1, firstAttempt: now });
    return true;
  }
  
  // Reset if window has passed
  if (now - record.firstAttempt > VERIFICATION_WINDOW_MS) {
    verificationAttempts.set(identifier, { count: 1, firstAttempt: now });
    return true;
  }
  
  // Check if limit exceeded
  if (record.count >= VERIFICATION_RATE_LIMIT) {
    console.log(`Rate limit exceeded for: ${identifier}`);
    return false;
  }
  
  // Increment count
  record.count++;
  return true;
}

// Session-based verification cache (in-memory, cleared on function restart)
// This prevents repeated service role queries for the same verified session
const verifiedSessions = new Map<string, { email?: string; accountNumber?: string; expiresAt: number }>();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function createVerificationSession(key: string, data: { email?: string; accountNumber?: string }): void {
  verifiedSessions.set(key, { ...data, expiresAt: Date.now() + SESSION_TTL_MS });
}

function getVerifiedSession(key: string): { email?: string; accountNumber?: string } | null {
  const session = verifiedSessions.get(key);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    verifiedSessions.delete(key);
    return null;
  }
  return { email: session.email, accountNumber: session.accountNumber };
}

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
      name: "lookup_account_by_number",
      description: "Look up a customer's account using their account number (starts with OCC) and date of birth for verification. Use this when the customer wants to view their bills or account details using their account number. Ask for account number first, then date of birth - one at a time.",
      parameters: {
        type: "object",
        properties: {
          account_number: { type: "string", description: "Customer's account number (format: OCC followed by 8 digits)" },
          date_of_birth: { type: "string", description: "Customer's date of birth in YYYY-MM-DD format" },
        },
        required: ["account_number", "date_of_birth"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_latest_bill",
      description: "Get the latest bill/invoice details for a verified customer account. Only call this after successful account verification via lookup_account_by_number.",
      parameters: {
        type: "object",
        properties: {
          account_number: { type: "string", description: "Customer's verified account number" },
        },
        required: ["account_number"],
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
  account_number: string | null;
  full_name: string;
  email: string;
  selected_addons: unknown;
}

interface SupportTicket {
  id: string;
}

// Tool execution functions - uses separate clients based on security needs
// deno-lint-ignore no-explicit-any
async function executeTool(
  toolName: string, 
  args: Record<string, unknown>, 
  supabaseServiceClient: any,
  supabaseAnonClient: any,
  userId?: string,
  sessionKey?: string
): Promise<string> {
  switch (toolName) {
    case "lookup_account": {
      const { email, date_of_birth } = args as { email: string; date_of_birth: string };
      
      // Validate inputs
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return JSON.stringify({ success: false, message: "Please provide a valid email address." });
      }
      
      const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dobRegex.test(date_of_birth)) {
        return JSON.stringify({ success: false, message: "Please provide your date of birth in YYYY-MM-DD format." });
      }
      
      // Rate limit check
      const rateLimitKey = `email:${email.toLowerCase()}`;
      if (!checkVerificationRateLimit(rateLimitKey)) {
        console.log(`SECURITY: Rate limit exceeded for email verification: ${email}`);
        return JSON.stringify({ 
          success: false, 
          message: "Too many verification attempts. Please wait 15 minutes or call us at 0800 260 6627." 
        });
      }
      
      // Use service role ONLY for verification query (necessary to check DOB without RLS)
      console.log(`AUDIT: Account lookup attempt for email: ${email.substring(0, 3)}***`);
      
      const { data, error } = await supabaseServiceClient
        .from("profiles")
        .select("id, email, full_name, date_of_birth")
        .eq("email", email.toLowerCase())
        .single();
      
      const profile = data as Profile | null;
      
      if (error || !profile) {
        console.log(`AUDIT: Account lookup failed - no profile found for email`);
        return JSON.stringify({ 
          success: false, 
          message: "Unable to verify account. Please check your email and date of birth are correct." 
        });
      }
      
      // Verify DOB matches
      if (profile.date_of_birth !== date_of_birth) {
        console.log(`AUDIT: DOB mismatch for email verification`);
        return JSON.stringify({ 
          success: false, 
          message: "Unable to verify account. Please check your email and date of birth are correct." 
        });
      }
      
      // Create verification session
      if (sessionKey) {
        createVerificationSession(sessionKey, { email: email.toLowerCase() });
        console.log(`AUDIT: Verification session created for email: ${email.substring(0, 3)}***`);
      }
      
      return JSON.stringify({ 
        success: true, 
        message: `Account verified for ${profile.full_name || email}. I can now help you with your orders and account details.`,
        verified_email: email
      });
    }

    case "lookup_account_by_number": {
      const { account_number, date_of_birth } = args as { account_number: string; date_of_birth: string };
      
      // Validate account number format (OCC + 8 digits)
      const accountNumberRegex = /^OCC\d{8}$/i;
      if (!accountNumberRegex.test(account_number)) {
        return JSON.stringify({ 
          success: false, 
          message: "Invalid account number format. Account numbers start with OCC followed by 8 digits (e.g., OCC12345678)." 
        });
      }
      
      // Validate date of birth format (YYYY-MM-DD)
      const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dobRegex.test(date_of_birth)) {
        return JSON.stringify({ 
          success: false, 
          message: "Please provide your date of birth in YYYY-MM-DD format (e.g., 1990-01-15)." 
        });
      }
      
      // Rate limit check for account number verification
      const rateLimitKey = `account:${account_number.toUpperCase()}`;
      if (!checkVerificationRateLimit(rateLimitKey)) {
        console.log(`SECURITY: Rate limit exceeded for account verification: ${account_number}`);
        return JSON.stringify({ 
          success: false, 
          message: "Too many verification attempts. Please wait 15 minutes or call us at 0800 260 6627." 
        });
      }
      
      console.log(`AUDIT: Account lookup attempt for: ${account_number.toUpperCase()}`);
      
      // Use service role for verification query (necessary to check DOB without RLS)
      const { data: orderData, error: orderError } = await supabaseServiceClient
        .from("guest_orders")
        .select("account_number, full_name, email, status, date_of_birth")
        .eq("account_number", account_number.toUpperCase())
        .eq("status", "active")
        .single();
      
      if (orderError || !orderData) {
        console.log(`AUDIT: Account lookup failed - no active account found`);
        return JSON.stringify({ 
          success: false, 
          message: "Unable to find an active account with that account number. Please check the number and try again." 
        });
      }
      
      // First, try to verify DOB from the guest_orders table directly
      if (orderData.date_of_birth) {
        if (orderData.date_of_birth !== date_of_birth) {
          console.log(`AUDIT: DOB mismatch for account: ${account_number}`);
          return JSON.stringify({ 
            success: false, 
            message: "The date of birth doesn't match our records. Please check and try again." 
          });
        }
        
        // Create verification session
        if (sessionKey) {
          createVerificationSession(sessionKey, { accountNumber: account_number.toUpperCase() });
          console.log(`AUDIT: Verification session created for account: ${account_number}`);
        }
        
        return JSON.stringify({ 
          success: true, 
          message: `Account verified for ${orderData.full_name}! I can now help you with your billing details.`,
          verified_account: account_number.toUpperCase()
        });
      }
      
      // Fallback: verify DOB against the email in profiles
      const { data: profileData, error: profileError } = await supabaseServiceClient
        .from("profiles")
        .select("date_of_birth")
        .eq("email", orderData.email.toLowerCase())
        .single();
      
      // If no profile found and no DOB on order, we cannot verify
      if (profileError || !profileData || !profileData.date_of_birth) {
        console.log(`AUDIT: No DOB found for verification - denying access`);
        return JSON.stringify({ 
          success: false, 
          message: "We cannot verify your identity without a date of birth on file. Please contact support at 0800 260 6627 to update your account details." 
        });
      }
      
      if (profileData.date_of_birth !== date_of_birth) {
        console.log(`AUDIT: DOB mismatch from profiles for account: ${account_number}`);
        return JSON.stringify({ 
          success: false, 
          message: "The date of birth doesn't match our records. Please check and try again." 
        });
      }
      
      // Create verification session
      if (sessionKey) {
        createVerificationSession(sessionKey, { accountNumber: account_number.toUpperCase() });
        console.log(`AUDIT: Verification session created for account: ${account_number}`);
      }
      
      return JSON.stringify({ 
        success: true, 
        message: `Account verified for ${orderData.full_name}! I can now help you with your billing details.`,
        verified_account: account_number.toUpperCase()
      });
    }

    case "get_latest_bill": {
      const { account_number } = args as { account_number: string };
      
      // Validate account number format
      const accountNumberRegex = /^OCC\d{8}$/i;
      if (!accountNumberRegex.test(account_number)) {
        return JSON.stringify({ success: false, message: "Invalid account number format." });
      }
      
      // Check if session is verified for this account
      const verifiedSession = sessionKey ? getVerifiedSession(sessionKey) : null;
      if (!verifiedSession || verifiedSession.accountNumber !== account_number.toUpperCase()) {
        console.log(`SECURITY: Attempt to access billing without verification for: ${account_number}`);
        return JSON.stringify({ 
          success: false, 
          message: "Please verify your account first using your account number and date of birth." 
        });
      }
      
      console.log(`AUDIT: Fetching bill for verified account: ${account_number}`);
      
      // Use service role to fetch billing data (RLS doesn't allow public access to guest_orders)
      const { data, error } = await supabaseServiceClient
        .from("guest_orders")
        .select("order_number, plan_name, plan_price, service_type, status, created_at, full_name, email, selected_addons, account_number")
        .eq("account_number", account_number.toUpperCase())
        .eq("status", "active")
        .single();
      
      const order = data as GuestOrder | null;
      
      if (error || !order) {
        return JSON.stringify({ success: false, message: "Unable to retrieve billing details. Please verify your account first." });
      }
      
      // Calculate billing details
      const planPrice = order.plan_price;
      let addonsTotal = 0;
      const addonsList: string[] = [];
      
      if (order.selected_addons && Array.isArray(order.selected_addons)) {
        for (const addon of order.selected_addons as Array<{ name: string; price: number }>) {
          addonsTotal += addon.price;
          addonsList.push(`${addon.name}: £${addon.price.toFixed(2)}/mo`);
        }
      }
      
      const totalMonthly = planPrice + addonsTotal;
      const nextBillDate = new Date();
      nextBillDate.setMonth(nextBillDate.getMonth() + 1);
      nextBillDate.setDate(1);
      
      const billDetails = {
        accountNumber: order.account_number,
        accountHolder: order.full_name,
        plan: order.plan_name,
        planPrice: `£${planPrice.toFixed(2)}/mo`,
        addons: addonsList.length > 0 ? addonsList : ["No add-ons"],
        addonsTotal: `£${addonsTotal.toFixed(2)}/mo`,
        totalMonthly: `£${totalMonthly.toFixed(2)}/mo`,
        nextBillDate: nextBillDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        paymentStatus: "Up to date ✓",
        serviceType: order.service_type.charAt(0).toUpperCase() + order.service_type.slice(1)
      };
      
      return JSON.stringify({ 
        success: true, 
        bill: billDetails,
        message: "Here are your billing details."
      });
    }

    case "get_orders_for_account": {
      const { email } = args as { email: string };
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return JSON.stringify({ success: false, message: "Invalid email format." });
      }
      
      // Check if session is verified for this email
      const verifiedSession = sessionKey ? getVerifiedSession(sessionKey) : null;
      if (!verifiedSession || verifiedSession.email !== email.toLowerCase()) {
        console.log(`SECURITY: Attempt to access orders without verification for: ${email}`);
        return JSON.stringify({ 
          success: false, 
          message: "Please verify your account first using your email and date of birth." 
        });
      }
      
      console.log(`AUDIT: Fetching orders for verified email: ${email.substring(0, 3)}***`);
      
      // Use service role to fetch orders (RLS doesn't allow public access to guest_orders)
      const { data, error } = await supabaseServiceClient
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
      
      // Validate inputs
      if (!subject || subject.length < 3 || subject.length > 200) {
        return JSON.stringify({ success: false, message: "Please provide a subject between 3 and 200 characters." });
      }
      if (!description || description.length < 10 || description.length > 2000) {
        return JSON.stringify({ success: false, message: "Please provide a description between 10 and 2000 characters." });
      }
      
      console.log(`AUDIT: Creating support ticket for user: ${userId}`);
      
      // Use anon client for support tickets (RLS allows authenticated users to create their own)
      const { data, error } = await supabaseAnonClient
        .from("support_tickets")
        .insert({
          user_id: userId,
          subject: subject.trim(),
          description: description.trim(),
          category,
          priority: priority || "medium",
          status: "open",
        })
        .select("id")
        .single();
      
      const ticket = data as SupportTicket | null;
      
      if (error || !ticket) {
        console.log("Support ticket creation failed:", error);
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
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Create Supabase clients - use service role ONLY for verification queries
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabaseServiceClient = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseAnonClient = createClient(supabaseUrl, supabaseAnonKey);
    
    // Generate a unique session key for this conversation to track verified sessions
    const sessionKey = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

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
2. For viewing bills using account number: Use lookup_account_by_number tool. IMPORTANT: Ask for information ONE AT A TIME:
   - First ask: "What's your account number? (It starts with OCC followed by 8 digits)"
   - Wait for their response
   - Then ask: "Thanks! And what's your date of birth? (Format: DD/MM/YYYY)"
   - After verification succeeds, use get_latest_bill to fetch their billing details
3. For order lookups by email: Use lookup_account tool with email and date of birth.
4. Use compare_plans when customers need help choosing a plan.
5. Use calculate_bundle_price to show bundle savings.
6. Create support tickets for issues that need human follow-up.
7. If a customer is signed in (userId is provided), they don't need to verify for creating tickets.
8. Always mention our phone number (0800 260 6627) for urgent matters.
9. Keep responses concise - aim for 2-3 sentences unless more detail is needed.
10. Use emojis sparingly but appropriately to be friendly.
11. If you don't know something, be honest and offer to connect them with human support.
12. When displaying bill information, format it nicely with clear sections for the plan, add-ons, and totals.`;

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
        
        const result = await executeTool(
          toolName, 
          toolArgs, 
          supabaseServiceClient, 
          supabaseAnonClient, 
          userId,
          sessionKey
        );
        
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
    const origin = req.headers.get('Origin');
    const errorCorsHeaders = getCorsHeaders(origin);
    return new Response(
      JSON.stringify({ 
        error: "Sorry, I'm having trouble right now. Please try again or call us at 0800 260 6627." 
      }),
      { status: 500, headers: { ...errorCorsHeaders, "Content-Type": "application/json" } }
    );
  }
});
