## Homepage Conversion Overhaul — Final Plan

### 1. Create `src/contexts/AvailabilityContext.tsx`

Central state + API logic for the entire availability flow.

**State:**

```
status: 'idle' | 'loading-postcode' | 'addresses' | 'checking-address' | 'success' | 'error'
postcode, addresses[], selectedAddress, errorType, result (single normalized object)
```

**Result object** (the ONE source of truth for all UI):

```
{ available, primaryTechnology, maxDownload, maxUpload, eligibleOcctaPlans[], recommendedPlan, upgradePlan?, message? }
```

**Recommendation logic (computed on result):**

- FTTC only → `essential`
- FTTP max 330–549 → recommended: `superfast`
- FTTP max 550–899 → recommended: `superfast`, upgrade: `ultrafast`
- FTTP max 900+ → recommended: `superfast` (best value)

**Persistence:** On success, write result + postcode + selectedAddress to `sessionStorage('occta_availability')`. On mount, hydrate from sessionStorage if present. Expose `reset()` to clear both.

**Error types:** `invalid-postcode | no-addresses | backend-unavailable | availability-failed`

**Actions:** `checkPostcode(pc)`, `selectAddress(addr)`, `reset()`

API calls to edge functions (`check-address`, `check-availability`) move here from PostcodeChecker.

---

### 2. Refactor `src/components/home/PostcodeChecker.tsx`

Strip API logic — becomes pure UI consuming context.

- Calls `checkPostcode()` and `selectAddress()` from context
- Accepts `variant?: 'hero' | 'standalone'` prop
- Hero variant: input 68% + button 32%, max-width 700px desktop; stacked mobile
- Placeholder: `"E.g. HD3 3WU"` / Button: `"CHECK AVAILABILITY"`
- Helper line below: `"We'll only show plans actually available at your address."`
- Shows address dropdown when `status === 'addresses'`
- Explicit loading states: spinner + text for `loading-postcode` and `checking-address`
- Error states with distinct messages per `errorType`

---

### 3. Rebuild `src/components/home/HeroSection.tsx`

Two-column grid: 52/48 desktop, stacked mobile. Reads from AvailabilityContext.

**Left column:**

1. Eyebrow: `"NO CONTRACTS • NO ANNUAL PRICE HIKES • UK-BASED SUPPORT"`
2. Headline: `"FINALLY.\nBROADBAND THAT\nDOESN'T LOCK YOU IN."`
3. Paragraph: `"No contracts. No annual price hikes. No nonsense. Just fast, reliable broadband from £22.99/month."`
4. Value chips: No Contracts, No Annual Price Hikes, UK-based Support, Openreach Network, Cancel Anytime
5. Label: `"CHECK WHAT'S AVAILABLE AT YOUR ADDRESS"`
6. `<PostcodeChecker variant="hero" />`
7. Result card below checker (reads from context `result`):
  - FTTP: green border, "Brilliant — Full Fibre is available…" + speed + plan pills
  - FTTC: "Good news — Fibre is available…" + Essential pill
  - Unavailable: "We couldn't confirm service online." + "CALL 0800 260 6626"

**Right column — State A (before check / idle):**

- Static card with OCCTA border/shadow
- "STARTING FROM" → `£22.99/month` → "No contracts • No annual price hikes"
- Compact category cues (not full plan cards):
  - Essential — everyday browsing
  - Superfast — streaming and busy homes
  - Gigabit — serious speed
- 3 proof rows: Full Fibre where available, Openreach network, UK-based support
- Bottom strip: 14-day cooling-off, keep your number, no mid-contract price rises

**Right column — State B (after success):**

- "AVAILABLE AT YOUR ADDRESS" + short address
- "Up to {maxSpeed}" stat
- Eligible plan rows only (from `result.eligibleOcctaPlans`), each: name, speed, price, 2-3 benefits, "CHOOSE PLAN"
- Recommended badge on `result.recommendedPlan`; if `upgradePlan` exists, show subtle "upgrade" label on that plan
- "CHOOSE PLAN" navigates to broadband page or triggers voice upsell, preserving context in sessionStorage
- Bottom: "No annual price hikes • Cancel anytime"

Both panels read from the same `result` object — no duplicate state.

---

### 4. Update `src/pages/Index.tsx`

Wrap homepage content with `<AvailabilityProvider>`.

---

### 5. Update `src/pages/Broadband.tsx`

Wrap with `<AvailabilityProvider>`. Read context.

**If personalised result exists:**

- Note: "Showing plans available at your address"
- Filter to eligible plans only, recommended first
- "Recommended for your address" badge
- FTTC-only note: "Full Fibre isn't currently available at this address"
- Link: "Clear address check and view all plans" → calls `reset()`

**If no result:** full plan ladder as today.

---

### 6. Downstream context preservation

When "CHOOSE PLAN" is clicked, postcode + address remain in sessionStorage. PreCheckout reads sessionStorage to prefill postcode/address fields where the form supports it.

---

### What does NOT change

- Global header, footer, nav, colours, fonts, shadows, borders
- Pricing logic, catalogue, checkout flow
- Edge functions / ngrok backend
- Below-hero sections (Services, WhyUs, CustomerLove, CTA)
- App mode flows, SIM/landline pages

### Implementation order

1. AvailabilityContext with sessionStorage
2. PostcodeChecker refactor
3. HeroSection two-column rebuild
4. Index.tsx provider wrap
5. Broadband.tsx filtering + clear link
6. Test all states  
Add this above input:
  ```
  ENTER YOUR POSTCODE
  ```
  Add under checker:
  ```
  ✓ Takes 10 seconds • ✓ No commitment • ✓ Real availability
  ```
  ### Add ONE psychological trigger:
  Under price (£22.99):
  ```
  Join customers switching away from price rises
  ```
  Under plan section:
  ```
  Free installation available for a limited time
  ```
  ### While checking:
  Show:
  ```
  Checking your address…
  ```
  Then:
  ```
  Finding the fastest available speeds…
  ```
  When postcode returns multiple addresses:
  👉 Make dropdown clean + large  
  👉 Show:
  ```
  Select your address
  ```
  When user lands with results:
  Add top banner:
  ```
  Results for: HD3 3WU
  [Change postcode]
  ```
    
  You already added error states — improve it:
  If unavailable:
  ```
  We couldn't confirm availability online.

  Call 0800 260 6626 — we'll check instantly and get you connected.
  ```
    
  Make sure Lovable DOES THIS:
  ```
  Single source of truth = AvailabilityContext.result
  ```
  ## Improve “State B” plan display (MOST IMPORTANT CHANGE)
  Right now:
  - You show eligible plans → correct
  BUT you must:
  ### 🔥 Add THIS STRUCTURE:
  For each plan:
  ```
  [PLAN NAME]
  Up to X Mbps

  £XX.XX/month

  ✔ Unlimited usage  
  ✔ No contracts  
  ✔ Free router  

  [CHOOSE PLAN]
  ```
  AND:
  ### ⭐ Make ONLY ONE plan visually dominant:
  -   
  bigger border  

  -   
  slightly larger card  

  -   
  “MOST POPULAR” badge