
# Admin Communications Module Implementation Plan

## Overview

This plan adds a comprehensive Communications module to the OCCTA Admin panel, enabling admins to create email templates and send bulk emails to customers. The module includes delivery tracking (sent/opened) and integrates seamlessly with the existing infrastructure.

---

## Architecture Summary

```text
+-------------------+     +-------------------+     +-------------------+
|   Admin UI        |     |  Edge Functions   |     |   Database        |
+-------------------+     +-------------------+     +-------------------+
| /admin/comms      |---->| bulk-send-email   |---->| email_templates   |
| - Templates Tab   |     | - Renders vars    |     | email_campaigns   |
| - Campaigns Tab   |     | - Batches (50)    |     | campaign_recips   |
|                   |     | - Logs sends      |     | communications_log|
|                   |     +-------------------+     |   (extended)      |
|                   |     | email-open-track  |     +-------------------+
|                   |---->| - 1x1 pixel       |
|                   |     | - Updates opened  |
+-------------------+     +-------------------+
```

---

## Phase 1: Database Schema

### 1.1 New Table: `email_templates`

Stores reusable email templates with variable support.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| template_name | text | Unique, required |
| subject | text | Email subject line |
| html_body | text | HTML content with {{variables}} |
| text_body | text | Optional plain-text fallback |
| category | text | "general", "billing", "service", "compliance" |
| is_active | boolean | Soft-delete/disable |
| created_by | uuid | FK to profiles (admin who created) |
| created_at | timestamptz | Auto |
| updated_at | timestamptz | Auto-updated |

**RLS Policy**: Admin-only access via `has_role(auth.uid(), 'admin')`.

### 1.2 New Table: `email_campaigns`

Tracks each bulk send operation.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| campaign_name | text | Admin-defined name |
| template_id | uuid | FK to email_templates |
| status | text | "draft", "sending", "completed", "failed" |
| recipient_count | int | Total recipients |
| sent_count | int | Successfully sent |
| failed_count | int | Failed sends |
| created_by | uuid | FK to profiles |
| started_at | timestamptz | When sending began |
| completed_at | timestamptz | When finished |
| created_at | timestamptz | Auto |

**RLS Policy**: Admin-only access.

### 1.3 New Table: `campaign_recipients`

Per-recipient tracking for each campaign.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| campaign_id | uuid | FK to email_campaigns |
| user_id | uuid | FK to profiles |
| recipient_email | text | Email address used |
| status | text | "queued", "sent", "delivered", "opened", "bounced", "failed" |
| error_message | text | If failed |
| sent_at | timestamptz | When sent |
| delivered_at | timestamptz | Provider delivery confirmation |
| opened_at | timestamptz | Open tracking pixel |
| communication_log_id | uuid | FK to communications_log (links to audit) |
| created_at | timestamptz | Auto |

**RLS Policy**: Admin-only access.

### 1.4 Extend `communications_log`

Add optional campaign tracking fields:

| New Column | Type | Notes |
|------------|------|-------|
| campaign_id | uuid | FK to email_campaigns (nullable) |
| campaign_recipient_id | uuid | FK to campaign_recipients (nullable) |

This allows existing invoice/billing email logging to remain unchanged while campaign emails are also tracked.

---

## Phase 2: Edge Functions

### 2.1 New Function: `bulk-send-email`

**Purpose**: Accept template + recipients, render variables, send in batches, log results.

**Endpoint**: `POST /functions/v1/bulk-send-email`

**Request Body**:
```json
{
  "template_id": "uuid",
  "campaign_name": "February Newsletter",
  "recipient_user_ids": ["uuid1", "uuid2", ...],
  "filter": { "all": true } | { "status": "active" }
}
```

**Logic**:
1. Validate admin JWT
2. Create `email_campaigns` record (status: "sending")
3. Fetch template and recipient profiles
4. For each recipient (batched 50 at a time):
   - Render variables: `{{first_name}}`, `{{full_name}}`, `{{account_number}}`, etc.
   - Inject open tracking pixel: `<img src="https://...functions/v1/email-open-track?id=LOG_ID" width="1" height="1">`
   - Send via Resend (reuse existing patterns)
   - Create `campaign_recipients` record
   - Create `communications_log` record with `campaign_id`
5. Update campaign stats (sent_count, failed_count)
6. Mark campaign "completed" or "failed"

**Variables Supported**:
- `{{first_name}}` - First word of full_name
- `{{last_name}}` - Remaining words of full_name
- `{{full_name}}` - Complete name
- `{{account_number}}` - OCC account number
- `{{email}}` - Customer email
- `{{phone}}` - Customer phone
- `{{support_email}}` - From companyConfig (support@occta.co.uk)
- `{{support_phone}}` - From companyConfig (0800 260 6626)
- `{{company_name}}` - "OCCTA Limited"

### 2.2 New Function: `email-open-track`

**Purpose**: 1x1 transparent pixel that updates `opened_at` timestamp.

**Endpoint**: `GET /functions/v1/email-open-track?id=LOG_ID`

**Logic**:
1. Parse `id` query param (this is the communications_log.id)
2. Update `communications_log` set `opened_at = now()` where id matches
3. Also update `campaign_recipients.opened_at` if linked
4. Return 1x1 transparent GIF

**Response Headers**:
```
Content-Type: image/gif
Cache-Control: no-cache, no-store, must-revalidate
```

---

## Phase 3: Admin UI Components

### 3.1 New Page: `src/pages/admin/Communications.tsx`

Main page with two tabs:
- **Templates** - CRUD for email templates
- **Campaigns** - Create/view/manage campaigns

### 3.2 Templates Tab Components

**Template List**:
- Table: name, category, subject preview, last updated, actions
- Actions: Edit, Duplicate, Delete (soft)
- "Create Template" button

**Template Editor Dialog**:
- Form fields: name (unique), category dropdown, subject, html_body (textarea with variable hints), text_body (optional)
- Variable helper: clickable chips to insert `{{variable}}`
- Preview button: renders with sample data

### 3.3 Campaigns Tab Components

**Campaign List**:
- Table: name, template used, recipient count, sent/opened stats, status, created date
- Click row to view details

**Create Campaign Dialog**:
1. **Step 1 - Recipients**:
   - Radio options: "All customers", "Active only", "Suspended only", "Select individuals"
   - If individuals: searchable customer picker (reuse CustomerPicker pattern)
   - Show recipient count

2. **Step 2 - Template**:
   - Dropdown of active templates
   - Preview pane showing rendered HTML with first recipient's data

3. **Step 3 - Confirm & Send**:
   - Campaign name input
   - Summary: X recipients, template Y
   - "Send Now" button

**Campaign Detail View**:
- Header: campaign name, status, created by, dates
- Stats cards: Total, Sent, Delivered, Opened, Failed
- Recipients table with status, timestamps, error messages
- Filterable by status

### 3.4 Navigation Update

Add to `AdminLayout.tsx` navItems:
```typescript
{ label: "Communications", to: "/admin/communications", icon: Send }
```

---

## Phase 4: Routing

### 4.1 Update `src/App.tsx`

Add route under admin:
```typescript
<Route path="communications" element={<AdminCommunications />} />
```

---

## Phase 5: File Structure

```
src/
  pages/admin/
    Communications.tsx              # Main page with tabs
  components/admin/communications/
    TemplatesTab.tsx                # Template list + CRUD
    TemplateEditorDialog.tsx        # Create/edit template form
    CampaignsTab.tsx                # Campaign list
    CreateCampaignDialog.tsx        # Multi-step campaign wizard
    CampaignDetailDialog.tsx        # View campaign results
    RecipientPicker.tsx             # Customer selection component
    VariableHelper.tsx              # Clickable variable chips

supabase/functions/
  bulk-send-email/
    index.ts                        # Main function
  email-open-track/
    index.ts                        # Open tracking pixel
```

---

## Technical Details

### Email HTML Escaping

All user-provided data rendered into emails MUST use `escapeHtml()` helper (already exists in send-email) to prevent XSS/injection.

### Batch Processing

The bulk-send-email function processes 50 emails per batch with a small delay between batches to avoid rate limits and timeouts. Function timeout is set to 60 seconds; larger campaigns are processed incrementally.

### Company Config Integration

Variables like `{{support_email}}` and `{{support_phone}}` are rendered using values from `src/lib/companyConfig.ts` (replicated in edge function as constants to avoid import issues).

### Design System Compliance

All UI components follow OCCTA brutalist design:
- `border-4 border-foreground`
- Yellow (`bg-primary`) for CTAs only
- Monochrome palette
- Font: system/display fonts per existing patterns

### Existing Functions Unchanged

- `send-email/index.ts`: No changes to existing template logic
- `communications_log`: Existing invoice/payment logs continue to work; campaign_id is nullable

---

## Verification & Testing

### Testing Open Tracking

1. Create a template with any content
2. Send to a test email
3. Open the email in a client that loads images
4. Check database: `communications_log.opened_at` should be populated

### Testing Campaign Flow

1. Create template
2. Create campaign with 2-3 test recipients
3. Verify campaign status changes: draft → sending → completed
4. Verify `campaign_recipients` records created with correct statuses
5. Verify emails received with properly rendered variables

### Existing Functionality Check

1. Send an invoice email via Admin Billing
2. Confirm it still works and logs to `communications_log` without campaign_id
3. Send a payment link
4. Confirm existing flow unchanged

---

## Summary of Deliverables

| Category | Items |
|----------|-------|
| **Database** | 3 new tables + 2 columns added to communications_log |
| **Edge Functions** | 2 new functions: bulk-send-email, email-open-track |
| **Admin UI** | 1 new page with 2 tabs, 6+ new components |
| **Routing** | 1 new admin route + nav link |
| **Config** | supabase/config.toml updated for new functions |
