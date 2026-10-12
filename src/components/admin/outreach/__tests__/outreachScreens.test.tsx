import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const TEMPLATE = {
  id: "11111111-1111-1111-1111-111111111111",
  template_key: "last-orders-landline",
  name: "Last orders for your landline (LAST-A)",
  flyer_ref: "LAST-A",
  subject: "Is {{business_name}} ready for the landline switch-off?",
  preheader: "Pre",
  body_html: "<p>Hello {{business_name}} team,</p>",
  body_text: "Hello {{business_name}} team,\n{{cta_url}}",
  cta_label: "Book my free line check",
  cta_path: "/business/contact-sales",
  hero_image_url: null,
  is_active: true,
  updated_at: "2026-10-12T10:00:00Z",
};
const SETTINGS = {
  id: 1, sending_enabled: false, from_name: "OCCTA Business", from_email: null, reply_to: "business@occta.co.uk",
  daily_cap: 30, hourly_cap: 15, window_start_hour: 9, window_end_hour: 17, weekdays_only: true,
  recontact_cooldown_days: 30, postal_address: "OCCTA Limited, 22 Pavilion View, Huddersfield, HD3 3WU",
  last_worker_run_at: null, last_worker_result: null,
};
const DATA: Record<string, unknown[]> = {
  outreach_templates: [TEMPLATE],
  outreach_settings: [SETTINGS],
  outreach_campaigns: [],
  outreach_campaign_stats: [],
  outreach_events: [],
  outreach_contacts: [{
    id: "c1", business_name: "Fixby Healthcare Ltd", email: "info@fixbyhealthcare.com", email_type: "role", category: "Care",
    subcategory: null, address: null, postcode: "HD2 1AA", area: null, district: "HD2", phone: null, website: null,
    legal_form: "limited_company", companies_house_number: "13569061", companies_house_verified: true, companies_house_match_basis: null,
    lawful_basis: "corporate_subscriber", consent_evidence: null, priority: "A", tags: [], source: null, source_urls: null,
    why_good_fit: null, notes: null, status: "active", import_batch: null, last_contacted_at: null, eligible: true, created_at: "2026-10-12T10:00:00Z",
  }],
  outreach_suppressions: [],
  outreach_messages: [],
};

// Chainable query stub: every filter returns itself; awaiting resolves to the table's rows.
function query(table: string) {
  const rows = DATA[table] ?? [];
  const result = { data: rows, error: null, count: rows.length };
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "in", "order", "limit", "range", "is", "gte", "lte", "overlaps", "update", "insert", "delete"]) {
    q[m] = () => q;
  }
  q.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null });
  q.single = () => Promise.resolve({ data: rows[0] ?? null, error: null });
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return q;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => query(t),
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1", email: "admin@occta.co.uk" } } }) },
    functions: { invoke: () => Promise.resolve({ data: { ok: true }, error: null }) },
  },
}));

import AdminOutreach from "@/pages/admin/Outreach";
import { OutreachTemplates } from "../OutreachTemplates";
import { OutreachContacts } from "../OutreachContacts";
import { OutreachSuppressions } from "../OutreachSuppressions";
import { OutreachSettingsPanel } from "../OutreachSettingsPanel";
import { OutreachCampaigns } from "../OutreachCampaigns";
import { OutreachDashboard } from "../OutreachDashboard";

const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("outreach admin screens", () => {
  it("renders the page shell with every tab and the sending status", async () => {
    wrap(<AdminOutreach />);
    expect(screen.getByRole("heading", { name: "Outreach" })).toBeInTheDocument();
    for (const t of ["Dashboard", "Campaigns", "Contacts", "Templates", "Do not contact", "Settings"]) {
      expect(screen.getByRole("tab", { name: t })).toBeInTheDocument();
    }
    await waitFor(() => expect(screen.getByText("Sending address not set")).toBeInTheDocument());
  });

  it("renders the dashboard", async () => {
    wrap(<OutreachDashboard onOpenCampaign={() => {}} />);
    await waitFor(() => expect(screen.getByText("Contacts you can email")).toBeInTheDocument());
    expect(screen.getByText("No campaigns yet.")).toBeInTheDocument();
  });

  it("renders campaigns", async () => {
    wrap(<OutreachCampaigns settings={SETTINGS} />);
    await waitFor(() => expect(screen.getByText(/No campaigns yet/)).toBeInTheDocument());
  });

  it("lists templates", async () => {
    wrap(<OutreachTemplates settings={SETTINGS} />);
    await waitFor(() => expect(screen.getByText(TEMPLATE.name)).toBeInTheDocument());
  });

  it("lists contacts and shows who can be emailed", async () => {
    wrap(<OutreachContacts />);
    await waitFor(() => expect(screen.getByText("Fixby Healthcare Ltd")).toBeInTheDocument());
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("renders the do-not-contact list", async () => {
    wrap(<OutreachSuppressions />);
    await waitFor(() => expect(screen.getByText("Nobody on the list.")).toBeInTheDocument());
  });

  it("blocks switching on without a sending address", () => {
    wrap(<OutreachSettingsPanel settings={SETTINGS} onSaved={() => {}} />);
    expect(screen.getByText("Sending is OFF")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Sending on or off" })).toBeDisabled();
    expect(screen.getByText(/outreach-resend-webhook/)).toBeInTheDocument();
  });
});
