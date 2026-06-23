create guides for everythign and make sure the links are emeberd in the emsals and are working properly.  
  
  
1. Welcome (activation) email — match Contract Summary look & tone

Rewrite `supabase/functions/process-activation-outbox/index.ts` `buildEmailHtml()` so the email mirrors the Contract Summary view:

- **OCCTA branded header band** (same as `ContractSummaryView.tsx`): black 4px border container, `O` logo tile, "OCCTA" wordmark, "Telecom That Gets It" tagline, and right-aligned eyebrow "Welcome — your service is live" with the order number.
- **Confetti moment**: a 2-second animated confetti GIF placed inline at the very top, beside/above the greeting "Welcome, {name} 🎉". GIF will be generated and committed at `public/email/confetti-2s.gif` (≈220×80, transparent-ish, plays once, ends on a clean frame so it doesn't loop forever in clients that respect single-play). Referenced via absolute URL `https://www.occta.co.uk/email/confetti-2s.gif` so Gmail/Outlook can fetch it. (JS/CSS animation is stripped by email clients — GIF is the only reliable way, same technique Stripe uses.)
- **Warmer copy** explaining *why their decision is good*: no contracts, no mid-contract price hikes, UK support, fair pricing, easy switching, ownership of their line. Short, friendly, on-brand.
- **Bordered "cards"** matching CS view alignment: Customer & service / Your plan & price / How and when you'll be billed / Getting started / Need a hand — each in a `border:4px solid #111;padding:20px;margin-bottom:16px` block with the same uppercase mini-heading style.
- **Solid black CTA button** "Open your dashboard" (matches brutalist `shadow-brutal` style — drop shadow via offset border trick that survives email).
- **Footer** with company reg, VAT, address, support/billing contact (already in `companyConfig.ts`).

No business logic changes — only the HTML template + payload already passed in.

## 2. Fix the /help/getting-started 404 and missing /help hub

The welcome email links to `/help`, `/help/billing`, `/help/getting-started`. None of these routes exist (only `/guides/:slug` does). Two-part fix:

- **Add new routes in `src/App.tsx**`:
  - `/help` → new `src/pages/help/HelpCenter.tsx` (hub: search + category tiles + featured guides + "Chat with Ira" CTA).
  - `/help/:slug` → new `src/pages/help/HelpArticle.tsx` (renders from a new `src/data/helpArticles.ts` data file using the same brutalist `Layout` + `SeoContentLayout`).
- **Seed `helpArticles.ts**` with the articles the email links to plus the broader self-help library:
  - `getting-started` — full step-by-step (unbox router, master socket, lights meaning, first 24h speed stabilisation, Wi-Fi placement, Digital Voice handset setup, speed test, what "good" looks like).
  - `billing` — when you're billed, how to read your invoice, VAT, Direct Debit Guarantee, late fees, how to pay, refunds.
  - `router-setup`, `slow-wifi-fix`, `no-internet-troubleshooting`, `digital-voice-setup`, `move-home`, `change-plan`, `cancel-or-switch`, `password-and-account-security`, `parental-controls`, `mesh-and-extenders`, `gaming-and-streaming-optimisation`, `business-vs-residential`, `power-cuts-and-emergencies`, `vulnerable-customer-support`.
- Each article uses the same brutalist card layout (`border-4 border-foreground`, uppercase display headings) and includes an inline FAQ block plus a "Still stuck? Chat with Ira" CTA that opens the existing `AIChatBot`.
- Add all articles to `public/sitemap.xml` and `public/robots.txt` allow list.

## 3. Blog / guides expansion + feed the AI chatbot

- Extend `src/data/guides.ts` with ~10 new SEO blog posts covering: "What broadband speed do I really need?", "Fibre vs Full Fibre explained", "How to switch broadband in 3 steps", "Why your Wi-Fi is slow (and 5 fixes)", "Digital Voice vs old landline", "Working from home: the ideal home network", "Best router placement", "What is a static IP and do I need one?", "Understanding your first bill", "Moving home with OCCTA".
- Cross-link guides ↔ help articles via `relatedSlugs`.
- **Chatbot grounding**: extend the system prompt context used by the AI chat edge function to include a compact JSON index of all `guides` + `helpArticles` (title, slug, summary, top FAQ Q&A). Add a small `src/lib/aiKnowledgeBase.ts` builder consumed by the chat function's prompt so Ira can answer with references and link to the right `/help/...` or `/guides/...` page.

## 4. Other lifecycle emails — same shell

Refactor the welcome email's branded shell into a small reusable HTML builder (`supabase/functions/_shared/brandedEmailShell.ts`) and reuse it from `process-cancellation-outbox` and other transactional senders so every customer email shares the Contract Summary look (header band, bordered cards, brutalist CTA, footer).

## Technical notes

- Confetti GIF will be generated locally (Python/PIL, 2s, 30fps, ends still) and committed under `public/email/`. The asset is referenced by absolute URL so it works from external mail clients.
- All inline styles only — no `<style>` blocks, no web fonts, no JS. Max width 600px, single-column.
- Help/guides routes are static pages (no DB) — no migrations needed.
- No changes to billing, payment, or activation logic. Edge functions touched: `process-activation-outbox`, optionally `process-cancellation-outbox`, plus the chat function for the knowledge base.

## Out of scope (ask if wanted)

- Animated header logo, dark-mode email media query, multilingual help centre, admin CMS for editing help articles. Happy to add any of these as a follow-up.