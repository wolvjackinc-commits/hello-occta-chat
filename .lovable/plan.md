## Goal

Ship a production-ready OCCTA self-help + knowledge system that:
- deflects support tickets,
- gives Ira AI (public & signed-in modes) a safe, curated knowledge source,
- adds SEO-friendly `/help`, `/guides`, `/blog` sections rendered from `kb_articles`,
- integrates helpful links into transactional emails,
- protects private data at every layer.

Nothing in the quote journey, contract-summary flow, billing, Worldpay, DD, or admin RLS is touched.

## Scope for this deployment

**Full structure + 20 priority articles seeded**. Remaining ~88 help + 20 blog + 20 guides = admin-authored via the CMS in follow-up passes (structure supports them immediately).

## 1. Database (single migration)

Extend the existing `kb_articles` table (non-destructive `ALTER … ADD COLUMN IF NOT EXISTS`):

- `kind text NOT NULL DEFAULT 'help'` — `help` | `guide` | `blog`
- `summary text`
- `seo_title text`, `seo_description text`
- `tags text[] NOT NULL DEFAULT '{}'`
- `related_slugs text[] NOT NULL DEFAULT '{}'`
- `structured_data jsonb`
- `audience text NOT NULL DEFAULT 'public'` — `public` | `customer`
- `ai_allowed boolean NOT NULL DEFAULT true`
- `last_reviewed_at timestamptz`
- `hero_image_url text`, `read_minutes int`
- Indexes: `(kind, status, visibility)`, `(slug)`, `GIN(tags)`.

New tables (with GRANT + RLS in same migration):

- `help_article_feedback` — `article_id`, `helpful bool`, `note text`, `user_id nullable`, `created_at`. RLS: anyone can INSERT; admin/compliance SELECT.
- `help_search_logs` — `query text`, `results_count int`, `user_id nullable`, `created_at`. RLS: anyone INSERT; admin SELECT.
- `email_template_help_links` — `template_key text`, `article_slug text` (soft ref). RLS: admin manage; server role read.

Two SECURITY DEFINER read-only RPCs (search_path=public), returning only customer-safe fields:

- `get_public_kb_articles_by_kind(_kind text)` → published+public rows.
- `search_public_kb(_q text, _kind text default null, _limit int default 20)` → title/summary trigram-ish `ILIKE` search, logs to `help_search_logs`.

## 2. Public routes (all lazy-loaded)

New pages under `src/pages/kb/`, all wrapped in existing `Layout` + `SEO` + `StructuredData`, styled with existing brutalist tokens (reuse `SeoContentLayout` patterns):

- `/help` — `HelpIndex.tsx` — category grid + search bar
- `/help/:slug` — `HelpArticle.tsx` — renders article body, FAQ, "was this helpful?", related, CTA. Also handles the 14 predefined category-landing slugs listed in the request (billing, payments, activation, router-setup, wifi-troubleshooting, speeds, digital-voice, switching, cancellations, complaints, account, vulnerable-customers, business) which are just seeded articles/hubs.
- `/blog` — `BlogIndex.tsx`
- `/blog/:slug` — `BlogPost.tsx`
- `/guides` — reuses existing `Guides.tsx` (already present) but extended to also list DB-authored guides.
- `/guides/:slug` — extends existing `GuidePage.tsx` to fall back to DB when static slug not found.

Article page renders:
- H1, "last reviewed", short-answer callout, TOC (auto from `##` headings), body (markdown via `react-markdown`), inline FAQ, related-article grid, support CTA row (Check availability / Ask Ira / phone / email), "Was this helpful?" thumbs.
- SEO: title, meta description, canonical, FAQ JSON-LD (from FAQ blocks), HowTo JSON-LD when `structured_data` provides it, Breadcrumb JSON-LD.

## 3. Public search + support deflection

- Shared `<KbSearchBar />` component queries `search_public_kb` RPC; results grouped by kind.
- New `<SuggestedArticles subject={…} />` component — used inside existing `RaiseTicketDialog` and complaint form. Debounced query; shows up to 3 suggestions above the submit button; never blocks submission.

## 4. Admin CMS (extend existing page)

Extend `src/pages/admin/KnowledgeBase.tsx`:
- Add `kind` / `audience` / `ai_allowed` / `tags` / `related_slugs` / `summary` / `seo_title` / `seo_description` / `last_reviewed_at` fields to the form.
- Filter tabs: Help / Guide / Blog / All.
- Feedback + no-result-search view (read from the two new tables).
- Preview button opens the live route in a new tab.
- Publish/unpublish/archive (uses existing `kb-approve-article` function).

## 5. Ira AI chat integration

Update `supabase/functions/ai-chat` (existing edge fn behind `AIChatBot.tsx`):

**Retrieval layer** — before calling the model, do a keyword search against `kb_articles` where `ai_allowed=true AND status='approved' AND audience matches session state`, inject up to 6 top matches as system context (title + summary + slug). Cite `[slug]`.

**Public mode** (unauthenticated) — audience filter `public` only. If user asks account-specific question (detected via keywords: "my invoice/order/bill/dd/mandate/ticket…"), respond with sign-in prompt; do not call account tools.

**Authenticated customer mode** — audience filter `public` + `customer`. Reuse & extend existing MCP tools already present under `src/lib/mcp/tools/`:
- keep: `get-my-profile`, `list-my-invoices`, `list-my-orders`, `list-my-services`, `list-my-tickets`
- add: `get-my-billing-summary` (billing_settings + next invoice date + DD status), `list-my-payment-requests`, `list-my-receipts`, `get-my-router-status` (from provisioning_readiness).

Each new tool: SECURITY-scoped SELECT on `auth.uid()`; returns only customer-safe columns; forbids supplier refs, costs/margins, Worldpay/DD encrypted payloads.

Ira system prompt updated with: tone rules, safety rules (never mark paid / never cancel / never process refunds — instead offer "raise a ticket" action which calls existing create-ticket flow with explicit user confirmation).

**Admin mode** unchanged behaviour, but same knowledge base retrieval.

## 6. Transactional email updates

Add a "Helpful links" block (renders links from `email_template_help_links` where matching `template_key`) to these templates in `supabase/functions/send-email/templates/` (or wherever they live — will locate):

quote-sent, contract-summary-ready, order-received, order-committed, router-dispatched, service-live, invoice-sent, payment-reminder, overdue-reminder, receipt, dd-setup, fault-update, cancellation-request, complaint-ack.

Legal wording untouched; only adds a small helpful-links section.

## 7. Seeded content (20 priority help articles)

Seed via `supabase--insert` after migration. Categories & articles:

- **Getting started**: How OCCTA broadband works · What happens after you place an order · Understanding your Contract Summary
- **Activation**: How broadband activation works · What to do before your engineer appointment
- **Router setup**: How to set up your router · Router lights explained · Where to place your router
- **Wi-Fi / speeds**: Slow Wi-Fi troubleshooting · How to test broadband speed correctly
- **Billing**: How OCCTA billing works (uses exact required wording) · Why your first bill may be higher · How to pay by invoice link
- **Payments**: What to do if your card payment fails · How Direct Debit setup works
- **Account**: How to log in to your OCCTA account · How to raise a support request
- **Digital Voice**: What is Digital Voice? · Alarm systems & medical devices notice
- **Cancellation**: How cancellation works · Cooling-off period explained

Each article ships with: summary, ~400–600 word body, 3–5 FAQs, related_slugs, structured_data where relevant, `last_reviewed_at=now()`, `ai_allowed=true`, `audience='public'`, `status='approved'`.

Remaining ~88 help + 20 blog + 20 guides = admin creates via CMS post-launch (structure and CMS support them). Report will list what remains.

## 8. Sitemap / SEO / prerender

- Extend `scripts/generate-sitemap.ts` (if present) or `vite-plugin-prerender.ts` to fetch approved public `kb_articles` and add `/help/:slug`, `/blog/:slug`, `/guides/:slug`.
- Every article page emits canonical + og tags via existing `SEO` component.
- FAQ / HowTo / BreadcrumbList JSON-LD via `StructuredData`.

## 9. Safety & compliance

- Public help pages never render customer/order rows.
- All Ira account tools scoped to `auth.uid()`.
- All new tables have RLS + explicit GRANTs.
- All new SECURITY DEFINER functions `SET search_path = public`.
- Regulatory disclaimer footer on articles tagged `regulatory`.

## 10. Files touched / created

**New**
- `supabase/migrations/2026…_kb_expansion.sql`
- `src/pages/kb/HelpIndex.tsx`, `HelpArticle.tsx`, `BlogIndex.tsx`, `BlogPost.tsx`, `DbGuidePage.tsx`
- `src/components/kb/KbSearchBar.tsx`, `SuggestedArticles.tsx`, `FeedbackWidget.tsx`, `KbArticleView.tsx`
- `src/lib/mcp/tools/get-my-billing-summary.ts`, `list-my-payment-requests.ts`, `list-my-receipts.ts`, `get-my-router-status.ts`
- `supabase/functions/kb-search/index.ts` (thin wrapper if needed; else RPC only)

**Edited**
- `src/App.tsx` — add lazy routes
- `src/pages/admin/KnowledgeBase.tsx` — CMS extensions
- `supabase/functions/ai-chat/index.ts` — retrieval + safety
- `src/lib/mcp/index.ts` — register new tools
- Existing email templates under `supabase/functions/send-email/` — add helpful-links block
- Sitemap generator (`scripts/generate-sitemap.ts` or `vite-plugin-prerender.ts`)
- `src/components/dashboard/*RaiseTicketDialog*` / complaint form — inject `SuggestedArticles`

**Untouched**: quote journey, contract summary, Worldpay flows, DD flows, billing workers, existing admin RLS, existing SEO pages.

## 11. Verification (in final report)

files changed · migrations added · routes created · articles/guides/blogs seeded counts · email templates updated · Ira knowledge integrated Y/N · authenticated account tools Y/N · public search Y/N · sitemap Y/N · SEO/structured-data Y/N · RLS/security check result · build/typecheck result · list of remaining content needing admin authoring.
