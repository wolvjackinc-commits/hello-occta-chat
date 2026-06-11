import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  type AdminTask,
  type AdminTaskNote,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks/types";

interface Props {
  task: AdminTask | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

export function TaskDetailDrawer({ task, onOpenChange, onChanged }: Props) {
  const { toast } = useToast();
  const [notes, setNotes] = useState<AdminTaskNote[]>([]);
  const [noteBody, setNoteBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!task) return;
    (supabase as any)
      .from("admin_task_notes")
      .select("*")
      .eq("task_id", task.id)
      .order("created_at", { ascending: false })
      .then(({ data }: any) => setNotes(data ?? []));
  }, [task?.id]);

  if (!task) return null;

  const updateField = async (patch: Partial<AdminTask>) => {
    setBusy(true);
    const { error } = await (supabase as any).from("admin_tasks").update(patch).eq("id", task.id);
    setBusy(false);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    onChanged();
  };

  const addNote = async () => {
    if (!noteBody.trim()) return;
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) return;
    setBusy(true);
    const { error } = await (supabase as any).from("admin_task_notes").insert({
      task_id: task.id,
      author_id: uid,
      body: noteBody.trim(),
    });
    setBusy(false);
    if (error) {
      toast({ title: "Could not add note", description: error.message, variant: "destructive" });
      return;
    }
    setNoteBody("");
    const { data } = await (supabase as any)
      .from("admin_task_notes")
      .select("*")
      .eq("task_id", task.id)
      .order("created_at", { ascending: false });
    setNotes(data ?? []);
  };

  return (
    <Sheet open={!!task} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto rounded-none border-l-4 border-foreground sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="font-display uppercase">
            {task.task_number} — {task.title}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-6">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-none border-2 border-foreground">{TASK_STATUS_LABEL[task.status]}</Badge>
            <Badge variant="outline" className="rounded-none border-2 border-foreground">{TASK_PRIORITY_LABEL[task.priority]}</Badge>
          </div>

          {task.status === "waiting_supplier" && (
            <p className="border-2 border-foreground bg-muted p-2 text-xs">
              Waiting on supplier/admin action — no supplier order has been submitted.
            </p>
          )}

          {task.description && <p className="whitespace-pre-wrap text-sm">{task.description}</p>}

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="text-xs uppercase">Status</Label>
              <Select value={task.status} onValueChange={(v) => updateField({ status: v as TaskStatus })} disabled={busy}>
                <SelectTrigger className="rounded-none border-2 border-foreground"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{TASK_STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase">Priority</Label>
              <Select value={task.priority} onValueChange={(v) => updateField({ priority: v as TaskPriority })} disabled={busy}>
                <SelectTrigger className="rounded-none border-2 border-foreground"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{TASK_PRIORITY_LABEL[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(task.related_account_number || task.related_quote_id || task.related_contract_summary_id || task.related_payment_request_id) && (
            <div className="space-y-1 border-2 border-foreground p-3 text-sm">
              <p className="font-display text-xs uppercase">Linked records</p>
              {task.related_account_number && (
                <div>
                  <Link className="underline" to={`/admin/customers/${task.related_account_number}`}>Customer · {task.related_account_number}</Link>
                  {" · "}
                  <Link className="underline" to={`/admin/customers/${task.related_account_number}/journey`}>Journey</Link>
                </div>
              )}
              {task.related_quote_id && <div>Quote: {task.related_quote_id}</div>}
              {task.related_contract_summary_id && <div>Contract Summary: {task.related_contract_summary_id}</div>}
              {task.related_payment_request_id && <div>Payment Request: {task.related_payment_request_id}</div>}
            </div>
          )}

          <div className="space-y-2">
            <Label className="font-display uppercase">Internal notes (append-only)</Label>
            <Textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              maxLength={4000}
              rows={3}
              className="rounded-none border-2 border-foreground"
              placeholder="Add internal note…"
            />
            <Button onClick={addNote} disabled={busy || !noteBody.trim()} className="rounded-none border-2 border-foreground">
              Add note
            </Button>

            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="border-2 border-foreground p-2 text-sm">
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                </li>
              ))}
              {notes.length === 0 && <li className="text-xs text-muted-foreground">No notes yet.</li>}
            </ul>
          </div>

          <div className="flex gap-2 border-t-2 border-foreground pt-4">
            {task.status !== "resolved" && task.status !== "cancelled" && (
              <>
                <Button variant="outline" onClick={() => updateField({ status: "resolved" })} disabled={busy} className="rounded-none border-2 border-foreground">
                  Mark resolved
                </Button>
                <Button variant="outline" onClick={() => updateField({ status: "cancelled" })} disabled={busy} className="rounded-none border-2 border-foreground">
                  Cancel task
                </Button>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}