import { useEffect, useState } from "react";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Phone, Plus, Trash2, Pencil, Star } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

type Contact = {
  id: string;
  business_profile_id: string;
  name: string;
  role: "primary" | "billing" | "technical" | "other";
  email: string;
  phone: string | null;
  receives_invoices: boolean;
  receives_updates: boolean;
  is_primary: boolean;
  created_at: string;
};

const ROLE_LABEL: Record<string, string> = {
  primary: "Primary",
  billing: "Billing",
  technical: "Technical",
  other: "Other",
};

const emptyForm = (bpid: string) => ({
  id: "",
  business_profile_id: bpid,
  name: "",
  role: "primary" as Contact["role"],
  email: "",
  phone: "",
  receives_invoices: false,
  receives_updates: true,
  is_primary: false,
});

const BusinessContacts = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bpid, setBpid] = useState<string>("");
  const [rows, setRows] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyForm(""));
  const [saving, setSaving] = useState(false);

  const load = async (u: any) => {
    // Membership → business_profile_id; fallback to own uid (owner-account)
    const { data: mem } = await supabase
      .from("business_users")
      .select("business_profile_id")
      .eq("user_id", u.id)
      .maybeSingle();
    const profileId = (mem as any)?.business_profile_id ?? u.id;
    setBpid(profileId);
    const { data } = await supabase
      .from("business_contacts")
      .select("*")
      .eq("business_profile_id", profileId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });
    setRows((data ?? []) as Contact[]);
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (!u) { setLoading(false); return; }
      load(u);
    });
  }, []);

  const openNew = () => { setForm(emptyForm(bpid)); setOpen(true); };
  const openEdit = (c: Contact) => { setForm({ ...c, phone: c.phone ?? "" }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast({ title: "Name and email are required", variant: "destructive" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast({ title: "Invalid email", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      business_profile_id: bpid,
      name: form.name.trim().slice(0, 120),
      role: form.role,
      email: form.email.trim().toLowerCase().slice(0, 200),
      phone: form.phone?.trim() || null,
      receives_invoices: !!form.receives_invoices,
      receives_updates: !!form.receives_updates,
      is_primary: !!form.is_primary,
      created_by: user.id,
    };
    let error;
    if (form.id) {
      ({ error } = await supabase.from("business_contacts").update(payload).eq("id", form.id));
    } else {
      ({ error } = await supabase.from("business_contacts").insert(payload));
    }
    // If setting a new primary, unset others
    if (!error && form.is_primary) {
      await supabase
        .from("business_contacts")
        .update({ is_primary: false })
        .eq("business_profile_id", bpid)
        .neq("email", payload.email);
    }
    setSaving(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Contact saved" });
    setOpen(false);
    load(user);
  };

  const remove = async (c: Contact) => {
    if (!confirm(`Remove ${c.name}?`)) return;
    const { error } = await supabase.from("business_contacts").delete().eq("id", c.id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Contact removed" });
    load(user);
  };

  return (
    <Layout>
      <SEO title="Business Contacts" description="Manage named business contacts for billing and service updates." canonical="/business/contacts" />
      <section className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-4xl mb-2">Business contacts</h1>
            <p className="text-muted-foreground">Add named contacts and decide who receives invoices and service updates.</p>
          </div>
          {user && (
            <Button variant="hero" onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Add contact</Button>
          )}
        </div>

        {!user && !loading && (
          <div className="border-4 border-foreground bg-secondary p-6 shadow-brutal text-center">
            <p className="mb-4">Sign in to manage your business contacts.</p>
            <Link to="/auth?next=/business/contacts"><Button variant="hero">Sign in</Button></Link>
          </div>
        )}

        {user && loading && (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        )}

        {user && !loading && rows.length === 0 && (
          <div className="border-4 border-foreground bg-secondary p-10 shadow-brutal text-center">
            <p className="font-display text-lg mb-2">No contacts yet</p>
            <p className="text-muted-foreground mb-4">Add your primary contact and a dedicated billing contact for cleaner comms.</p>
            <Button variant="hero" onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Add your first contact</Button>
          </div>
        )}

        {user && rows.length > 0 && (
          <div className="space-y-3">
            {rows.map((c) => (
              <div key={c.id} className="border-4 border-foreground bg-background p-4 shadow-brutal flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {c.is_primary && <Badge className="bg-primary text-primary-foreground border-2 border-foreground"><Star className="w-3 h-3 mr-1" /> Primary</Badge>}
                    <Badge variant="outline">{ROLE_LABEL[c.role]}</Badge>
                    {c.receives_invoices && <Badge variant="outline">Invoices</Badge>}
                    {c.receives_updates && <Badge variant="outline">Updates</Badge>}
                  </div>
                  <div className="font-display text-lg">{c.name}</div>
                  <div className="text-sm text-muted-foreground flex flex-wrap gap-3 mt-1">
                    <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</span>
                    {c.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</span>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => openEdit(c)}><Pencil className="w-3 h-3" /></Button>
                  <Button size="sm" variant="outline" onClick={() => remove(c)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{form.id ? "Edit contact" : "Add contact"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Full name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">Primary</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="border-t pt-3 space-y-3">
                <label className="flex items-center justify-between">
                  <span>
                    <span className="font-display">Set as primary</span>
                    <p className="text-xs text-muted-foreground">Main point of contact for account changes.</p>
                  </span>
                  <Switch checked={form.is_primary} onCheckedChange={(v) => setForm({ ...form, is_primary: v })} />
                </label>
                <label className="flex items-center justify-between">
                  <span>
                    <span className="font-display">Receives invoices</span>
                    <p className="text-xs text-muted-foreground">Gets a PDF copy of every issued invoice.</p>
                  </span>
                  <Switch checked={form.receives_invoices} onCheckedChange={(v) => setForm({ ...form, receives_invoices: v })} />
                </label>
                <label className="flex items-center justify-between">
                  <span>
                    <span className="font-display">Receives service updates</span>
                    <p className="text-xs text-muted-foreground">Ticket status changes and outage alerts.</p>
                  </span>
                  <Switch checked={form.receives_updates} onCheckedChange={(v) => setForm({ ...form, receives_updates: v })} />
                </label>
              </div>
              <Button className="w-full" variant="hero" onClick={save} disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : "Save contact"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </section>
    </Layout>
  );
};

export default BusinessContacts;