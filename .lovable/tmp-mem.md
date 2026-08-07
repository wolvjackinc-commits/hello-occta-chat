---
name: OCCTA AI Chat Brain
description: Public Ollie chat is LLM-driven via occta-companion/brain.ts with deterministic account verification kept separate
type: feature
---
- `supabase/functions/occta-companion/brain.ts` holds the LLM layer (Lovable AI Gateway, `google/gemini-3.6-flash`) with the full OCCTA system prompt and a `search_occta_knowledge` tool backed by the `search_kb_for_ai` RPC.
- The brain NEVER receives account data. Verified account answers stay in the deterministic path in `occta-companion/index.ts` (HMAC verification token, account number + DOB).
- Order in `index.ts`: account intent → deterministic verified reply; otherwise KB search → AI brain → `approvedPublicReply` → `knowledgeFallback`.
- Every reply must end with `<<<OPTIONS:["..."]>>>`; the brain appends defaults if the model omits it.
- `OcctaCompanionV4.tsx` calls the endpoint FIRST; local canned replies (availability, provider comparison, `resolveIntelligentPublicReply`, `internalFallback`) are fallback-only.
- Hard content rules baked into the prompt: no invented prices/speeds/hours/tariffs, address check for availability, OCCTA-only links, no blanket "no contracts" claim, routers not included.
