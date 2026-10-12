import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Ban, Download, RefreshCw, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { outreachAction, outreachTable, type OutreachContact } from "@/lib/outreach/api";
import { csvToObjects, downloadText, toCsv } from "@/lib/outreach/csv";
import { mapImportRow, type ImportRow } from "@/lib/outreach/importMapping";
import { isOutreachEligible, outreachIneligibleReason } from "../../../../supabase/functions/_shared/outreach.ts";

const LEGAL_FORMS: [string, string][] = [
  ["limited_company", "Limited company"], ["llp", "LLP"], ["plc", "PLC"], ["public_body", "Public body"],
  ["company_other", "Other company (CIC, charity company)"], ["sole_trader", "Sole trader"], ["partnership", "Partnership"],
  ["charity_unincorporated", "Unincorporated charity"], ["unknown", "Unknown"],
];

type ImportResult = { upserted: number; rejected: { row: number; reason: string }[]; suppressed_on_import: number; eligible_in_batch: number };

export function OutreachContacts() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<OutreachContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [eligibility, setEligibility] = useState("all");
  const [category, setCategory] = useState("all");
  const [editing, setEditing] = useState<OutreachContact | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importSkipped, setImportSkipped] = useState(0);
  const [importName, setImportName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const all: OutreachContact[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await outreachTable("outreach_contacts").select("*").order("business_name").range(from, from + 999);
      if (error) {
        toast({ title: "Couldn't load contacts", description: error.message, variant: "destructive" });
        break;
      }
      all.push(...((data ?? []) as unknown as OutreachContact[]));
      if (!data || data.length < 1000) break;
    }
    setContacts(all);
    setLoading(false);
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => [...new Set(contacts.map((c) => c.category).filter(Boolean) as string[])].sort(), [contacts]);
  const filtered = useMemo(() => contacts.filter((c) => {
    if (eligibility === "eligible" && !c.eligible) return false;
    if (eligibility === "not_eligible" && c.eligible) return false;
    if (category !== "all" && c.category !== category) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return [c.business_name, c.email, c.postcode, c.district, c.companies_house_number].some((v) => (v ?? "").toLowerCase().includes(q));
  }), [contacts, eligibility, category, search]);
  const eligibleCount = useMemo(() => contacts.filter((c) => c.eligible).length, [contacts]);

  const onFile = async (file: File) => {
    const text = await file.text();
    const objects = csvToObjects(text);
    const mapped: ImportRow[] = [];
    let skipped = 0;
    for (const o of objects) {
      const r = mapImportRow(o);
      if (r) mapped.push(r); else skipped++;
    }
    setImportRows(mapped);
    setImportSkipped(skipped);
    setImportName(file.name.replace(/\.csv$/i, ""));
    setImportResult(null);
  };

  const previewEligible = useMemo(() => importRows.filter((r) => isOutreachEligible({
    status: "active",
    lawful_basis: r.companies_house_verified ? "corporate_subscriber" : "none",
    companies_house_verified: Boolean(r.companies_house_verified),
    companies_house_number: r.companies_house_number ?? null,
    legal_form: r.legal_form ?? "unknown",
    email_type: r.email_type ?? "unknown",
    consent_evidence: null,
  })).length, [importRows]);

  const runImport = async () => {
    setImporting(true);
    const total: ImportResult = { upserted: 0, rejected: [], suppressed_on_import: 0, eligible_in_batch: 0 };
    const batch = `${importName || "import"}-${format(new Date(), "yyyyMMdd-HHmm")}`.slice(0, 120);
    try {
      for (let i = 0; i < importRows.length; i += 1000) {
        const r = await outreachAction<ImportResult>("import_contacts", { rows: importRows.slice(i, i + 1000), import_batch: batch });
        total.upserted += r.upserted;
        total.rejected.push(...r.rejected.map((x) => ({ ...x, row: x.row + i })));
        total.suppressed_on_import += r.suppressed_on_import;
        total.eligible_in_batch = r.eligible_in_batch;
      }
      setImportResult(total);
      setImportRows([]);
      await load();
    } catch (e) {
      toast({ title: "Import failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const saveContact = async () => {
    if (!editing) return;
    const lawful = editing.lawful_basis;
    const { error } = await outreachTable("outreach_contacts").update({
      business_name: editing.business_name.trim(),
      category: editing.category || null,
      district: editing.district ? editing.district.toUpperCase() : null,
      legal_form: editing.legal_form,
      email_type: editing.email_type,
      companies_house_number: editing.companies_house_number ? editing.companies_house_number.trim().toUpperCase() : null,
      companies_house_verified: editing.companies_house_verified && Boolean(editing.companies_house_number),
      lawful_basis: lawful,
      consent_evidence: lawful === "consent" ? (editing.consent_evidence ?? "").trim() || null : editing.consent_evidence,
      priority: editing.priority || null,
      notes: editing.notes || null,
    } as never).eq("id", editing.id);
    if (error) return toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
    toast({ title: "Contact saved" });
    setEditing(null);
    load();
  };

  const doNotContact = async (c: OutreachContact) => {
    if (!window.confirm(`Stop emailing ${c.email}? This also cancels anything waiting to send to them.`)) return;
    try {
      await outreachAction("suppress", { email: c.email, note: "Marked do-not-contact from Contacts" });
      toast({ title: `${c.email} will not be emailed` });
      load();
    } catch (e) {
      toast({ title: "Couldn't update", description: (e as Error).message, variant: "destructive" });
    }
  };

  const exportCsv = () => {
    const rows = [
      ["business_name", "email", "email_type", "category", "district", "postcode", "legal_form", "companies_house_number", "companies_house_verified", "lawful_basis", "priority", "status", "eligible", "why_not", "last_contacted_at"],
      ...filtered.map((c) => [c.business_name, c.email, c.email_type, c.category, c.district, c.postcode, c.legal_form, c.companies_house_number, String(c.companies_house_verified), c.lawful_basis, c.priority, c.status, String(c.eligible), outreachIneligibleReason(c) ?? "", c.last_contacted_at]),
    ];
    downloadText(`outreach-contacts-${format(new Date(), "yyyyMMdd")}.csv`, toCsv(rows));
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{filtered.length} shown · {contacts.length} contacts · <strong>{eligibleCount} can be emailed</strong></p>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 w-56" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={eligibility} onValueChange={setEligibility}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              <SelectItem value="eligible">Can be emailed</SelectItem>
              <SelectItem value="not_eligible">Can't be emailed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> CSV</Button>
          <Button variant="outline" size="icon" onClick={load} aria-label="Refresh contacts"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>
          <Button onClick={() => { setImportOpen(true); setImportResult(null); setImportRows([]); }}><Upload className="h-4 w-4 mr-1" /> Import CSV</Button>
        </div>
      </div>

      <div className="border-4 border-foreground bg-background shadow-brutal overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Can email?</TableHead>
              <TableHead>Last emailed</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && !loading && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">No contacts. Use Import CSV to add your lead list.</TableCell></TableRow>
            )}
            {filtered.slice(0, 500).map((c) => {
              const reason = outreachIneligibleReason(c);
              return (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setEditing({ ...c })}>
                  <TableCell>
                    <div className="font-semibold">{c.business_name}</div>
                    <div className="text-xs text-muted-foreground">{c.email} · {c.email_type}</div>
                  </TableCell>
                  <TableCell className="text-xs">{c.category ?? "—"}<div className="text-muted-foreground">{c.district ?? ""}{c.priority ? ` · ${c.priority}` : ""}</div></TableCell>
                  <TableCell className="text-xs">
                    {LEGAL_FORMS.find(([k]) => k === c.legal_form)?.[1] ?? c.legal_form}
                    {c.companies_house_number && (
                      <div>
                        <a className="underline" target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                          href={`https://find-and-update.company-information.service.gov.uk/company/${encodeURIComponent(c.companies_house_number)}`}>
                          {c.companies_house_number}
                        </a>{c.companies_house_verified ? " ✓" : ""}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.eligible ? <Badge className="bg-green-100 text-green-800">Yes</Badge> : <span className="text-xs text-muted-foreground">{reason}</span>}
                  </TableCell>
                  <TableCell className="text-xs">{c.last_contacted_at ? format(new Date(c.last_contacted_at), "dd MMM yyyy") : "—"}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {c.status === "active" && (
                      <Button size="sm" variant="ghost" onClick={() => doNotContact(c)} aria-label={`Do not contact ${c.email}`}><Ban className="h-4 w-4" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filtered.length > 500 && <p className="text-xs text-muted-foreground p-3">Showing the first 500. Use search or filters to narrow down.</p>}
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Import contacts from CSV</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p>Use your lead-list export or a CSV with columns <code>business_name, email, category, district, postcode, legal_form, companies_house_number, companies_house_verified, priority</code>.</p>
            <p className="text-muted-foreground">Contacts are only emailable when Companies House confirms they're a company and the address is a general inbox. Existing contacts are updated, and anyone who opted out stays opted out.</p>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
            <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1" /> Choose CSV file</Button>
            {importRows.length > 0 && (
              <div className="border-4 border-foreground p-3 space-y-1">
                <div><strong>{importRows.length}</strong> rows ready{importSkipped ? ` · ${importSkipped} skipped (no valid email or name)` : ""}</div>
                <div><strong>{previewEligible}</strong> will be emailable straight away</div>
              </div>
            )}
            {importResult && (
              <div className="border-4 border-green-700 bg-green-50 p-3 space-y-1">
                <div>Imported or updated <strong>{importResult.upserted}</strong> contacts.</div>
                <div>{importResult.eligible_in_batch} in this import can be emailed.</div>
                {importResult.suppressed_on_import > 0 && <div>{importResult.suppressed_on_import} were already on the do-not-contact list and stay blocked.</div>}
                {importResult.rejected.length > 0 && <div>{importResult.rejected.length} rows rejected (e.g. row {importResult.rejected[0].row}: {importResult.rejected[0].reason}).</div>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Close</Button>
            <Button onClick={runImport} disabled={importing || importRows.length === 0}>{importing ? "Importing…" : `Import ${importRows.length}`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.business_name}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div className="md:col-span-2 text-muted-foreground">{editing.email} · {editing.status}{editing.website ? ` · ${editing.website}` : ""}</div>
              <div><Label>Business name</Label><Input value={editing.business_name} onChange={(e) => setEditing({ ...editing, business_name: e.target.value })} /></div>
              <div><Label>Category</Label><Input value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></div>
              <div>
                <Label>Legal form</Label>
                <Select value={editing.legal_form} onValueChange={(v) => setEditing({ ...editing, legal_form: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEGAL_FORMS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Inbox type</Label>
                <Select value={editing.email_type} onValueChange={(v) => setEditing({ ...editing, email_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="role">General (info@, hello@…)</SelectItem>
                    <SelectItem value="personal">Named person</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Companies House number</Label><Input value={editing.companies_house_number ?? ""} onChange={(e) => setEditing({ ...editing, companies_house_number: e.target.value })} /></div>
              <div className="flex items-end gap-2 pb-2">
                <Switch checked={editing.companies_house_verified} onCheckedChange={(v) => setEditing({ ...editing, companies_house_verified: v })} id="oc-ch" />
                <Label htmlFor="oc-ch">Checked on Companies House (active, name matches)</Label>
              </div>
              <div>
                <Label>Lawful basis</Label>
                <Select value={editing.lawful_basis} onValueChange={(v) => setEditing({ ...editing, lawful_basis: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corporate_subscriber">Company (no consent needed)</SelectItem>
                    <SelectItem value="consent">They gave consent</SelectItem>
                    <SelectItem value="none">None recorded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={editing.priority ?? "none"} onValueChange={(v) => setEditing({ ...editing, priority: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="B">B</SelectItem>
                    <SelectItem value="C">C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editing.lawful_basis === "consent" && (
                <div className="md:col-span-2">
                  <Label>Consent evidence (who, when, how)</Label>
                  <Textarea rows={2} value={editing.consent_evidence ?? ""} onChange={(e) => setEditing({ ...editing, consent_evidence: e.target.value })} placeholder="e.g. Jane Smith ticked the marketing box on our stand sign-up form, 1 Oct 2026" />
                </div>
              )}
              <div className="md:col-span-2"><Label>Notes</Label><Textarea rows={2} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
              {editing.why_good_fit && <div className="md:col-span-2 text-xs text-muted-foreground">Why a good fit: {editing.why_good_fit}</div>}
              <div className="md:col-span-2 border-4 border-foreground p-2">
                {(() => {
                  const r = outreachIneligibleReason({ ...editing, companies_house_verified: editing.companies_house_verified && Boolean(editing.companies_house_number) });
                  return r ? <span>Can't be emailed: {r}</span> : <span className="text-green-700 font-semibold">Can be emailed</span>;
                })()}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveContact}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
