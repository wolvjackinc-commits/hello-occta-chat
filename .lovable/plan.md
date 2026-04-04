

# Copy, Trust & Micro-UX Refinement Plan

Text-only and content-hierarchy improvements across homepage, broadband page, landline page, checkout, and CTA. Zero layout, logic, or backend changes.

---

## Files Modified (7)

### 1. `src/components/home/HeroSection.tsx` — Hero copy rewrite
- **Headline**: Replace "Cheap UK / Broadband / No Contracts" with "Finally. / Broadband that / doesn't lock you in."
- **Subtext**: Replace current paragraph with "No contracts. No hidden fees. No nonsense. Just fast, reliable internet that works — and lets you leave whenever you want."
- **Service card subtitles**: Update from generic "No contract required" to:
  - Broadband: "No contracts · Cancel anytime"
  - Mobile SIM: "No contracts · Keep your number"
  - Home Phone: "Works with your broadband · No extra line needed"
- **Trust strip**: Replace the "100% British / 98% Recommend Us" footer with a 3-item trust line:
  - "Works on UK's largest network (Openreach)"
  - "24/7 UK-based support"
  - "14-day cooling-off period"
- **CTA helper text**: Add "Switch in under 60 seconds" below the "Check Your Postcode" button

### 2. `src/components/home/WhyUsSection.tsx` — Section copy update
- **Section title**: Change from "WHY PEOPLE ACTUALLY / LIKE US" to "WHY PEOPLE ARE SWITCHING / TO OCCTA"
- **Stamp badge**: Change from "No BS Guarantee" to "Why Switch?"
- **Reason cards** — update titles and descriptions:
  - "NO CONTRACTS" → "Leave anytime. No exit fees. No tricks."
  - "NO PRICE HIKES" → "What you see is what you pay."
  - "QUICK SETUP" → "WE HANDLE THE SWITCH" / "No calls. No stress. We move everything for you."
  - "HUMANS ANSWER" → "UK-BASED SUPPORT" / "Real humans. No scripts."
  - "SMALL BUSINESS, BIG CARE" → "SAME NETWORK AS BIG BRANDS" / "Powered by Openreach infrastructure."
  - "98% RECOMMEND US" — keep as-is (social proof is strong)

### 3. `src/lib/pricing/retailCards.ts` — Broadband plan descriptions
Update the `tagline` and `publicTagline` fields (these feed into the plan cards):
- Essential: "Perfect for browsing, emails, and light streaming"
- Superfast: "Ideal for families, Netflix, and everyday use"
- Ultrafast: "Great for gamers, work-from-home, and heavy usage"
- Gigabit: "Maximum speed for power users and smart homes"

### 4. `src/pages/Broadband.tsx` — Broadband page copy
- **Above plans section header**: Change "ALL PLANS" subtext from "Unlimited data, no price rises. Novel concept." to "Choose your speed — we'll handle the rest"
- **Under each "Choose Plan" button**: Add 3 micro-conversion lines below the plan grid:
  "Setup usually within 7 days · We notify your current provider · No downtime during switch"
  (Single text line below the plans grid, not per-card)
- **Home Phone section heading**: Change "ADD A HOME PHONE" to "ADD A HOME PHONE (OPTIONAL)"
- **Home Phone description**: Update to "Keep your number. Plug into your router. No copper line needed."

### 5. `src/components/home/CTASection.tsx` — CTA copy
- **Headline**: Keep existing (already strong)
- **Button text**: Change "Get Started Now" to "Get Started"
- **Add helper text** below CTA buttons: "Switch in under 60 seconds"
- **Trust note**: Keep existing (already good, no duplication concern since it's the inverted footer section)

### 6. `src/components/layout/Footer.tsx` — Trust section before footer
Add a compact trust bar at the top of the footer (inside the existing component, between the support banner and main footer content):
- "Ofcom regulated UK telecom provider"
- "Secure payments (256-bit encryption)"
- "Transparent pricing — no hidden fees"
- "UK customer support team"
Rendered as a simple horizontal list with shield/lock icons, using existing muted styling.

### 7. `src/pages/PreCheckout.tsx` — Checkout microcopy
- **Page heading**: Already says "COMPLETE YOUR ORDER" — keep
- **Subtitle**: Already says "Fill in your details below and we'll get you connected." — keep
- **Order confirmation list in consent block**: Update the `orderConsent` bullet points to match requested copy:
  - "This is a 30-day rolling service"
  - "Setup charges may apply depending on my line"
  - "My service depends on availability at my address"
  (Remove "I accept all charges shown in the order summary" — redundant with the CTA)
- **Tagline placement**: Add "No contracts. No pressure. Just better broadband." as a subtle line below the "What Happens Next" section, styled as `text-xs text-muted-foreground text-center`

### Also add the tagline in:
- `src/components/home/HeroSection.tsx` — below the trust strip
- `src/pages/Broadband.tsx` — below the plans grid micro-conversion text

---

## What is NOT changed
- No layout or structural changes
- No color/theme changes
- No component additions or removals
- No pricing logic, backend, or routing changes
- No responsive breakpoints affected
- Broadband plan names (ESSENTIAL, SUPERFAST, etc.) remain as-is — only taglines updated

