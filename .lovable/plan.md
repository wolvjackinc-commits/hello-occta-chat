# Full Business Build — OCCTA for Business

Goal: make OCCTA a proper "business-ready" telecom site — a full B2B experience that lives alongside the existing residential site without breaking anything.

Guardrails
- Nothing residential is deleted or renamed. All existing routes, components, DB tables, edge functions, cron jobs and pricing remain intact.
- All new pages live under `/business/*` and reuse the existing design system (brutalist tokens, no hardcoded colors).
- New DB tables are additive; RLS + GRANTs on every one. No changes to `auth`, `storage`, or existing tables' policies.
- VAT-exclusive pricing for business (per project memory).

## 1. Business hub & marketing (public, SEO)

New routes (start fresh under `/business`, keep existing `/business` legacy route redirecting to `/business` hub):
- `/business` — hub landing (hero + industries + plans + trust + CTA)
- `/business/broadband` — SoGEA / FTTP / Leased Line Lite with VAT-ex pricing
- `/business/voice` — Hosted VoIP + SIP Trunks
- `/business/sim` — Business SIM (multi-line, pooled data)
- `/business/bundles` — pre-built packages (Startup / Growth / Scale)
- `/business/industries/[cafes|salons|offices|studios|retail]` — 5 industry landers
- `/business/contact-sales` — dedicated sales lead form
- `/business/case-studies` — 3 seed case studies
- `/business/why-occta` — trust / SLAs / support

Each gets full SEO: `<SEO>` + JSON-LD (Service / Offer / Organization / BreadcrumbList / FAQPage). Sitemap + robots updated.

## 2. Quote / lead capture flow

- New `business_leads` table (name, company, email, phone, company_size, services[], site_count, message, source, utm, status, assigned_to, created_at).
- New edge function `submit-business-lead` → inserts row + fires internal notification email to sales@ + auto-reply to customer (brutalist template).
- Reuses existing `send-email` infra, existing rate-limit pattern, and existing internal-notification standard.
- Callback request widget on hub + industry pages.

## 3. Business checkout (self-serve online orders)

Fresh checkout at `/business/checkout` — separate flow, does not touch residential Checkout.
- Company details step: legal name, trading name, Companies House no. (optional), VAT no. (optional), billing contact, tech contact, PO number.
- Multi-seat / multi-line selection where relevant (VoIP seats, SIM lines).
- VAT-EXCLUDED line items with explicit "+ VAT" and computed total incl. VAT.
- Reuses existing address autocomplete, Worldpay HPP + DD flows, and existing `orders` table with `service_type = 'business'` + new nullable columns:
  - `business_company_name`, `business_vat_number`, `business_company_number`, `business_po_number`, `business_billing_contact`, `business_tech_contact`, `seats` (int).
- Large orders (seats ≥ 10 or Leased Line) → route to quote flow instead of instant checkout.

## 4. Business customer dashboard

New tab in existing `Dashboard.tsx`: "Business" (only shown if profile.account_type = 'business').
- Company profile card (edit legal/trading/VAT/company no.)
- Multi-site list (if `sites` > 1) with per-site services
- VAT invoice downloads (invoices already have all data; add a "Download VAT invoice" button that renders the VAT-exclusive layout in the existing invoice PDF generator)
- Cost centres per invoice line (optional field)
- Sub-user invites: business_users table (business_id, user_id, role: 'owner'|'billing'|'tech'|'viewer')
- `has_business_role()` security-definer function, mirrors the existing `has_role` pattern.

## 5. Sales tooling (admin)

New admin route `/admin/business-leads`:
- List, filter (status, source, date), assign, add internal notes, convert to customer.
- Wired into existing `AdminLayout` + `ProtectedAdminRoute`.
- Reuses `admin_task_notes` pattern for internal notes.

## 6. Header, footer, navigation

- Add "Business" link to `Header.tsx` (both desktop + mobile) — points to `/business` hub.
- Add Business column to `Footer.tsx` with the new routes.
- Homepage adds a small "For business?" strip that links to the hub. Existing homepage sections untouched.

## 7. SEO / discoverability

- Sitemap updated with all new business URLs (weekly changefreq, priority 0.8).
- 12+ target keywords: "business broadband uk", "business fibre uk", "hosted voip uk", "sip trunk uk", "business sim uk", "small business telecom", "office broadband", "leased line lite", industry variants.
- Structured data: Organization already exists; add `Service` schema per product page and `Offer` schema on bundle cards.
- Update `docs/lifecycle-blueprint.md` — no.
- Update `mem://` with new business rules (VAT-ex, /business URL space, business_leads table).

## Technical section

### DB migrations (additive only)
```sql
-- business_leads
CREATE TABLE public.business_leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  company_size text,
  services text[] default '{}',
  site_count int default 1,
  message text,
  source text,
  utm jsonb,
  status text not null default 'new',
  assigned_to uuid references auth.users(id),
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT INSERT ON public.business_leads TO anon, authenticated;
GRANT SELECT, UPDATE ON public.business_leads TO authenticated; -- admin-gated via RLS
GRANT ALL ON public.business_leads TO service_role;
ALTER TABLE public.business_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit a lead" ON public.business_leads FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins read leads" ON public.business_leads FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update leads" ON public.business_leads FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- business_users (sub-users of a business account)
CREATE TABLE public.business_users (...);  -- similar pattern

-- profiles: nullable additions
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'residential';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_company_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_vat_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_company_number text;

-- orders: nullable additions
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS business_po_number text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS seats int;
```

### Files added / touched
- New: `src/pages/business/*` (hub, broadband, voice, sim, bundles, industries, contact-sales, case-studies, why, checkout, thank-you)
- New: `src/components/business/*` (LeadForm, IndustryHero, BundleCard, VatExPrice, CompanyDetailsStep, MultiSeatSelector)
- New: `src/pages/admin/BusinessLeads.tsx`
- New edge function: `supabase/functions/submit-business-lead/index.ts`
- Touched (additive only): `src/App.tsx` (add routes), `src/components/layout/Header.tsx`, `src/components/layout/Footer.tsx`, `public/sitemap.xml`, `src/pages/Dashboard.tsx` (business tab), `src/lib/generateInvoicePdf.ts` (VAT-ex layout branch).

### Non-goals for this build
- No new payment provider work; reuses Worldpay HPP + DD.
- No changes to existing residential pages beyond a small "For business?" strip on `/`.
- No changes to existing pricing engine — business prices live in a new `businessCatalogue.ts` file consuming the same wholesale rows with VAT stripped.

## Rollout order (single build)
1. Migrations + edge function
2. Marketing pages + SEO
3. Lead form + admin leads page
4. Business checkout
5. Dashboard business tab + sub-users
6. Header/footer/homepage strip + sitemap
7. Smoke-test all new routes and confirm residential routes still render

Approve and I'll ship all seven in one pass.
