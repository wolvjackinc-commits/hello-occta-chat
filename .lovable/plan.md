

# Plan: Add Admin Notification System for New Submissions

## Problem Summary
Currently, admins only receive email notifications for Business Sales inquiries and Business Checkouts. Regular customer orders and support tickets are saved to the database but **do not trigger any admin notification**. This means staff must constantly monitor the admin dashboard to catch new submissions.

## Solution Overview
Implement a unified admin notification system that sends immediate email alerts when critical submissions occur.

## Implementation Steps

### Step 1: Create Admin Notification Edge Function
Create a new edge function `admin-notify` that handles all internal admin notifications.

**Location**: `supabase/functions/admin-notify/index.ts`

**Features**:
- Single endpoint for all admin notification types
- Supports: new_order, new_ticket, new_inquiry, failed_payment
- Sends to configurable admin email(s)
- Uses OCCTA branding
- Includes quick action links to admin dashboard

### Step 2: Update PreCheckout (Guest Orders)
Modify `/src/pages/PreCheckout.tsx` to call the admin notification function after successful order creation.

**Notification will include**:
- Order number
- Customer name and email
- Plan name and price
- Installation address
- Direct link to admin orders page

### Step 3: Update Support Page (Tickets)
Modify `/src/pages/Support.tsx` to notify admins when a new ticket is created.

**Notification will include**:
- Ticket subject and category
- Customer name and email
- Priority level
- Direct link to admin tickets page

### Step 4: Update Logged-in User Checkout
Modify `/src/pages/Checkout.tsx` to notify admins when logged-in users place orders.

### Step 5: Update Config
Add the new function to `supabase/config.toml`.

---

## Technical Details

### Admin Notification Function Structure

```text
supabase/functions/admin-notify/
  └── index.ts
```

**Supported notification types**:
- `new_order` - Customer placed an order
- `new_ticket` - Customer raised support ticket
- `new_guest_order` - Guest placed an order
- `new_business_inquiry` - Business sales lead (currently handled separately)

**Admin recipients**:
- Primary: `hello@occta.co.uk`
- Could be extended to support multiple recipients or role-based routing

### Email Content Example

```text
Subject: 🆕 New Order Received | #ORD-XXXXX

Hi Team,

A new order has been placed:

Order: #ORD-XXXXX
Customer: John Smith (john@example.com)
Plan: OCCTA 150 @ £29.99/mo
Address: 22 High Street, Leeds, LS1 2AB

[View Order in Admin Dashboard →]

---
OCCTA Admin Notifications
```

### Database Trigger Alternative (Optional Enhancement)
For even more reliable notifications, a database trigger could be added to fire on INSERT to `guest_orders`, `orders`, and `support_tickets` tables. This ensures notifications are sent even if the frontend call fails.

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/admin-notify/index.ts` | New edge function for admin notifications |

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/PreCheckout.tsx` | Add admin notification call after order insert |
| `src/pages/Checkout.tsx` | Add admin notification call after order insert |
| `src/pages/Support.tsx` | Add admin notification call after ticket insert |
| `supabase/config.toml` | Register new admin-notify function |

---

## Future Enhancements (Not in Scope)

Once the email notifications are in place, these could be added later:
- **Browser Push Notifications**: Using the existing `src/lib/notifications.ts` PWA infrastructure
- **Slack/Teams Integration**: Webhook to team chat channels
- **SMS Alerts**: For urgent items via Twilio
- **Admin Dashboard Sound Alert**: Audio ping when new items arrive
- **Real-time Badge Counter**: Show unread count in browser tab title

---

## Summary
This plan adds proactive email notifications to `hello@occta.co.uk` whenever:
1. A guest customer places an order
2. A logged-in customer places an order
3. Any customer submits a support ticket

No existing functionality will be changed. Business Sales emails already work and will continue unchanged.

