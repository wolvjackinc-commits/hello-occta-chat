import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const serviceTypes = ["broadband", "sim", "landline"] as const;

export const AdminServices = () => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    userId: "",
    serviceType: "broadband",
    landlineNumber: "",
    broadbandRef: "",
    msisdn: "",
    iccid: "",
    activationDate: "",
    suspensionReason: "",
    status: "active",
    supplierRef: "",
    orderId: "",
  });

  const { data, refetch } = useQuery({
    queryKey: ["admin-services"],
    queryFn: async () => {
      const { data: services } = await supabase
        .from("services")
        .select("id, user_id, service_type, identifiers, status, supplier_reference, activation_date, suspension_reason, order_id")
        .order("created_at", { ascending: false });
      return services ?? [];
    },
  });

  const handleCreate = async () => {
    const identifiers = {
      landline_number: form.landlineNumber || null,
      broadband_ref: form.broadbandRef || null,
      msisdn: form.msisdn || null,
      iccid: form.iccid || null,
    };
    const { error } = await supabase.from("services").insert({
      user_id: form.userId,
      service_type: form.serviceType,
      identifiers,
      status: form.status,
      supplier_reference: form.supplierRef,
      activation_date: form.activationDate || null,
      suspension_reason: form.suspensionReason || null,
      order_id: form.orderId || null,
    });
    if (error) {
      toast({ title: "Failed to add service", variant: "destructive" });
      return;
    }
    toast({ title: "Service added" });
    setOpen(false);
    setForm({
      userId: "",
      serviceType: "broadband",
      landlineNumber: "",
      broadbandRef: "",
      msisdn: "",
      iccid: "",
      activationDate: "",
      suspensionReason: "",
      status: "active",
      supplierRef: "",
      orderId: "",
    });
    refetch();
  };

  const handleStatusUpdate = async (serviceId: string, status: string) => {
    const { error } = await supabase
      .from("services")
      .update({ status, suspension_reason: status === "suspended" ? "Manual suspension" : null })
      .eq("id", serviceId);
    if (error) {
      toast({ title: "Failed to update service", variant: "destructive" });
      return;
    }
    await supabase.from("audit_log").insert({
      action: status === "suspended" ? "SUSPEND_SERVICE" : "RESUME_SERVICE",
      table_name: "services",
      record_id: serviceId,
      before: null,
      after: { status },
    });
    toast({ title: "Service updated" });
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display">Services</h1>
          <p className="text-muted-foreground">Track provisioned services and supplier references.</p>
        </div>
        <Button onClick={() => setOpen(true)}>Add service</Button>
      </div>

      <div className="grid gap-4">
        {data?.map((service) => (
          <Card key={service.id} className="border-2 border-foreground p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium">{service.service_type}</div>
                <div className="text-sm text-muted-foreground">Status: {service.status}</div>
                <div className="text-xs text-muted-foreground">Supplier ref: {service.supplier_reference || "—"}</div>
                <div className="text-xs text-muted-foreground">Activation: {service.activation_date || "—"}</div>
                {service.suspension_reason && (
                  <div className="text-xs text-muted-foreground">Suspended: {service.suspension_reason}</div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleStatusUpdate(service.id, "suspended")}
                  disabled={service.status === "suspended"}
                >
                  Suspend
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleStatusUpdate(service.id, "active")}
                  disabled={service.status === "active"}
                >
                  Resume
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Identifiers: {JSON.stringify(service.identifiers || {})}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add service</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Customer user ID"
              value={form.userId}
              onChange={(event) => setForm((prev) => ({ ...prev, userId: event.target.value }))}
            />
            <Select value={form.serviceType} onValueChange={(value) => setForm((prev) => ({ ...prev, serviceType: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Service type" />
              </SelectTrigger>
              <SelectContent>
                {serviceTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Landline number"
              value={form.landlineNumber}
              onChange={(event) => setForm((prev) => ({ ...prev, landlineNumber: event.target.value }))}
            />
            <Input
              placeholder="Broadband circuit reference"
              value={form.broadbandRef}
              onChange={(event) => setForm((prev) => ({ ...prev, broadbandRef: event.target.value }))}
            />
            <Input
              placeholder="SIM MSISDN"
              value={form.msisdn}
              onChange={(event) => setForm((prev) => ({ ...prev, msisdn: event.target.value }))}
            />
            <Input
              placeholder="SIM ICCID"
              value={form.iccid}
              onChange={(event) => setForm((prev) => ({ ...prev, iccid: event.target.value }))}
            />
            <Input
              placeholder="Activation date (YYYY-MM-DD)"
              value={form.activationDate}
              onChange={(event) => setForm((prev) => ({ ...prev, activationDate: event.target.value }))}
            />
            <Input
              placeholder="Status"
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
            />
            <Input
              placeholder="Suspension reason"
              value={form.suspensionReason}
              onChange={(event) => setForm((prev) => ({ ...prev, suspensionReason: event.target.value }))}
            />
            <Input
              placeholder="Supplier reference"
              value={form.supplierRef}
              onChange={(event) => setForm((prev) => ({ ...prev, supplierRef: event.target.value }))}
            />
            <Input
              placeholder="Order ID (optional)"
              value={form.orderId}
              onChange={(event) => setForm((prev) => ({ ...prev, orderId: event.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
