&nbsp;

Proceed with the OCCTA AI Assistant upgrade using the plan above, but apply these safety corrections before implementation.

&nbsp;

Do not create another plan. Do not rebuild from scratch. Upgrade the existing `ai-chat` and `AIChatBot` in place.

&nbsp;

## REQUIRED CORRECTIONS

&nbsp;

1. Do not describe the AI as “fully replacing staff” in the product or prompt logic. It can handle most low-risk support and admin assistance, but high-risk account, billing, contract, payment and cancellation actions must still require staff confirmation.

&nbsp;

2. Admin tools may use the service role only inside secure Edge Functions after:

&nbsp;

   * validating the user JWT;

   * confirming `has_role(uid,'admin')`;

   * checking the requested customer/order/service scope;

   * redacting forbidden fields before returning anything to the model or browser.

&nbsp;

3. The `ai-execute-action` endpoint must not trust the confirmation-card payload from the browser. It must re-fetch the target record, re-check permissions, re-check current lifecycle/status, and then call the existing safe function. Never execute purely from model-generated payload.

&nbsp;

4. Customer document tools must not expose raw storage keys or broad signed URLs to the model. Return customer-safe document metadata, and create a short-lived signed URL only for the authorised customer when they click/download.

&nbsp;

5. Every tool response must be redacted before it reaches the model:

&nbsp;

   * supplier references;

   * Giacom refs;

   * costs;

   * margins;

   * internal notes;

   * raw tokens;

   * raw bank details;

   * encrypted DD fields;

   * IP/session/audit security fields;

   * Worldpay/private payment fields.

&nbsp;

6. `create_support_ticket`, `create_admin_task`, and `create_internal_note` are mutations. They must be audit-logged and must only run after the user/admin explicitly confirms, unless the existing website already treats that action as safe.

&nbsp;

7. AI must never send customer emails directly. It may draft replies only. Staff must send through existing approved email flows.

&nbsp;

8. `check_broadband_availability` must be rate-limited and must not expose supplier/internal availability data to customers.

&nbsp;

9. Knowledgebase answers must never invent prices, speeds, offers, fees, notice periods, billing dates, ETF figures or contract terms. If not found in approved data, the AI must say it will check/create a case.

&nbsp;

10. Add a clear “AI may make mistakes — important account actions are confirmed by OCCTA staff” style safeguard in a professional way, not scary or robotic.

&nbsp;

## IMPLEMENTATION PRIORITY

&nbsp;

Build in this order:

&nbsp;

1. Redaction + role-safe tool registry.

2. Customer-safe AI tools.

3. Admin copilot read tools.

4. Escalation/case creation.

5. Confirmation-card system.

6. Confirmed-action executor that re-validates server-side.

7. Premium UI upgrade for Ollie — OCCTA Assist.

8. Admin copilot sidebar.

9. Quote-journey helper button.

&nbsp;

## DO NOT TOUCH

&nbsp;

Do not change:

&nbsp;

* quote journey logic;

* Contract Summary generation or acceptance;

* signed PDF hashes;

* Worldpay;

* Direct Debit encryption;

* billing;

* service activation;

* cancellation/ETF;

* RLS policies;

* existing admin mutation endpoints.

&nbsp;

## FINAL REPORT REQUIRED

&nbsp;

Return only:

&nbsp;

* files changed;

* customer tools added;

* admin tools added;

* confirmation actions added;

* escalation flow;

* redaction test result;

* supplier-data leak test;

* role-access negative test;

* risky-action no-mutation-first-call test;

* build/typecheck result;

* live journey regression result.

&nbsp;

&nbsp;

# OCCTA AI Assistant — Reimagined (Safe Upgrade)

The project already has `supabase/functions/ai-chat` (1.3k LOC) and `src/components/chat/AIChatBot.tsx` (840 LOC) wired into both the public `Layout` and authenticated `AppLayout`. Rather than rebuild from scratch (which would risk breaking the live site), this plan **upgrades the existing assistant in-place** with structured tools, role-aware data access, admin copilot mode, confirmation cards, and case escalation.

Nothing in the quote journey, Contract Summary generation/acceptance, Worldpay, Direct Debit, billing, service activation, cancellation, or admin mutation paths is modified. The AI only **reads** safe data and **drafts** actions; risky operations still go through the existing edge functions that staff already use.

---

## 1. Backend — `ai-chat` edge function upgrade

Refactor (not replace) `supabase/functions/ai-chat/index.ts` into a streaming, tool-calling agent using the Lovable AI Gateway (`google/gemini-3-flash-preview` default).

### Role resolution (server-side, JWT-verified)

- `anonymous` — public website visitor
- `customer` — authenticated end user (scoped via `auth.uid()`)
- `admin` — verified via existing `has_role(uid,'admin')` RPC
- Persona switches system prompt, available tools, and data scope. RLS is **never bypassed**; tools use the user's JWT-scoped client. Admin-only tools use service role but re-check `has_role` inside the handler.

### Tool catalog (all server-side, schema-validated with Zod)

Customer-safe (read-only):

- `get_my_account_overview` — profile, account number, service status
- `get_my_orders` — order list + lifecycle status from existing views
- `get_my_invoices` — invoices + payment status (no raw tokens)
- `get_my_services` — active services, speeds, install dates
- `get_my_documents` — Contract Summaries, receipts (storage keys → signed URLs)
- `get_my_support_tickets`
- `explain_contract_summary` — pulls user's accepted CS snapshot, asks model to explain in plain English
- `explain_invoice` — pulls one invoice, explains pro-rata / activation fee / VAT
- `check_broadband_availability` — wraps existing `check-availability` function
- `create_support_ticket` — wraps existing ticket creation (requires user confirmation card)

Admin-safe (require `has_role`):

- `find_customer` (by email/name/account/order)
- `get_customer_360_summary`
- `get_order_blockers` — uses existing `provisioning/checklist.ts` logic
- `get_next_best_action`
- `draft_customer_reply` — returns text only, no send
- `prepare_lifecycle_transition` — returns a **confirmation card**, does not execute
- `prepare_service_live_confirmation` — confirmation card → existing `confirm-service-live` fn
- `prepare_cancellation_review` — confirmation card
- `prepare_giacom_checklist`
- `prepare_billing_action`
- `create_admin_task` / `create_internal_note` (safe, audit-logged)

All tools log to `audit_logs` via existing `logAudit` pattern.

### Hard safety rails

- Strip any field matching `worldpay_*`, `dd_*_encrypted`, `*_token`, `supplier_cost`, `margin_*`, `internal_admin_note` before returning to the model.
- Tool registry per role; model cannot call out-of-role tools (enforced server-side, not just in prompt).
- High-risk tools return `{type:"confirmation_card", action, payload, summary}` — the **client** must re-call a separate `ai-execute-confirmed-action` endpoint with the same payload + explicit user confirmation. No tool mutates on first call.
- Per-IP + per-user rate limit using existing persistent rate-limit pattern.

### Knowledgebase retrieval

- Lightweight: a curated `src/lib/ai/knowledge.ts` module (plans, billing rules, cancellation policy, vulnerable customer policy, FAQs) injected into the system prompt — no new vector DB needed. Pulls from existing `companyConfig`, `fairPricing`, `contractSummaryCopy`, FAQ data.

### Streaming

- Use AI SDK `streamText` + `toUIMessageStreamResponse` with `stepCountIs(50)` for multi-step tool loops.

---

## 2. Frontend — `AIChatBot` upgrade

Keep current mounting (floating button in `Layout` + `AppLayout`) so existing entry points keep working. Rewrite internals to:

- Install AI Elements (`conversation message prompt-input tool shimmer`) and migrate message rendering to `message.parts` so tool calls render as collapsible cards.
- New components:
  - `ConfirmationCard` — for high-risk admin actions ("Confirm mark service live for ACC-1234")
  - `StatusCard` — order/billing/service summary card
  - `EscalationCard` — "I've prepared a case for the OCCTA team" with ticket ID
  - `QuickActions` — role-aware (customer vs admin sets)
- Persona detection: read session + `has_role`; show "OCCTA Assist" branding for customers, "OCCTA Copilot" for admins.
- Add admin-only surfaces: render the same `<AIChatBot mode="copilot" />` as a sidebar inside `src/pages/admin/CustomerDetail.tsx` and `src/pages/admin/Overview.tsx`, pre-seeded with the customer context.
- Add a quote-journey helper button in `src/pages/quote/UnifiedJourney.tsx` that opens the assistant pre-scoped to the current quote.
- Loading: shimmer "Thinking…" instead of generic spinner.
- "Copy reply" button on admin assistant messages.

Branding: assistant name **"Ollie — OCCTA Assist"** with warm, professional tone defined in system prompt.

---

## 3. Escalation flow

When the model cannot complete a task it calls `escalate_to_team` tool which:

1. Creates a support ticket (customer) or admin task (admin) with the conversation summary, what was checked, missing info, recommended next step, priority.
2. Returns an `EscalationCard` with ticket reference.
3. Logs to `audit_logs`.

---

## 4. Files changed

Modified:

- `supabase/functions/ai-chat/index.ts` — refactor to tool-calling agent
- `src/components/chat/AIChatBot.tsx` — AI Elements + parts rendering + confirmation/status/escalation cards
- `src/pages/admin/CustomerDetail.tsx` — mount copilot sidebar
- `src/pages/admin/Overview.tsx` — mount copilot
- `src/pages/quote/UnifiedJourney.tsx` — "Ask Ollie" helper button

Created:

- `supabase/functions/_shared/aiTools.ts` — tool registry + zod schemas
- `supabase/functions/_shared/aiRedact.ts` — field-stripping helpers
- `supabase/functions/ai-execute-action/index.ts` — confirmed-action executor (re-uses existing edge fns)
- `src/lib/ai/knowledge.ts` — curated knowledgebase
- `src/components/chat/ConfirmationCard.tsx`
- `src/components/chat/StatusCard.tsx`
- `src/components/chat/EscalationCard.tsx`
- `src/components/ai-elements/*` (via `ai-elements add`)

Not touched: quote journey logic, Contract Summary generators, Worldpay/HPP/webhook code, DD encryption, billing automation, RLS migrations, admin mutation endpoints.

---

## 5. Verification before handoff

- Build + typecheck pass.
- Customer-role chat cannot call any admin tool (negative test in `ai-chat`).
- Tool responses scrubbed of forbidden field names (unit-level assertion).
- Risky admin tool returns confirmation card and does **not** mutate on first invocation.
- Existing floating chat still opens from `Layout`, `AppLayout`, and `SupportTab` "Chat with OCCTA AI" button.
- Manual smoke: quote journey, payment, dashboard load unaffected.

---

## Out of scope (call out explicitly)

- No new vector DB / embeddings pipeline (curated KB only).
- No changes to auth, RLS, billing schedules, Worldpay, DD, or Contract Summary PDFs.
- No automated send-to-customer email from AI (drafts only).