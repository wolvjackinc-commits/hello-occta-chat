# Own-Router Setup Guide — Plan

Build a comprehensive self-help guide so customers can configure their own router with OCCTA broadband using the PPPoE credentials from their welcome email — without contacting support.

## 1. New help article: `/help/own-router-setup`

Add a new entry to `src/data/helpArticles.ts` (slug `own-router-setup`) rendered by the existing `HelpArticle.tsx` route, OR — because the content is rich (table, accordions, conditional auth card) — create a dedicated page `src/pages/help/OwnRouterSetup.tsx` mounted at `/help/own-router-setup` in `src/App.tsx`, and register a short stub in `helpArticles.ts` so it appears in the Help Centre list and search.

Page sections (brutalist OCCTA brand, white bg, navy text, accent borders, mobile-first, icons from `lucide-react`: Router, Cable, Wifi, AlertTriangle, LifeBuoy, Printer):

1. **Intro card** — "Your OCCTA broadband is live…"
2. **Before you start** — checklist (PPPoE username, password, PPPoE-capable router, ONT/socket, device).
3. **Physical connection** — two sub-cards: FTTP/Full Fibre, SoGEA/FTTC, plus a warning callout: "Do not connect the broadband cable into a LAN port…"
4. **Main PPPoE setup steps** — numbered list using `{{pppoe_username}}` / `{{pppoe_password}}` placeholders (MTU 1492, VLAN blank/101, DNS auto).
5. **Router brand quick-access table** — searchable (client-side `useState` filter input) with the 15 rows supplied (BT, EE, Plusnet, Sky, TalkTalk, Vodafone, Virgin, TP-Link, Netgear, ASUS, DrayTek, Zyxel, D-Link, Linksys, FRITZ!Box).
6. **Troubleshooting accordion** — 7 Q&As using shadcn `Accordion`.
7. **Authenticated "Your PPPoE details" card** — rendered ONLY when arriving via tokenized welcome-email link `?t=<token>` OR when `supabase.auth.getUser()` resolves to a customer whose service was opened via token. Shows username + masked password with "Show"/"Copy"/"Print" buttons. No localStorage persistence. Falls back to placeholder note for anonymous visitors: "Use the PPPoE details sent to you by OCCTA — never share them."
8. **Support block** — OCCTA LIMITED, www.occta.co.uk, support@occta.co.uk, phone **0800 260 6626**, guidance to include account name / address / router model / screenshot.
9. **Print this guide** button (`window.print()`) + "Still need help?" CTA → `/support`.
10. **SEO** — `<Helmet>` title "How to Set Up Your Own Router with OCCTA Broadband", meta description per spec, canonical `https://www.occta.co.uk/help/own-router-setup`, HowTo + FAQPage JSON-LD via existing `StructuredData` helper.

## 2. Tokenized PPPoE reveal (secure)

Avoid building a new edge function from scratch — reuse the existing welcome-email link contract:
- Welcome email already mints a per-service magic link. Extend `process-activation-outbox/index.ts` to include `pppoe_username` and a short-lived signed token (HMAC over `service_id + exp`) in the URL: `/help/own-router-setup?u=<username>&t=<token>`.
- Add a tiny edge function `get-pppoe-credentials` that accepts `{ token }`, validates HMAC + expiry against `services` row, and returns `{ username, password }`. Token TTL 30 days, single-use NOT required (customer may revisit). Rate-limit per token via existing `rate_limits` table.
- Frontend calls this function client-side only when `?t=` is present. Never stores password in localStorage; held in component state, masked by default.
- If logged-in customer (no token), look up their active service via existing RLS-scoped `services` query and offer "Reveal PPPoE details" button that calls the same function with a session-derived path (or new RPC `get_my_pppoe(service_id)` security-definer scoped to `auth.uid()`).

## 3. Integrations

- **Help Centre index** (`HelpCenter.tsx` / `helpArticles.ts`): add card under "Broadband setup" category with router icon.
- **Broadband FAQ** (`src/data/faqs.ts` + `Faq.tsx`): add "Can I use my own router?" Q linking to the guide.
- **Welcome email** (`process-activation-outbox/index.ts` branded shell): add a "Using your own router?" section with the tokenized link + inline PPPoE username + masked password reveal-on-page note.
- **Router setup email template**: new template `own-router-setup` in `_shared/transactional-email-templates/` (if scaffolded) OR a section appended to the welcome email. Triggered manually from admin Customer Detail page via existing `CustomerSendEmailDialog`.
- **Customer portal / order details**: add "Your PPPoE details" card on `ServicesTab.tsx` (Dashboard) using the authenticated reveal flow above, plus a "Setup guide" link.
- **Thank-you / post-activation flow** (`ThankYou.tsx` and `service_activation_outbox` follow-ups): add CTA "Using your own router? Setup guide →".
- **Public broadband / SEO pages** where "Can I use my own router?" is asked (`Broadband.tsx`, `NoContractBroadband.tsx`, `seo/FibreBroadband.tsx`): add a short answer block linking to the guide.
- **AI chatbot** (`supabase/functions/ai-chat/index.ts` system prompt): append knowledge block covering PPPoE definition, brand-specific admin URLs, troubleshooting steps, and the safety rule — **never reveal or invent PPPoE passwords**; instead, direct the customer to the welcome email link or to log in to the portal. Add intent triggers for the listed phrases ("how do I set up my own router", "what is PPPoE", brand names, etc.).
- **Sitemap** (`public/sitemap.xml`): add `/help/own-router-setup`.

## 4. Security & privacy

- Public page renders ONLY `{{pppoe_username}}` / `{{pppoe_password}}` placeholders.
- Real credentials only fetched via signed token or authenticated RPC; password masked by default; no localStorage; no analytics event with credential payload.
- Chatbot never echoes credentials, even if asked.
- Audit: log credential reveals into `activity_log` (`event: pppoe_credentials_viewed`).
- Add wording: "Only use the PPPoE details sent to you by OCCTA."

## 5. Testing checklist

- Mobile + desktop render of `/help/own-router-setup` (Playwright screenshot).
- Brand table search filters rows.
- Accordion expands/collapses.
- Anonymous visitor sees placeholders only — no credential fetch.
- Token link reveals masked credentials; "Show" toggles; "Copy" copies.
- Logged-in customer on `/dashboard` Services tab can reveal own PPPoE only.
- Chatbot answers "how do I set up my TP-Link router?" with correct steps and refuses to reveal a password.
- Sitemap contains new URL; Helmet tags + JSON-LD present in built HTML.

## Technical notes

- Files to add: `src/pages/help/OwnRouterSetup.tsx`, `supabase/functions/get-pppoe-credentials/index.ts`, migration for `get_my_pppoe` SECURITY DEFINER (`search_path = public`).
- Files to edit: `src/App.tsx`, `src/data/helpArticles.ts`, `src/data/faqs.ts`, `src/pages/Faq.tsx`, `src/pages/Broadband.tsx`, `src/pages/NoContractBroadband.tsx`, `src/pages/seo/FibreBroadband.tsx`, `src/components/dashboard/tabs/ServicesTab.tsx`, `src/pages/ThankYou.tsx`, `supabase/functions/process-activation-outbox/index.ts`, `supabase/functions/ai-chat/index.ts`, `public/sitemap.xml`.
- Phone number `0800 260 6626` added to `src/lib/companyConfig.ts` if not already present (keeps single source of truth).
