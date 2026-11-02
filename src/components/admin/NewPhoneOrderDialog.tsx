import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { AddressAutocomplete } from "@/components/address/AddressAutocomplete";

export type PhoneOrderCreated = { quote_request_id: string; reference: string; replayed: boolean };

const EMPTY = {
  full_name: "",
  email: "",
  phone: "",
  postcode: "",
  address_line_1: "",
  address_line_2: "",
  town: "",
  customer_type: "residential" as "residential" | "business",
  business_name: "",
  service_interest: "broadband" as "broadband" | "sim" | "digital_voice" | "business" | "switching" | "bundle" | "other",
  plan_preference: "not_sure" as "flex" | "contract_saver" | "not_sure",
  current_provider: "",
  call_reference: "",
  call_notes: "",
  marketing_consent: false,
};

/**
 * Logs a caller as a quote request (source = phone) so the agent can build the
 * quote straight away and send the normal secure link. The customer then
 * accepts the Contract Summary, sets up their own Direct Debit and confirms —
 * through the same journey as any website order.
 */
export function NewPhoneOrderDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (result: PhoneOrderCreated) => void;
}) {
  const { toast } = useToast();
  const [f, setF] = useState(EMPTY);
  const [manualAddress, setManualAddress] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setF((s) => ({ ...s, [k]: v }));

  const close = (o: boolean) => {
    if (!o && !saving) { setF(EMPTY); setManualAddress(false); }
    onOpenChange(o);
  };

  const missing = [
    f.full_name.trim().length < 2 && "name",
    !/^\S+@\S+\.\S+$/.test(f.email.trim()) && "email",
    f.phone.replace(/\D/g, "").length < 7 && "phone",
    f.postcode.trim().length < 5 && "postcode",
    f.address_line_1.trim().length < 2 && "address",
    f.customer_type === "business" && !f.business_name.trim() && "business name",
  ].filter(Boolean) as string[];

  const submit = async () => {
    if (missing.length) {
      toast({ title: "Missing details", description: `Add: ${missing.join(", ")}`, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-phone-quote-request", {
        body: {
          ...f,
          address_line_2: f.address_line_2 || null,
          town: f.town || null,
          business_name: f.customer_type === "business" ? f.business_name : null,
          current_provider: f.current_provider || null,
          call_reference: f.call_reference || null,
          call_notes: f.call_notes || null,
        },
      });
      if (error || (data as any)?.error) {
        const payload = (error as any)?.context instanceof Response
          ? await (error as any).context.json().catch(() => null)
          : data;
        const fe = payload?.details?.fieldErrors as Record<string, string[]> | undefined;
        throw new Error(fe && Object.keys(fe).length
          ? Object.entries(fe).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v.join(", ")}`).join(" · ")
          : payload?.details || payload?.error || error?.message || "Request failed");
      }
      const res = data as PhoneOrderCreated & { existing_account?: string | null };
      toast({
        title: res.replayed ? `Already logged: ${res.reference}` : `Phone order ${res.reference} started`,
        description: res.existing_account ? `Linked to existing account ${res.existing_account}.` : "Now build the quote and send the link.",
      });
      setF(EMPTY);
      setManualAddress(false);
      onOpenChange(false);
      onCreated(res);
    } catch (e: any) {
      toast({ title: "Could not start phone order", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New phone order</DialogTitle>
          <DialogDescription>
            Take the caller's details, then build their quote. They'll get a secure link to review the Contract Summary,
            set up their own Direct Debit and confirm. Nothing is ordered or billed until they complete it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="po-name">Full name *</Label>
            <Input id="po-name" value={f.full_name} onChange={(e) => set("full_name", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="po-email">Email * (link goes here)</Label>
            <Input id="po-email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="po-phone">Mobile *</Label>
            <Input id="po-phone" type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="po-type">Customer type</Label>
            <Select value={f.customer_type} onValueChange={(v) => set("customer_type", v as any)}>
              <SelectTrigger id="po-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="residential">Residential</SelectItem>
                <SelectItem value="business">Business</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {f.customer_type === "business" ? (
            <div className="space-y-1">
              <Label htmlFor="po-biz">Business name *</Label>
              <Input id="po-biz" value={f.business_name} onChange={(e) => set("business_name", e.target.value)} />
            </div>
          ) : <div className="hidden sm:block" />}

          <div className="sm:col-span-2 space-y-2">
            {!manualAddress ? (
              <>
                <AddressAutocomplete
                  label="Installation address *"
                  helperText="Type house number and street. Pick the exact address."
                  onSelect={(a) => setF((s) => ({
                    ...s,
                    address_line_1: a.line1,
                    address_line_2: a.line2 ?? "",
                    town: a.city,
                    postcode: a.postcode || s.postcode,
                  }))}
                  onManualFallback={() => setManualAddress(true)}
                />
                {f.address_line_1 && (
                  <p className="text-sm">
                    Selected: <strong>{[f.address_line_1, f.address_line_2, f.town, f.postcode].filter(Boolean).join(", ")}</strong>
                  </p>
                )}
                <button type="button" className="text-xs underline" onClick={() => setManualAddress(true)}>
                  Enter address manually
                </button>
              </>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="po-a1">Address line 1 *</Label>
                  <Input id="po-a1" value={f.address_line_1} onChange={(e) => set("address_line_1", e.target.value)} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="po-a2">Address line 2</Label>
                  <Input id="po-a2" value={f.address_line_2} onChange={(e) => set("address_line_2", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="po-town">Town</Label>
                  <Input id="po-town" value={f.town} onChange={(e) => set("town", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="po-pc">Postcode *</Label>
                  <Input id="po-pc" value={f.postcode} onChange={(e) => set("postcode", e.target.value.toUpperCase())} />
                </div>
                <button type="button" className="text-xs underline text-left" onClick={() => setManualAddress(false)}>
                  Search address instead
                </button>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="po-svc">Service</Label>
            <Select value={f.service_interest} onValueChange={(v) => set("service_interest", v as any)}>
              <SelectTrigger id="po-svc"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="broadband">Broadband</SelectItem>
                <SelectItem value="switching">Switching broadband</SelectItem>
                <SelectItem value="bundle">Broadband + phone</SelectItem>
                <SelectItem value="digital_voice">Digital Voice</SelectItem>
                <SelectItem value="sim">SIM</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="po-plan">Plan type</Label>
            <Select value={f.plan_preference} onValueChange={(v) => set("plan_preference", v as any)}>
              <SelectTrigger id="po-plan"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="flex">Flex (rolling)</SelectItem>
                <SelectItem value="contract_saver">Contract Saver</SelectItem>
                <SelectItem value="not_sure">Not decided</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="po-prov">Current provider</Label>
            <Input id="po-prov" value={f.current_provider} onChange={(e) => set("current_provider", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="po-ref">Call reference / recording ID</Label>
            <Input id="po-ref" value={f.call_reference} onChange={(e) => set("call_reference", e.target.value)} />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="po-notes">Call notes (internal)</Label>
            <Textarea id="po-notes" rows={3} value={f.call_notes} onChange={(e) => set("call_notes", e.target.value)} />
          </div>

          <label className="flex items-start gap-2 sm:col-span-2 text-sm">
            <Checkbox checked={f.marketing_consent} onCheckedChange={(v) => set("marketing_consent", v === true)} />
            <span>Caller said <strong>yes</strong> to marketing emails. Leave unticked unless they clearly agreed.</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={saving}>Cancel</Button>
          <Button variant="hero" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save & build quote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
