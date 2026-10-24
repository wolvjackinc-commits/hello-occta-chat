import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, Plus, QrCode, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { downloadText, toCsv } from "@/lib/outreach/csv";
import {
  COMMISSION_STATUS_LABEL,
  type CommissionStatus,
  formatGbp,
  listPartnerReferrals,
  listPartners,
  type Partner,
  type PartnerInput,
  type PartnerReferral,
  partnerErrorMessage,
  partnerShortUrl,
  recordPartnerPayout,
  savePartner,
  suggestPartnerCode,
  summariseReferrals,
  validPartnerCode,
} from "@/lib/partners/partners";

const EMPTY_INPUT: PartnerInput = {
  code: "",
  display_name: "",
  partner_type: "letting_agent",
  contact_name: null,
  contact_email: null,
  contact_phone: null,
  website: null,
  address: null,
  postcode: null,
  commission_amount: 25,
  payout_note: null,
  status: "active",
  notes: null,
};

const STATUS_VARIANT: Record<CommissionStatus, "default" | "secondary" | "destructive" | "outline"> = {
  eligible: "default",
  paid: "secondary",
  awaiting_payments: "outline",
  on_hold: "destructive",
  not_eligible: "outline",
};

const todayLondon = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const nullIfBlank = (v: string) => (v.trim() ? v.trim() : null);

function welcomeSnippet(p: Partner): string {
  return `Need broadband for your new home? Our partner OCCTA offers 30-day rolling broadband where available, with the full price shown before you order. Get set up at ${partnerShortUrl(p.code)} (reference ${p.code}).`;
}

export const AdminPartners = () => {
  const { toast } = useToast();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [referrals, setReferrals] = useState<PartnerReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterPartner, setFilterPartner] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [editing, setEditing] = useState<Partner | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<PartnerInput>(EMPTY_INPUT);
  const [codeTouched, setCodeTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const [linkFor, setLinkFor] = useState<Partner | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const [payFor, setPayFor] = useState<PartnerReferral | null>(null);
  const [paidOn, setPaidOn] = useState(todayLondon());
  const [bankRef, setBankRef] = useState("");
  const [payNote, setPayNote] = useState("");
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [p, r] = await Promise.all([listPartners(), listPartnerReferrals()]);
      setPartners(p);
      setReferrals(r);
    } catch (error) {
      setLoadError(partnerErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const byPartner = useMemo(() => {
    const map = new Map<string, PartnerReferral[]>();
    for (const r of referrals) map.set(r.partner_id, [...(map.get(r.partner_id) ?? []), r]);
    return map;
  }, [referrals]);

  const totals = useMemo(() => summariseReferrals(referrals), [referrals]);

  const visibleReferrals = useMemo(
    () => referrals.filter((r) =>
      (filterPartner === "all" || r.partner_id === filterPartner)
      && (filterStatus === "all" || r.commission_status === filterStatus)),
    [referrals, filterPartner, filterStatus],
  );

  /* ---------- partner form ---------- */

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_INPUT);
    setCodeTouched(false);
    setFormOpen(true);
  };

  const openEdit = (p: Partner) => {
    setEditing(p);
    const { id: _id, created_at: _created, ...rest } = p;
    setForm(rest);
    setCodeTouched(true);
    setFormOpen(true);
  };

  const update = <K extends keyof PartnerInput>(key: K, value: PartnerInput[K]) =>
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "display_name" && !codeTouched && !editing) next.code = suggestPartnerCode(String(value));
      return next;
    });

  const submitPartner = async () => {
    const code = validPartnerCode(form.code);
    if (!form.display_name.trim()) return toast({ variant: "destructive", title: "Enter the partner's name." });
    if (!code) return toast({ variant: "destructive", title: "Codes use 3–24 letters, numbers or hyphens." });
    if (!(form.commission_amount >= 0 && form.commission_amount <= 500)) {
      return toast({ variant: "destructive", title: "Commission must be between £0 and £500." });
    }
    setSaving(true);
    try {
      await savePartner({ ...form, code }, editing?.id);
      toast({ title: editing ? "Partner updated" : "Partner added", description: `Code ${code}` });
      setFormOpen(false);
      await load();
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't save", description: partnerErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  /* ---------- link & QR ---------- */

  const openLink = async (p: Partner) => {
    setLinkFor(p);
    setQrDataUrl(null);
    try {
      const url = await QRCode.toDataURL(partnerShortUrl(p.code), { errorCorrectionLevel: "M", margin: 2, width: 720 });
      setQrDataUrl(url);
    } catch {
      setQrDataUrl(null);
    }
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${what} copied` });
    } catch {
      toast({ variant: "destructive", title: "Copy failed", description: "Select the text and copy it manually." });
    }
  };

  /* ---------- payouts ---------- */

  const openPay = (r: PartnerReferral) => {
    setPayFor(r);
    setPaidOn(todayLondon());
    setBankRef(`OCCTA ${r.partner_code}`.slice(0, 18));
    setPayNote("");
  };

  const submitPay = async () => {
    if (!payFor) return;
    if (!bankRef.trim()) return toast({ variant: "destructive", title: "Enter the bank transfer reference." });
    setPaying(true);
    try {
      await recordPartnerPayout(payFor.order_id, paidOn, bankRef, payNote || undefined);
      toast({ title: "Payment recorded", description: `${formatGbp(payFor.commission_amount)} to ${payFor.partner_name}` });
      setPayFor(null);
      await load();
    } catch (error) {
      toast({ variant: "destructive", title: "Not recorded", description: partnerErrorMessage(error) });
    } finally {
      setPaying(false);
    }
  };

  const exportReferrals = () => {
    const rows: (string | number | null)[][] = [[
      "Partner", "Code", "Order", "Order date", "Plan", "Attributed by", "Payments received",
      "Status", "Reason", "Commission (GBP)", "Paid on", "Bank reference",
    ]];
    for (const r of visibleReferrals) {
      rows.push([
        r.partner_name, r.partner_code, r.order_number ?? r.order_id, r.order_created_at.slice(0, 10), r.plan_name,
        r.attributed_by === "link" ? "Partner link" : "Typed code", r.paid_invoices,
        COMMISSION_STATUS_LABEL[r.commission_status], r.status_reason, r.commission_amount.toFixed(2),
        r.paid_on, r.bank_reference,
      ]);
    }
    downloadText(`partner-referrals-${todayLondon()}.csv`, toCsv(rows));
  };

  return (
    <div className="space-y-8 p-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display uppercase text-3xl">Partners</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Letting agents and landlords who send tenants to OCCTA. Commission becomes ready to pay once a referred
            order has two paid broadband invoices, isn't cancelled and the customer isn't in arrears. Record each bank
            transfer here; payments are never sent automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-1 h-4 w-4" /> Refresh
          </Button>
          <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Add partner</Button>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="border-4 border-destructive p-4 text-sm">
          Couldn't load partners: {loadError}. If this is a new install, the partner programme migration may not be applied yet.
        </div>
      )}

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Active partners", value: String(partners.filter((p) => p.status === "active").length) },
          { label: "Referred orders", value: String(totals.referrals) },
          { label: "Ready to pay", value: formatGbp(totals.due) },
          { label: "Paid to date", value: formatGbp(totals.paid) },
        ].map((t) => (
          <div key={t.label} className="border-4 border-foreground p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.label}</p>
            <p className="mt-1 font-display text-2xl">{t.value}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 font-display uppercase">Partners</h2>
        <div className="overflow-x-auto border-4 border-foreground">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Referrals</TableHead>
                <TableHead className="text-right">Ready to pay</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && partners.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No partners yet. Add a letting agent to get their link and QR code.
                  </TableCell>
                </TableRow>
              )}
              {partners.map((p) => {
                const rows = byPartner.get(p.id) ?? [];
                const s = summariseReferrals(rows);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-semibold">{p.display_name}</div>
                      <div className="text-xs text-muted-foreground">{p.partner_type.replace("_", " ")} · {formatGbp(p.commission_amount)} per tenant</div>
                    </TableCell>
                    <TableCell className="font-mono">{p.code}</TableCell>
                    <TableCell className="text-sm">
                      <div>{p.contact_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{[p.contact_email, p.contact_phone].filter(Boolean).join(" · ") || "No contact details"}</div>
                    </TableCell>
                    <TableCell><Badge variant={p.status === "active" ? "default" : "outline"}>{p.status}</Badge></TableCell>
                    <TableCell className="text-right">{s.referrals}</TableCell>
                    <TableCell className="text-right">{formatGbp(s.due)}</TableCell>
                    <TableCell className="space-x-2 whitespace-nowrap text-right">
                      <Button size="sm" variant="outline" onClick={() => void openLink(p)}><QrCode className="mr-1 h-4 w-4" /> Link &amp; QR</Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(p)}>Edit</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display uppercase">Referred orders</h2>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="filter-partner" className="text-xs">Partner</Label>
              <Select value={filterPartner} onValueChange={setFilterPartner}>
                <SelectTrigger id="filter-partner" className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All partners</SelectItem>
                  {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="filter-status" className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger id="filter-status" className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {(Object.keys(COMMISSION_STATUS_LABEL) as CommissionStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{COMMISSION_STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={exportReferrals} disabled={!visibleReferrals.length}>
              <Download className="mr-1 h-4 w-4" /> CSV
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto border-4 border-foreground">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Payments</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && visibleReferrals.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No referred orders yet. They appear here as soon as a tenant orders through a partner link or code.
                  </TableCell>
                </TableRow>
              )}
              {visibleReferrals.map((r) => (
                <TableRow key={r.order_id}>
                  <TableCell>
                    <div className="font-mono text-sm">{r.order_number ?? r.order_id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">{new Date(r.order_created_at).toLocaleDateString("en-GB")} · {r.attributed_by === "link" ? "partner link" : "typed code"}</div>
                  </TableCell>
                  <TableCell>{r.partner_name} <span className="font-mono text-xs text-muted-foreground">{r.partner_code}</span></TableCell>
                  <TableCell className="text-sm">{r.plan_name ?? "—"}</TableCell>
                  <TableCell>{Math.min(r.paid_invoices, 2)} of 2</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[r.commission_status]}>{COMMISSION_STATUS_LABEL[r.commission_status]}</Badge>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {r.commission_status === "paid" && r.paid_on ? `Paid ${new Date(r.paid_on).toLocaleDateString("en-GB")} · ${r.bank_reference}` : r.status_reason}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatGbp(r.commission_amount)}</TableCell>
                  <TableCell className="text-right">
                    {r.commission_status === "eligible" && (
                      <Button size="sm" onClick={() => openPay(r)}>Record payment</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Add / edit partner */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.display_name}` : "Add partner"}</DialogTitle>
            <DialogDescription>The code is what tenants see on the flyer and can type in the order form.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="p-name">Business name</Label>
              <Input id="p-name" value={form.display_name} onChange={(e) => update("display_name", e.target.value)} placeholder="Vanilla Lettings" />
            </div>
            <div>
              <Label htmlFor="p-code">Partner code</Label>
              <Input id="p-code" className="font-mono" value={form.code}
                onChange={(e) => { setCodeTouched(true); update("code", e.target.value.toUpperCase()); }} />
            </div>
            <div>
              <Label htmlFor="p-type">Type</Label>
              <Select value={form.partner_type} onValueChange={(v) => update("partner_type", v as PartnerInput["partner_type"])}>
                <SelectTrigger id="p-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="letting_agent">Letting agent</SelectItem>
                  <SelectItem value="landlord">Landlord</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="p-contact">Contact name</Label>
              <Input id="p-contact" value={form.contact_name ?? ""} onChange={(e) => update("contact_name", nullIfBlank(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="p-email">Contact email</Label>
              <Input id="p-email" type="email" value={form.contact_email ?? ""} onChange={(e) => update("contact_email", nullIfBlank(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="p-phone">Phone</Label>
              <Input id="p-phone" type="tel" value={form.contact_phone ?? ""} onChange={(e) => update("contact_phone", nullIfBlank(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="p-web">Website</Label>
              <Input id="p-web" value={form.website ?? ""} onChange={(e) => update("website", nullIfBlank(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="p-address">Address</Label>
              <Input id="p-address" value={form.address ?? ""} onChange={(e) => update("address", nullIfBlank(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="p-postcode">Postcode</Label>
              <Input id="p-postcode" value={form.postcode ?? ""} onChange={(e) => update("postcode", nullIfBlank(e.target.value.toUpperCase()))} />
            </div>
            <div>
              <Label htmlFor="p-commission">Commission per tenant (£)</Label>
              <Input id="p-commission" type="number" min={0} max={500} step="0.01" value={form.commission_amount}
                onChange={(e) => update("commission_amount", Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="p-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => update("status", v as PartnerInput["status"])}>
                <SelectTrigger id="p-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused (link stops crediting)</SelectItem>
                  <SelectItem value="ended">Ended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="p-payout">How we pay them</Label>
              <Input id="p-payout" value={form.payout_note ?? ""} onChange={(e) => update("payout_note", nullIfBlank(e.target.value))}
                placeholder="e.g. bank details held in accounts software — never type account numbers here" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="p-notes">Notes</Label>
              <Textarea id="p-notes" value={form.notes ?? ""} onChange={(e) => update("notes", nullIfBlank(e.target.value))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={() => void submitPartner()} disabled={saving}>{saving ? "Saving…" : "Save partner"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link & QR */}
      <Dialog open={!!linkFor} onOpenChange={(o) => { if (!o) setLinkFor(null); }}>
        <DialogContent className="sm:max-w-lg">
          {linkFor && (
            <>
              <DialogHeader>
                <DialogTitle>{linkFor.display_name}: link and QR code</DialogTitle>
                <DialogDescription>Put the QR code on their flyer and the link in their tenant welcome email.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="p-link">Tenant link</Label>
                  <div className="flex gap-2">
                    <Input id="p-link" readOnly value={partnerShortUrl(linkFor.code)} className="font-mono" />
                    <Button variant="outline" onClick={() => void copy(partnerShortUrl(linkFor.code), "Link")} aria-label="Copy link"><Copy className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt={`QR code for ${partnerShortUrl(linkFor.code)}`} className="h-40 w-40 border-2 border-foreground" />
                  ) : (
                    <div className="flex h-40 w-40 items-center justify-center border-2 border-dashed border-foreground text-xs text-muted-foreground">Generating…</div>
                  )}
                  <div className="space-y-2 text-sm">
                    <p>Tenants who scan this land on a page that names <strong>{linkFor.display_name}</strong>, and their order is credited automatically for 30 days.</p>
                    {qrDataUrl && (
                      <Button asChild variant="outline" size="sm">
                        <a href={qrDataUrl} download={`occta-partner-${linkFor.code}.png`}><Download className="mr-1 h-4 w-4" /> Download PNG</a>
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="p-snippet">Line for their welcome email</Label>
                  <Textarea id="p-snippet" readOnly rows={4} value={welcomeSnippet(linkFor)} />
                  <Button className="mt-2" variant="outline" size="sm" onClick={() => void copy(welcomeSnippet(linkFor), "Text")}>
                    <Copy className="mr-1 h-4 w-4" /> Copy text
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Record payout */}
      <Dialog open={!!payFor} onOpenChange={(o) => { if (!o) setPayFor(null); }}>
        <DialogContent className="sm:max-w-md">
          {payFor && (
            <>
              <DialogHeader>
                <DialogTitle>Record commission payment</DialogTitle>
                <DialogDescription>
                  Record this only after the bank transfer of {formatGbp(payFor.commission_amount)} to {payFor.partner_name} has left your account.
                  It can't be edited afterwards.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="pay-date">Date paid</Label>
                  <Input id="pay-date" type="date" value={paidOn} max={todayLondon()} onChange={(e) => setPaidOn(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="pay-ref">Bank transfer reference</Label>
                  <Input id="pay-ref" value={bankRef} maxLength={120} onChange={(e) => setBankRef(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="pay-note">Note (optional)</Label>
                  <Input id="pay-note" value={payNote} maxLength={500} onChange={(e) => setPayNote(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPayFor(null)}>Cancel</Button>
                <Button onClick={() => void submitPay()} disabled={paying}>{paying ? "Recording…" : "Record payment"}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPartners;
