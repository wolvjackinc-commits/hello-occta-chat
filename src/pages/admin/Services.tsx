import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { PauseCircle, PlayCircle, Plus } from "lucide-react";
import { AddServiceDialog } from "@/components/admin/AddServiceDialog";
import { useToast } from "@/hooks/use-toast";

type Service = {
  id: string;
  user_id: string;
  service_type: string;
  status: string;
  identifiers: Json | null;
  supplier_reference: string | null;
  activation_date: string | null;
  updated_at: string;
  suspension_reason: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  account_number: string | null;
};

const statusOptions = ["active", "suspended", "pending", "cancelled"] as const;

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "dd MMM yyyy");
};

const getIdentifier = (identifiers: Json | null) => {
  if (!identifiers) return "—";
  if (typeof identifiers === "string") return identifiers;
  if (typeof identifiers === "number" || typeof identifiers === "boolean") return `${identifiers}`;
  if (Array.isArray(identifiers)) return identifiers.join(", ");
  if (typeof identifiers === "object") {
    const record = identifiers as Record<string, unknown>;
    const preferredKeys = ["number", "msisdn", "username", "iccid", "circuit_ref"];
    for (const key of preferredKeys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number") return `${value}`;
    }
    return JSON.stringify(record);
  }
  return "—";
};

export const AdminServices = () => {
  const { toast } = useToast();
  const [serviceTypeFilter, setServiceTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [suspendService, setSuspendService] = useState<Service | null>(null);
  const [resumeService, setResumeService] = useState<Service | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-services"],
    queryFn: async () => {
      const { data: services, error } = await supabase
        .from("services")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const serviceList = (services || []) as Service[];
      const userIds = Array.from(new Set(serviceList.map((service) => service.user_id)));
      let profiles: Profile[] = [];

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email, account_number")
          .in("id", userIds);

        profiles = (profilesData || []) as Profile[];
      }

      return {
        services: serviceList,
        profiles,
      };
    },
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, Profile>();
    data?.profiles?.forEach((profile) => map.set(profile.id, profile));
    return map;
  }, [data?.profiles]);

  const services = useMemo(() => data?.services ?? [], [data?.services]);

  const serviceTypeOptions = useMemo(() => {
    const types = new Set(services.map((service) => service.service_type));
    return ["all", ...Array.from(types).sort()];
  }, [services]);

  const serviceStatusOptions = useMemo(() => {
    const statuses = new Set(services.map((service) => service.status));
    statusOptions.forEach((status) => statuses.add(status));
    return ["all", ...Array.from(statuses).sort()];
  }, [services]);

  const filteredServices = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    return services.filter((service) => {
      if (serviceTypeFilter !== "all" && service.service_type !== serviceTypeFilter) return false;
      if (statusFilter !== "all" && service.status !== statusFilter) return false;

      if (!search) return true;
      const identifierValue = getIdentifier(service.identifiers).toLowerCase();
      const supplier = service.supplier_reference?.toLowerCase() || "";
      const profile = profileMap.get(service.user_id);
      const accountNumber = profile?.account_number?.toLowerCase() || "";
      const name = profile?.full_name?.toLowerCase() || "";
      const email = profile?.email?.toLowerCase() || "";

      return (
        identifierValue.includes(search) ||
        supplier.includes(search) ||
        accountNumber.includes(search) ||
        name.includes(search) ||
        email.includes(search)
      );
    });
  }, [services, serviceTypeFilter, statusFilter, searchText, profileMap]);

  const handleSuspend = async () => {
    if (!suspendService) return;
    setUpdatingId(suspendService.id);
    const { error } = await supabase
      .from("services")
      .update({ status: "suspended", suspension_reason: suspendReason.trim() || null })
      .eq("id", suspendService.id);

    if (error) {
      toast({ title: "Failed to suspend service", variant: "destructive" });
      setUpdatingId(null);
      return;
    }

    toast({ title: "Service suspended" });
    setUpdatingId(null);
    setSuspendService(null);
    setSuspendReason("");
    refetch();
  };

  const handleResume = async () => {
    if (!resumeService) return;
    setUpdatingId(resumeService.id);
    const { error } = await supabase
      .from("services")
      .update({ status: "active", suspension_reason: null })
      .eq("id", resumeService.id);

    if (error) {
      toast({ title: "Failed to resume service", variant: "destructive" });
      setUpdatingId(null);
      return;
    }

    toast({ title: "Service resumed" });
    setUpdatingId(null);
    setResumeService(null);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display">Services</h1>
          <p className="text-muted-foreground">Track provisioned services and supplier references.</p>
        </div>
        <AddServiceDialog
          trigger={(
            <Button className="border-2 border-foreground gap-2">
              <Plus className="h-4 w-4" />
              Add service
            </Button>
          )}
          onSaved={refetch}
        />
      </div>

      <Card className="border-2 border-foreground p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label className="font-display uppercase text-xs">Service type</Label>
            <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
              <SelectTrigger className="mt-1 border-2 border-foreground">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                {serviceTypeOptions.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type === "all" ? "All" : type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="font-display uppercase text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="mt-1 border-2 border-foreground">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {serviceStatusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status === "all" ? "All" : status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="font-display uppercase text-xs">Search</Label>
            <Input
              placeholder="Identifier, supplier ref, or account number"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className="mt-1 border-2 border-foreground"
            />
          </div>
        </div>
      </Card>

      <Card className="border-2 border-foreground p-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading services...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b-4 border-foreground">
                <TableHead className="font-display uppercase">Customer</TableHead>
                <TableHead className="font-display uppercase">Type</TableHead>
                <TableHead className="font-display uppercase">Status</TableHead>
                <TableHead className="font-display uppercase">Identifier</TableHead>
                <TableHead className="font-display uppercase">Supplier ref</TableHead>
                <TableHead className="font-display uppercase">Activation date</TableHead>
                <TableHead className="font-display uppercase">Updated</TableHead>
                <TableHead className="font-display uppercase text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredServices.map((service) => {
                const profile = profileMap.get(service.user_id);
                const identifier = getIdentifier(service.identifiers);
                const customerLabel = profile?.full_name || profile?.email || "Customer";
                const accountNumber = profile?.account_number || "Account —";
                return (
                  <TableRow key={service.id} className="border-b-2 border-foreground/20">
                    <TableCell>
                      <div>
                        <div className="font-medium">{accountNumber}</div>
                        <div className="text-xs text-muted-foreground">{customerLabel}</div>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{service.service_type}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="border-2 border-foreground capitalize"
                        title={service.suspension_reason || undefined}
                      >
                        {service.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate" title={identifier}>
                      {identifier}
                    </TableCell>
                    <TableCell>{service.supplier_reference || "—"}</TableCell>
                    <TableCell>{formatDate(service.activation_date)}</TableCell>
                    <TableCell>{formatDate(service.updated_at)}</TableCell>
                    <TableCell className="text-right">
                      {service.status === "suspended" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setResumeService(service)}
                          disabled={updatingId === service.id}
                          className="border-2 border-foreground gap-2"
                        >
                          <PlayCircle className="h-4 w-4" />
                          Resume
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSuspendService(service);
                            setSuspendReason("");
                          }}
                          disabled={updatingId === service.id}
                          className="border-2 border-foreground gap-2"
                        >
                          <PauseCircle className="h-4 w-4" />
                          Suspend
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {!isLoading && filteredServices.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">No services found.</div>
        )}
      </Card>

      <Dialog
        open={!!suspendService}
        onOpenChange={(open) => {
          if (!open) {
            setSuspendService(null);
            setSuspendReason("");
          }
        }}
      >
        <DialogContent className="border-4 border-foreground">
          <DialogHeader>
            <DialogTitle className="font-display">Suspend service</DialogTitle>
            <DialogDescription>Are you sure you want to suspend this service?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-display uppercase text-sm">Suspension reason (optional)</Label>
              <Textarea
                value={suspendReason}
                onChange={(event) => setSuspendReason(event.target.value)}
                className="mt-1 border-2 border-foreground min-h-[120px]"
              />
            </div>
            <Button
              onClick={handleSuspend}
              disabled={!suspendService || updatingId === suspendService?.id}
              className="w-full border-2 border-foreground"
            >
              {updatingId === suspendService?.id ? "Updating..." : "Confirm suspension"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!resumeService}
        onOpenChange={(open) => {
          if (!open) setResumeService(null);
        }}
      >
        <DialogContent className="border-4 border-foreground">
          <DialogHeader>
            <DialogTitle className="font-display">Resume service</DialogTitle>
            <DialogDescription>Are you sure you want to resume this service?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Button
              onClick={handleResume}
              disabled={!resumeService || updatingId === resumeService?.id}
              className="w-full border-2 border-foreground"
            >
              {updatingId === resumeService?.id ? "Updating..." : "Confirm resume"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
