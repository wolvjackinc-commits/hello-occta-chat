
# Admin Operations Console — UX Cleanup Plan

Large scope, purely UI/display + a few query fixes. No billing, email, invoice, payment, webhook, DD, or contract-signing logic will change. Delivered in phases so you can review after each.

## Guardrails (applies to every phase)
- No new invoices, emails, payment links, webhooks, DD writes.
- No deletion or mutation of customer records.
- Archived/test rows are **filtered from views only**, never removed.
- Contract Summary signing, hashes, PDFs untouched.

---

## Phase 1 — Shared admin layout & density
Create `src/components/admin/shell/`:
- `AdminShell`, `AdminSidebar`, `AdminTopBar`, `AdminPageHeader`, `AdminToolbar`, `AdminDataTable`, `AdminStatusBadge`, `AdminEmptyState`, `AdminActionMenu`, `AdminFilters`, `AdminMetricCards`, `AdminDrawer`.
- Density tokens: topbar 52px, sidebar 224px (collapsible to 56px icon rail), table row 48px, card padding `p-3`, standard button size `sm`.
- Wire into existing admin route layout (replace current admin layout wrapper, keep routes).

## Phase 2 — Sidebar grouping
Collapsible groups: Main / Sales / Billing / Support / Products / Admin. Advanced tools (Legacy Remediation, Abhay Remediation, Audit) hidden behind "Advanced" toggle. Active route highlight via `NavLink`.

## Phase 3 — Top bar
Compact bar: global search input, Quick Actions dropdown (Create ticket, Send email, Book installation, Create invoice, Create payment link, Create customer, Legacy remediation — all just navigate to existing pages), website link, logout. Remove per-page duplicated giant CTAs.

## Phase 4 — Overview page rebuild
Three-section command centre using existing queues + KPI queries — no new data logic:
1. **Today needs attention** — reuses existing queue components, compact list style.
2. **Live customers summary** — count cards (active broadband, active SIM, suspended, legacy awaiting, recurring ready/blocked). Click → filtered page.
3. **Billing summary** — issued/paid/unpaid/overdue this month, PRs sent, DD pending.

## Phase 5 — Table compaction (per page)
Convert to `AdminDataTable` with compact rows, sticky header, row `⋯` action menu, drawer for details:
- Customers, Orders, Quotes, Services, Tickets, Invoices, Payment Requests, DD, Communications, Complaints, Suppliers, Pricing Rules, Margin Rules.
- Services: JSON identifier → "Details" drawer.
- Orders: admin notes → drawer.
- Quotes: action menu instead of many buttons.

## Phase 6 — Targeted display/data fixes
- **VAT banner (Quotes page):** read `platform_settings` VAT fields + `companyConfig`; suppress banner when `vat_registered=true` and today ≥ `vat_effective_date`. Date-aware: quotes dated before effective date keep no-VAT display. No change to invoice generation.
- **SIM Plans admin:** verify query — likely filter/RLS mismatch. Fix `select` to include active plans, remove hidden filter, add "Include archived" toggle (default off).
- **Plans page:** rename to "Broadband Plans", render OCCTA plan bands from `src/lib/pricing/retailCards.ts` (Essential/Superfast/Ultrafast + Flex/Contract Saver + router add-on + VAT display). Read-only until backing table exists.
- **Archived/test filter:** default-exclude in Customers/Services/Orders queries via a client-side predicate on existing `tags`/`status` fields. Toggle "Include archived/test" in toolbar.

## Phase 7 — Live Chain Check redesign
- Summary cards: Total live / OK / Needs action / Agreement pending / Billing blocked / Archived-excluded.
- Table: one **primary status badge** per row (OK, Awaiting CS acceptance, DD pending, Missing order link, Billing blocked, Manual review). Technical classifications collapse into "Details" drawer.
- Dullabhbhai row → "Legacy agreement sent / awaiting acceptance & DD".
- Abhay row → "Legacy broadband renewal sent / awaiting acceptance & DD".
- Do not mark legacy customers "recurring ready" until CS accepted + DD active — display-only classification tweak.

## Phase 8 — Empty states, safety, communications/tickets/DD/pricing polish
- Replace giant empty panels with compact `AdminEmptyState`.
- Add safety line ribbons ("This will send an email", etc.) on pages that trigger real actions — no logic change, just labels + confirm modal wrapper on existing buttons.
- Communications page: compact latest emails list, existing filters.
- Tickets: compact rows with subject/customer/status/priority/age/assigned.
- DD page: tabs (Mandates / Setup links / Payment attempts / Failed collections) over existing queries.
- Products/Pricing section rename + hide placeholder pages behind "Advanced".

## Phase 9 — Final report
Files changed list + yes/no checklist + typecheck output.

---

## Suggested execution
Ship Phase 1–2 first (biggest visual win, low risk), then Phase 4 + 6 (Overview + VAT/SIM/Plans fixes since those are user-visible bugs), then Phase 5 table sweep, then 7, then 8.

**Should I proceed with Phase 1 + 2 + 6 (shared layout, sidebar, and the VAT/SIM/Plans bug fixes) in the first pass?** That gives you a visible cleanup plus the three functional fixes you called out, without a giant single changeset.
