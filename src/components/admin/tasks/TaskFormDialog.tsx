import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TASK_PRIORITIES, TASK_PRIORITY_LABEL, type TaskPriority, type AdminTask } from "@/lib/tasks/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  prefill?: Partial<Pick<AdminTask, "title" | "description" | "priority" | "related_customer_id" | "related_account_number" | "related_quote_id" | "related_contract_summary_id" | "related_payment_request_id">>;
}

export function TaskFormDialog({ open, onOpenChange, onCreated, prefill }: Props) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [accountNumber, setAccountNumber] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(prefill?.title ?? "");
      setDescription(prefill?.description ?? "");
      setPriority((prefill?.priority as TaskPriority) ?? "medium");
      setAccountNumber(prefill?.related_account_number ?? "");
      setDueDate("");
    }
  }, [open, prefill]);

  const submit = async () => {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) {
      toast({ title: "Not signed in", variant: "destructive" });
      setSaving(false);
      return;
    }
    const { error } = await (supabase as any).from("admin_tasks").insert({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      related_account_number: accountNumber.trim() || null,
      related_customer_id: prefill?.related_customer_id ?? null,
      related_quote_id: prefill?.related_quote_id ?? null,
      related_contract_summary_id: prefill?.related_contract_summary_id ?? null,
      related_payment_request_id: prefill?.related_payment_request_id ?? null,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      created_by: uid,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Could not create task", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Task created" });
    onCreated();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex-col overflow-y-auto rounded-none border-2 border-foreground">
        <DialogHeader>
          <DialogTitle className="font-display uppercase">New task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Title</Label>
            <Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} className="rounded-none border-2 border-foreground" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} maxLength={4000} onChange={(e) => setDescription(e.target.value)} className="rounded-none border-2 border-foreground" rows={4} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger className="rounded-none border-2 border-foreground"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{TASK_PRIORITY_LABEL[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded-none border-2 border-foreground" />
            </div>
          </div>
          <div>
            <Label>Customer account number (optional)</Label>
            <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="rounded-none border-2 border-foreground" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-none border-2 border-foreground">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="rounded-none border-2 border-foreground">{saving ? "Creating…" : "Create task"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}