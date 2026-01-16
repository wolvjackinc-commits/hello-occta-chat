import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  account_number: string | null;
};

type AddServiceDialogProps = {
  trigger: ReactNode;
  defaultAccountNumber?: string | null;
  readOnlyAccountNumber?: boolean;
  defaultCustomerId?: string | null;
  onSaved?: () => void;
};

const statusOptions = ["active", "suspended", "pending", "cancelled"] as const;
const allowedServiceTypes = ["broadband", "landline", "sim"] as const;

function normalizeAccountNumber(value: string) {
  return value.trim().toUpperCase();
}

function isAccountNumberValid(value: string) {
  return /^OCC\d{8}$/.test(value);
}

const isUkNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^\d+$/.test(trimmed)) return true;
  const normalized = trimmed.replace(/[\s()-]/g, "");
  return /^(\+44|0)\d{9,10}$/.test(normalized);
};

const buildInitialFormState = (accountNumber?: string | null) => ({
  accountNumber: accountNumber?.trim() || "",
  serviceType: "broadband",
  supplierReference: "",
  activationDate: "",
  status: "active",
});

const buildInitialIdentifierFields = () => ({
  broadband: {
    username: "",
    package: "",
    routerTracking: "",
    notes: "",
  },
  landline: {
    number: "",
    portingRequired: "",
    losingProvider: "",
    notes: "",
  },
  sim: {
    msisdn: "",
    iccid: "",
    network: "",
    notes: "",
  },
});

export const AddServiceDialog = ({
  trigger,
  defaultAccountNumber,
  readOnlyAccountNumber = false,
  defaultCustomerId,
  onSaved,
}: AddServiceDialogProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [matchedCustomer, setMatchedCustomer] = useState<Profile | null>(null);
  const [isLookingUpCustomer, setIsLookingUpCustomer] = useState(false);
  const [formState, setFormState] = useState(() => buildInitialFormState(defaultAccountNumber));
  const [identifierFields, setIdentifierFields] = useState(buildInitialIdentifierFields);
  const isServiceTypeValid = allowedServiceTypes.includes(
    formState.serviceType as (typeof allowedServiceTypes)[number],
  );
  const accountNumberInput = formState.accountNumber;
  const normalizedAccountNumber = normalizeAccountNumber(accountNumberInput ?? "");
  const isNormalizedAccountNumberValid = isAccountNumberValid(normalizedAccountNumber);
  const hasCustomer = Boolean(defaultCustomerId || matchedCustomer?.id);

  useEffect(() => {
    if (!isOpen) return;
    setFormState(buildInitialFormState(defaultAccountNumber));
    setIdentifierFields(buildInitialIdentifierFields());
    setMatchedCustomer(null);
  }, [defaultAccountNumber, isOpen]);

  useEffect(() => {
    if (defaultCustomerId) {
      setMatchedCustomer(null);
      setIsLookingUpCustomer(false);
      return;
    }
    if (!normalizedAccountNumber || !isNormalizedAccountNumberValid) {
      setMatchedCustomer(null);
      setIsLookingUpCustomer(false);
      return;
    }

    let isActive = true;
    setIsLookingUpCustomer(true);
    setMatchedCustomer(null);
    
    const lookupCustomer = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, account_number, email, full_name")
          .eq("account_number", normalizedAccountNumber)
          .maybeSingle();
        
        if (!isActive) return;
        if (error) {
          toast({ title: "Failed to find customer", description: error.message, variant: "destructive" });
          setMatchedCustomer(null);
          return;
        }
        setMatchedCustomer(data ?? null);
      } catch (err) {
        if (isActive) {
          setMatchedCustomer(null);
        }
      } finally {
        if (isActive) setIsLookingUpCustomer(false);
      }
    };

    lookupCustomer();

    return () => {
      isActive = false;
    };
  }, [defaultCustomerId, isNormalizedAccountNumberValid, normalizedAccountNumber, toast]);

  const resetForm = () => {
    setFormState(buildInitialFormState(defaultAccountNumber));
    setIdentifierFields(buildInitialIdentifierFields());
    setMatchedCustomer(null);
  };

  const handleAddService = async () => {
    if (!normalizedAccountNumber || !formState.serviceType.trim()) {
      toast({ title: "Account number and service type are required", variant: "destructive" });
      return;
    }
    if (!isNormalizedAccountNumberValid) {
      toast({ title: "Enter a valid account number (OCC########).", variant: "destructive" });
      return;
    }
    if (!isServiceTypeValid) {
      toast({ title: "Select a valid service type", variant: "destructive" });
      return;
    }

    let identifiers: Json = {};
    if (formState.serviceType === "broadband") {
      const broadband = identifierFields.broadband;
      identifiers = {
        username: broadband.username.trim() || null,
        package: broadband.package.trim() || null,
        router_tracking: broadband.routerTracking.trim() || null,
        notes: broadband.notes.trim() || null,
      };
    }

    if (formState.serviceType === "landline") {
      const landline = identifierFields.landline;
      if (!landline.number.trim()) {
        toast({ title: "Landline number is required", variant: "destructive" });
        return;
      }
      if (!isUkNumber(landline.number)) {
        toast({ title: "Landline number must be digits or UK format", variant: "destructive" });
        return;
      }
      identifiers = {
        number: landline.number.trim(),
        porting_required: landline.portingRequired
          ? landline.portingRequired === "yes"
          : null,
        losing_provider: landline.losingProvider.trim() || null,
        notes: landline.notes.trim() || null,
      };
    }

    if (formState.serviceType === "sim") {
      const sim = identifierFields.sim;
      if (!sim.msisdn.trim()) {
        toast({ title: "MSISDN is required", variant: "destructive" });
        return;
      }
      if (!isUkNumber(sim.msisdn)) {
        toast({ title: "MSISDN must be digits or UK format", variant: "destructive" });
        return;
      }
      identifiers = {
        msisdn: sim.msisdn.trim(),
        iccid: sim.iccid.trim() || null,
        network: sim.network.trim() || null,
        notes: sim.notes.trim() || null,
      };
    }

    const customerId = defaultCustomerId ?? matchedCustomer?.id;
    if (!customerId) {
      toast({
        title: `Customer not found for ${normalizedAccountNumber}`,
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    const { data: insertedService, error } = await supabase.from("services").insert({
      user_id: customerId,
      service_type: formState.serviceType.trim(),
      identifiers,
      supplier_reference: formState.supplierReference.trim() || null,
      activation_date: formState.activationDate || null,
      status: formState.status || "active",
    }).select().single();

    if (error) {
      toast({
        title: "Failed to add service",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      setIsSaving(false);
      return;
    }

    // Log audit
    await logAudit({
      action: "create",
      entity: "service",
      entityId: insertedService?.id,
      metadata: {
        accountNumber: normalizedAccountNumber,
        serviceType: formState.serviceType.trim(),
        status: formState.status || "active",
      },
    });

    toast({ title: "Service added" });
    setIsSaving(false);
    setIsOpen(false);
    resetForm();
    onSaved?.();
  };

  const customerLabel = useMemo(() => {
    if (defaultCustomerId) return "Customer selected";
    if (matchedCustomer?.full_name) return matchedCustomer.full_name;
    if (matchedCustomer?.email) return matchedCustomer.email;
    return null;
  }, [defaultCustomerId, matchedCustomer?.email, matchedCustomer?.full_name]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="border-4 border-foreground max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Add Service</DialogTitle>
          <DialogDescription>Provision a new service for a customer.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="font-display uppercase text-sm">Account Number (OCC…)</Label>
            <Input
              placeholder="OCC12345678"
              value={formState.accountNumber}
              readOnly={readOnlyAccountNumber}
              onChange={(event) => setFormState((prev) => ({ ...prev, accountNumber: event.target.value }))}
              className="mt-1 border-2 border-foreground"
            />
            {customerLabel && (
              <p className="mt-2 text-xs text-muted-foreground">
                Customer: {customerLabel}
              </p>
            )}
            {!customerLabel && !defaultCustomerId && isNormalizedAccountNumberValid && !isLookingUpCustomer && (
              <p className="mt-2 text-xs text-muted-foreground">
                No customer found for {normalizedAccountNumber}.
              </p>
            )}
          </div>
          <div>
            <Label className="font-display uppercase text-sm">Service type</Label>
            <Select
              value={formState.serviceType}
              onValueChange={(value) => setFormState((prev) => ({ ...prev, serviceType: value }))}
            >
              <SelectTrigger className="mt-1 border-2 border-foreground">
                <SelectValue placeholder="Select service type" />
              </SelectTrigger>
              <SelectContent>
                {allowedServiceTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {formState.serviceType === "broadband" && (
            <div className="space-y-4">
              <div>
                <Label className="font-display uppercase text-sm">Username (optional)</Label>
                <Input
                  value={identifierFields.broadband.username}
                  onChange={(event) =>
                    setIdentifierFields((prev) => ({
                      ...prev,
                      broadband: { ...prev.broadband, username: event.target.value },
                    }))
                  }
                  className="mt-1 border-2 border-foreground"
                />
              </div>
              <div>
                <Label className="font-display uppercase text-sm">Package</Label>
                <Input
                  value={identifierFields.broadband.package}
                  onChange={(event) =>
                    setIdentifierFields((prev) => ({
                      ...prev,
                      broadband: { ...prev.broadband, package: event.target.value },
                    }))
                  }
                  className="mt-1 border-2 border-foreground"
                />
              </div>
              <div>
                <Label className="font-display uppercase text-sm">Router tracking</Label>
                <Input
                  value={identifierFields.broadband.routerTracking}
                  onChange={(event) =>
                    setIdentifierFields((prev) => ({
                      ...prev,
                      broadband: { ...prev.broadband, routerTracking: event.target.value },
                    }))
                  }
                  className="mt-1 border-2 border-foreground"
                />
              </div>
              <div>
                <Label className="font-display uppercase text-sm">Notes</Label>
                <Textarea
                  value={identifierFields.broadband.notes}
                  onChange={(event) =>
                    setIdentifierFields((prev) => ({
                      ...prev,
                      broadband: { ...prev.broadband, notes: event.target.value },
                    }))
                  }
                  className="mt-1 border-2 border-foreground min-h-[96px]"
                />
              </div>
            </div>
          )}
          {formState.serviceType === "landline" && (
            <div className="space-y-4">
              <div>
                <Label className="font-display uppercase text-sm">Number</Label>
                <Input
                  value={identifierFields.landline.number}
                  onChange={(event) =>
                    setIdentifierFields((prev) => ({
                      ...prev,
                      landline: { ...prev.landline, number: event.target.value },
                    }))
                  }
                  className="mt-1 border-2 border-foreground"
                />
              </div>
              <div>
                <Label className="font-display uppercase text-sm">Porting required</Label>
                <Select
                  value={identifierFields.landline.portingRequired}
                  onValueChange={(value) =>
                    setIdentifierFields((prev) => ({
                      ...prev,
                      landline: { ...prev.landline, portingRequired: value },
                    }))
                  }
                >
                  <SelectTrigger className="mt-1 border-2 border-foreground">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-display uppercase text-sm">Losing provider</Label>
                <Input
                  value={identifierFields.landline.losingProvider}
                  onChange={(event) =>
                    setIdentifierFields((prev) => ({
                      ...prev,
                      landline: { ...prev.landline, losingProvider: event.target.value },
                    }))
                  }
                  className="mt-1 border-2 border-foreground"
                />
              </div>
              <div>
                <Label className="font-display uppercase text-sm">Notes</Label>
                <Textarea
                  value={identifierFields.landline.notes}
                  onChange={(event) =>
                    setIdentifierFields((prev) => ({
                      ...prev,
                      landline: { ...prev.landline, notes: event.target.value },
                    }))
                  }
                  className="mt-1 border-2 border-foreground min-h-[96px]"
                />
              </div>
            </div>
          )}
          {formState.serviceType === "sim" && (
            <div className="space-y-4">
              <div>
                <Label className="font-display uppercase text-sm">MSISDN</Label>
                <Input
                  value={identifierFields.sim.msisdn}
                  onChange={(event) =>
                    setIdentifierFields((prev) => ({
                      ...prev,
                      sim: { ...prev.sim, msisdn: event.target.value },
                    }))
                  }
                  className="mt-1 border-2 border-foreground"
                />
              </div>
              <div>
                <Label className="font-display uppercase text-sm">ICCID</Label>
                <Input
                  value={identifierFields.sim.iccid}
                  onChange={(event) =>
                    setIdentifierFields((prev) => ({
                      ...prev,
                      sim: { ...prev.sim, iccid: event.target.value },
                    }))
                  }
                  className="mt-1 border-2 border-foreground"
                />
              </div>
              <div>
                <Label className="font-display uppercase text-sm">Network</Label>
                <Input
                  value={identifierFields.sim.network}
                  onChange={(event) =>
                    setIdentifierFields((prev) => ({
                      ...prev,
                      sim: { ...prev.sim, network: event.target.value },
                    }))
                  }
                  className="mt-1 border-2 border-foreground"
                />
              </div>
              <div>
                <Label className="font-display uppercase text-sm">Notes</Label>
                <Textarea
                  value={identifierFields.sim.notes}
                  onChange={(event) =>
                    setIdentifierFields((prev) => ({
                      ...prev,
                      sim: { ...prev.sim, notes: event.target.value },
                    }))
                  }
                  className="mt-1 border-2 border-foreground min-h-[96px]"
                />
              </div>
            </div>
          )}
          <div>
            <Label className="font-display uppercase text-sm">Supplier reference</Label>
            <Input
              value={formState.supplierReference}
              onChange={(event) => setFormState((prev) => ({ ...prev, supplierReference: event.target.value }))}
              className="mt-1 border-2 border-foreground"
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="font-display uppercase text-sm">Activation date</Label>
              <Input
                type="date"
                value={formState.activationDate}
                onChange={(event) => setFormState((prev) => ({ ...prev, activationDate: event.target.value }))}
                className="mt-1 border-2 border-foreground"
              />
            </div>
            <div>
              <Label className="font-display uppercase text-sm">Initial status</Label>
              <Select
                value={formState.status}
                onValueChange={(value) => setFormState((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger className="mt-1 border-2 border-foreground">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={handleAddService}
            disabled={isSaving || !isServiceTypeValid || !hasCustomer}
            className="w-full border-2 border-foreground"
          >
            {isSaving ? "Saving..." : "Add service"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
