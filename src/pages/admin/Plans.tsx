import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const planTypes = ["broadband", "sim", "landline_addon"] as const;

export const AdminPlans = () => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    planType: "broadband",
    price: "",
    effectiveFrom: "",
    effectiveTo: "",
    version: "1",
  });

  const { data, refetch } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const { data: plans } = await supabase.from("plans").select("*").order("created_at", { ascending: false });
      return plans ?? [];
    },
  });

  const handleCreate = async () => {
    const { error } = await supabase.from("plans").insert({
      name: form.name,
      plan_type: form.planType,
      price: Number(form.price || 0),
      effective_from: form.effectiveFrom || null,
      effective_to: form.effectiveTo || null,
      version: Number(form.version || 1),
    });
    if (error) {
      toast({ title: "Failed to add plan", variant: "destructive" });
      return;
    }
    toast({ title: "Plan added" });
    setOpen(false);
    setForm({ name: "", planType: "broadband", price: "", effectiveFrom: "", effectiveTo: "", version: "1" });
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display">Plan catalog</h1>
          <p className="text-muted-foreground">Maintain versioned plans and pricing.</p>
        </div>
        <Button onClick={() => setOpen(true)}>Add plan</Button>
      </div>

      <div className="grid gap-4">
        {data?.map((plan) => (
          <Card key={plan.id} className="border-2 border-foreground p-4">
            <div className="font-medium">{plan.name}</div>
            <div className="text-sm text-muted-foreground">Type: {plan.plan_type}</div>
            <div className="text-xs text-muted-foreground">£{plan.price} · v{plan.version}</div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Plan name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <Select value={form.planType} onValueChange={(value) => setForm((prev) => ({ ...prev, planType: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Plan type" />
              </SelectTrigger>
              <SelectContent>
                {planTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Price"
              type="number"
              value={form.price}
              onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
            />
            <Input
              placeholder="Effective from (YYYY-MM-DD)"
              value={form.effectiveFrom}
              onChange={(event) => setForm((prev) => ({ ...prev, effectiveFrom: event.target.value }))}
            />
            <Input
              placeholder="Effective to (YYYY-MM-DD)"
              value={form.effectiveTo}
              onChange={(event) => setForm((prev) => ({ ...prev, effectiveTo: event.target.value }))}
            />
            <Input
              placeholder="Version"
              type="number"
              value={form.version}
              onChange={(event) => setForm((prev) => ({ ...prev, version: event.target.value }))}
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
